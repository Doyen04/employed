import { createLlmProvider, type LlmProvider } from './client'
import type { AnalysisConfig } from '../generated/prisma/client'

let provider: LlmProvider | null | undefined

function getProvider(): LlmProvider | null {
    if (provider !== undefined) return provider
    provider = createLlmProvider()
    return provider
}

export type AnalysisOutput = Record<string, unknown>

export async function runAnalysis(
    analysisConfig: Pick<AnalysisConfig, 'promptTemplate' | 'outputSchema'>,
    messageText: string,
): Promise<AnalysisOutput> {
    const llm = getProvider()
    if (!llm) {
        throw new Error('Configure LLM_API_KEY to enable message analysis')
    }

    const prompt = analysisConfig.promptTemplate
        .replaceAll('{{text}}', messageText)
        .replaceAll('{{schema}}', JSON.stringify(analysisConfig.outputSchema))

    const raw = await llm.completeJson(prompt)
    if (!raw) {
        throw new Error('LLM returned an empty response')
    }

    const extracted = extractJson(raw)
    if (!extracted) {
        throw new Error(
            `LLM output was not valid JSON: ${raw.length > 160 ? `${raw.slice(0, 160)}…` : raw}`,
        )
    }

    const parsed: unknown = JSON.parse(extracted)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('LLM output was not a JSON object')
    }

    return parsed as AnalysisOutput
}

/**
 * Tolerates the ways models smuggle JSON out of plain completion: prose before the object,
 * surrounding code fences, or trailing chatter after the closing brace. Returns the first
 * object-shaped JSON it can parse, or null.
 */
function extractJson(text: string): string | null {
    const candidates: string[] = []

    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence) candidates.push(fence[1].trim())

    candidates.push(text.trim())

    const start = text.indexOf('{')
    if (start !== -1) {
        const balanced = scanBalanced(text, start)
        if (balanced !== null) candidates.push(balanced)
    }

    for (const candidate of candidates) {
        try {
            const parsed: unknown = JSON.parse(candidate)
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return JSON.stringify(parsed)
            }
        } catch {
            // not this candidate — keep looking
        }
    }
    return null
}

function scanBalanced(text: string, start: number): string | null {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
        const char = text[i]
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (char === '\\') {
                escaped = true
            } else if (char === '"') {
                inString = false
            }
            continue
        }
        if (char === '"') {
            inString = true
            continue
        }
        if (char === '{') {
            depth += 1
        } else if (char === '}') {
            depth -= 1
            if (depth === 0) return text.slice(start, i + 1)
        }
    }
    return null
}