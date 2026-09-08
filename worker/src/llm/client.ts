import OpenAI from 'openai'

import { config } from '../config'

const DEFAULT_MODEL = 'openrouter/free'

export interface LlmProvider {
    completeJson(prompt: string): Promise<string>
}

function resolveModels(): string[] {
    const raw = config.LLM_MODELS || config.LLM_MODEL || DEFAULT_MODEL
    return raw
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
}

class OpenAiProvider implements LlmProvider {
    private client: OpenAI
    private models: string[]

    constructor() {
        if (!config.LLM_API_KEY) {
            throw new Error('LLM_API_KEY is required to enable message analysis')
        }
        this.client = new OpenAI({
            apiKey: config.LLM_API_KEY,
            baseURL: config.LLM_BASE_URL,
        })
        this.models = resolveModels()
    }

    async completeJson(prompt: string): Promise<string> {
        const primary = this.models[0] ?? DEFAULT_MODEL
        const fallbacks = this.models.slice(1)

        const response = await this.client.chat.completions.create({
            model: primary,
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a message analysis engine. Always reply with a single valid JSON object and nothing else.',
                },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            ...(fallbacks.length > 0 ? { models: fallbacks } : {}),
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)

        return response.choices[0]?.message.content ?? ''
    }
}

export function createLlmProvider(): LlmProvider | null {
    if (!config.LLM_API_KEY) return null
    return new OpenAiProvider()
}