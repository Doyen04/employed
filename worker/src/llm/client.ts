import Groq from 'groq-sdk'

import { config } from '../config'

export interface LlmProvider {
  completeJson(prompt: string): Promise<string>
}

class GroqProvider implements LlmProvider {
  private client: Groq
  private model: string

  constructor() {
    if (!config.LLM_API_KEY) {
      throw new Error('LLM_API_KEY is required to enable message analysis')
    }
    this.client = new Groq({ apiKey: config.LLM_API_KEY })
    this.model = config.LLM_MODEL ?? 'llama-3.3-70b-versatile'
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

  switch (config.LLM_PROVIDER) {
    case 'groq':
      return new GroqProvider()
    case 'openrouter':
      throw new Error(
        'openrouter provider is not wired yet — install the openai SDK and set LLM_PROVIDER=openrouter',
      )
  }
}