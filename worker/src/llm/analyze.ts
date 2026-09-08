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

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('LLM output was not a JSON object')
    }

    return parsed as AnalysisOutput
}