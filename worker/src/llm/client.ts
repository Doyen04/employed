import OpenAI from 'openai'
import pRetry, { AbortError } from 'p-retry'

import { config } from '../config'
import { reportDiagnostic } from '../diagnostics'
import { getErrorMessage } from '../utils/errors'
import { truncate } from '../utils/truncate'

const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'
const OPENROUTER_DEFAULT_MODEL = 'openrouter/free'

const OPENROUTER_SEARCH_TOOLS: { type: string }[] = [
    { type: 'openrouter:web_search' },
    { type: 'openrouter:web_fetch' },
]
const GROQ_SEARCH_TOOLS: { type: string }[] = [{ type: 'browser_search' }]

const SCHEMA_NAME = 'analysis_result'

export interface LlmResult {
    content: string
    provider: string | null
    model: string | null
}

export interface LlmProvider {
    completeJson(prompt: string, schema?: unknown): Promise<LlmResult>
}

type FormatMode = 'json_schema' | 'json_object' | 'plain'

interface ProviderEntry {
    name: string
    model: string
    fallbackModels: string[]
    isOpenRouter: boolean
    searchMode: 'openrouter' | 'groq' | 'none'
    client: OpenAI
}

interface SchemaShape {
    [key: string]: unknown
}

function resolveModels(raw: string): string[] {
    return raw
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
}

function providerLabel(baseUrl: string): string {
    try {
        const host = new URL(baseUrl).hostname
        if (host.includes('groq')) return 'Groq'
        if (host.includes('openrouter')) return 'OpenRouter'
        if (host.includes('cerebras')) return 'Cerebras'
        if (host.includes('google') || host.includes('generativelanguage')) return 'Gemini'
        if (host.includes('openai')) return 'OpenAI'
        return host
    } catch {
        return 'LLM'
    }
}

function isRateLimit(error: unknown): boolean {
    return error instanceof OpenAI.APIError && error.status === 429
}

function isRetryable(error: unknown): boolean {
    if (error instanceof AbortError) return false
    if (error instanceof OpenAI.APIError) {
        return error.status === undefined || error.status >= 500
    }
    return true
}

function isFormatRejection(error: unknown): boolean {
    if (!(error instanceof OpenAI.APIError) || error.status !== 400) return false
    return /response_format|json_schema|json_object|structured output/i.test(String(error.message))
}

/**
 * Prepares the stored analysis schema for Groq's json_schema mode. A full JSON
 * Schema object (the seed format: type/properties/required) passes through
 * untouched. A loose `{ field: description }` map is wrapped into a proper
 * schema. Returns null when the input can't be normalized — the caller then
 * skips the json_schema rung entirely.
 */
function normalizeSchema(raw: unknown): SchemaShape | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const obj = raw as SchemaShape

    if (
        obj.type === 'object' &&
        obj.properties !== null &&
        typeof obj.properties === 'object' &&
        !Array.isArray(obj.properties)
    ) {
        return obj
    }

    const properties: SchemaShape = {}
    const required: string[] = []
    for (const [key, value] of Object.entries(obj)) {
        properties[key] = { type: 'string', description: String(value) }
        required.push(key)
    }
    if (required.length === 0) return null
    return { type: 'object', properties, required }
}

function buildModes(schema?: unknown): FormatMode[] {
    const normalized = normalizeSchema(schema)
    return normalized ? ['json_schema', 'json_object', 'plain'] : ['json_object', 'plain']
}

