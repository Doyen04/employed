import OpenAI from 'openai'

import { config } from '../config'

export interface LlmProvider {
    completeJson(prompt: string): Promise<string>
}

class OpenAiProvider implements LlmProvider {
    private client: OpenAI
    private model: string

    constructor() {
        if (!config.LLM_API_KEY) {
            throw new Error('LLM_API_KEY is required to enable message analysis')
        }
        this.client = new OpenAI({
            apiKey: config.LLM_API_KEY,
            baseURL: config.LLM_BASE_URL,
        })
        this.model = config.LLM_MODEL ?? 'openai/gpt-4o-mini'
    }

    async completeJson(prompt: string): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
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
        })

        return response.choices[0]?.message.content ?? ''
    }
}

export function createLlmProvider(): LlmProvider | null {
    if (!config.LLM_API_KEY) return null
    return new OpenAiProvider()
}