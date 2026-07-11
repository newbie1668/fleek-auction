import { ModelMandateOutputSchema, type MandateParseRequest } from '@fleek/contracts'
import {
  buildParseResponse,
  type MandateParser,
} from './MandateParser.js'
import { StructuredFallbackParser } from './StructuredFallbackParser.js'

export class OpenAICompatibleMandateParser implements MandateParser {
  private readonly fallback = new StructuredFallbackParser()

  constructor(
    private readonly config: {
      baseUrl: string
      apiKey: string
      model: string
      timeoutMs?: number
    },
  ) {}

  async parse(request: MandateParseRequest) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8_000)

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Extract a wholesale sourcing mandate. Return strict JSON with keys categoryIds, minimumGrade, preference, explanation. categoryIds must be chosen from branded_sweatshirts, branded_denim, branded_outerwear. minimumGrade must be A, AB, or B. preference must be auction or certainty. Never invent other category IDs.',
            },
            {
              role: 'user',
              content: request.sourcingText,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Model HTTP ${response.status}`)
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = payload.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Model returned empty content')
      }

      const output = ModelMandateOutputSchema.parse(JSON.parse(content))
      return buildParseResponse(request, output, 'live_model')
    } catch {
      return this.fallback.parse(request)
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createMandateParser(): MandateParser {
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL

  if (baseUrl && apiKey && model) {
    return new OpenAICompatibleMandateParser({ baseUrl, apiKey, model })
  }

  return new StructuredFallbackParser()
}