function buildPayload(
    entry: ProviderEntry,
    prompt: string,
    mode: FormatMode,
    schema?: unknown,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
    const responseFormat =
        mode === 'json_schema'
            ? {
                type: 'json_schema',
                json_schema: {
                    name: SCHEMA_NAME,
                    strict: false,
                    schema: normalizeSchema(schema),
                },
            }
            : mode === 'json_object'
                ? { type: 'json_object' }
                : undefined

    return {
        model: entry.model,
        temperature: 0,
        messages: [
            {
                role: 'system',
                content:
                    'You are a message analysis engine. Always reply with a single valid JSON object and nothing else.',
            },
            { role: 'user', content: prompt },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(entry.isOpenRouter && entry.fallbackModels.length > 0
            ? { models: entry.fallbackModels }
            : {}),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
}

async function attemptOnce(
    client: OpenAI,
    entry: ProviderEntry,
    prompt: string,
    modes: FormatMode[],
    schema?: unknown,
): Promise<string> {
    let lastError: unknown
    for (const mode of modes) {
        try {
            const response = await client.chat.completions.create(
                buildPayload(entry, prompt, mode, schema),
            )
            return response.choices[0]?.message.content ?? ''
        } catch (error) {
            lastError = error
            if (isFormatRejection(error)) continue
            throw error
        }
    }
    throw lastError
}

async function attemptWithRetries(
    client: OpenAI,
    entry: ProviderEntry,
    prompt: string,
    modes: FormatMode[],
    schema?: unknown,
): Promise<string> {
    return pRetry(() => attemptOnce(client, entry, prompt, modes, schema), {
        retries: 4,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 30000,
        randomize: true,
        shouldRetry: (error) => isRetryable(error) && !isRateLimit(error),
    })
}

function searchModeFor(baseUrl: string, isOpenRouter: boolean): ProviderEntry['searchMode'] {
    if (isOpenRouter) return 'openrouter'
    try {
        if (new URL(baseUrl).hostname.includes('groq')) return 'groq'
    } catch {
        // unparseable base URL — web search can't be assumed
    }
    return 'none'
}

function searchToolsFor(entry: ProviderEntry): { type: string }[] {
    if (entry.searchMode === 'openrouter') return OPENROUTER_SEARCH_TOOLS
    if (entry.searchMode === 'groq') return GROQ_SEARCH_TOOLS
    return []
}

/**
 * Attempts a single Responses-API completion with the provider's web
 * search/fetch tool attached. Returns null when the provider has no search
 * tool or the call itself fails — the caller then falls back to the regular
 * chat-completions path so search adds capability, never a hard dependency.
 */
async function completeWithSearch(
    client: OpenAI,
    entry: ProviderEntry,
    prompt: string,
): Promise<string | null> {
    const rawTools = searchToolsFor(entry)
    if (rawTools.length === 0) return null

    const tools: OpenAI.Responses.Tool[] = rawTools.map(
        (tool) => tool as unknown as OpenAI.Responses.Tool,
    )
    const response = await client.responses.create({
        model: entry.model,
        input: `${prompt}\n\nWeb search and web fetch tools are available. Use them to verify external facts mentioned in the message — deadlines, eligibility requirements, funding amounts, official application pages — before answering. Always reply with a single valid JSON object and nothing else.`,
        tools,
        temperature: 0,
    })
    const content = response.output_text
    return content && content.length > 0 ? content : null
}

async function tryCompleteWithSearch(
    entry: ProviderEntry,
    prompt: string,
): Promise<string | null> {
    if (entry.searchMode === 'none') return null
    try {
        return await completeWithSearch(entry.client, entry, prompt)
    } catch (error) {
        console.warn(
            `[llm] ${entry.name} web search unavailable (${getErrorMessage(error)}) — falling back to plain completion`,
        )
        return null
    }
}

class ProviderChain implements LlmProvider {
    private providers: ProviderEntry[]
    private cooldownUntil = new Map<string, number>()

    constructor(providers: ProviderEntry[]) {
        this.providers = providers
    }

    async completeJson(prompt: string, schema?: unknown): Promise<LlmResult> {
        const modes = buildModes(schema)
        const now = Date.now()
        const ready = this.providers.filter(
            (entry) => (this.cooldownUntil.get(entry.name) ?? 0) <= now,
        )
        const candidates = ready.length > 0 ? ready : this.providers
        let lastError: unknown

        for (const entry of candidates) {
            const searched = await tryCompleteWithSearch(entry, prompt)
            if (searched !== null) {
                this.cooldownUntil.delete(entry.name)
                if (entry !== this.providers[0]) {
                    await reportDiagnostic(
                        'llm.failover',
                        'warning',
                        `${entry.name} unavailable (${reasonOf(lastError)}) — routed to backup provider.`,
                    )
                }
                return { content: searched, provider: entry.name, model: entry.model }
            }

            try {
                const content = await attemptWithRetries(
                    entry.client,
                    entry,
                    prompt,
                    modes,
                    schema,
                )
                this.cooldownUntil.delete(entry.name)
                if (entry !== this.providers[0]) {
                    await reportDiagnostic(
                        'llm.failover',
                        'warning',
                        `${entry.name} unavailable (${reasonOf(lastError)}) — routed to backup provider.`,
                    )
                }
                return { content, provider: entry.name, model: entry.model }
            } catch (error) {
                lastError = error
                console.warn(`[llm] ${entry.name} failed:`, getErrorMessage(error))
                if (isRateLimit(error)) {
                    this.cooldownUntil.set(
                        entry.name,
                        Date.now() + config.LLM_PROVIDER_COOLDOWN_MS,
                    )
                    console.warn(
                        `[llm] ${entry.name} rate limited — cooling down for ${Math.round(
                            config.LLM_PROVIDER_COOLDOWN_MS / 1000,
                        )}s and rotating to the backup provider`,
                    )
                }
            }
        }

        throw lastError
    }
}

function reasonOf(error: unknown): string {
    if (isRateLimit(error)) return 'rate limited'
    if (error instanceof OpenAI.APIError) return truncate(`error ${error.status}`, 60)
    if (error) return truncate(getErrorMessage(error), 60)
    return 'unknown error'
}

export function createLlmProvider(): LlmProvider | null {
    if (!config.LLM_API_KEY) return null

    const primary = config.LLM_MODELS || config.LLM_MODEL || GROQ_DEFAULT_MODEL
    const backup = config.LLM_BACKUP_MODELS || config.LLM_BACKUP_MODEL || OPENROUTER_DEFAULT_MODEL

    const isPrimaryOpenRouter = config.LLM_BASE_URL.includes('openrouter.ai')

    const providers: ProviderEntry[] = [
        {
            name: providerLabel(config.LLM_BASE_URL),
            model: resolveModels(primary)[0] ?? GROQ_DEFAULT_MODEL,
            fallbackModels: resolveModels(primary).slice(1),
            isOpenRouter: isPrimaryOpenRouter,
            searchMode: searchModeFor(config.LLM_BASE_URL, isPrimaryOpenRouter),
            client: new OpenAI({
                apiKey: config.LLM_API_KEY,
                baseURL: config.LLM_BASE_URL,
                maxRetries: 0,
            }),
        },
    ]

    if (config.LLM_BACKUP_API_KEY) {
        const isBackupOpenRouter = config.LLM_BACKUP_BASE_URL.includes('openrouter.ai')
        providers.push({
            name: providerLabel(config.LLM_BACKUP_BASE_URL),
            model: resolveModels(backup)[0] ?? OPENROUTER_DEFAULT_MODEL,
            fallbackModels: resolveModels(backup).slice(1),
            isOpenRouter: isBackupOpenRouter,
            searchMode: searchModeFor(config.LLM_BACKUP_BASE_URL, isBackupOpenRouter),
            client: new OpenAI({
                apiKey: config.LLM_BACKUP_API_KEY,
                baseURL: config.LLM_BACKUP_BASE_URL,
                maxRetries: 0,
            }),
        })
    }

    return new ProviderChain(providers)
}