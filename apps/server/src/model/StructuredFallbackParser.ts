import { ModelMandateOutputSchema, type MandateParseRequest } from '@fleek/contracts'
import {
  buildParseResponse,
  type MandateParser,
} from './MandateParser.js'

export class StructuredFallbackParser implements MandateParser {
  async parse(request: MandateParseRequest) {
    const text = request.sourcingText.toLowerCase()
    const prefersCertainty =
      text.includes('buy now') ||
      text.includes('immediately') ||
      text.includes('certainty') ||
      text.includes('right away')

    const output = ModelMandateOutputSchema.parse({
      categoryIds: ['branded_sweatshirts'],
      minimumGrade: text.includes('grade a') && !text.includes('grade ab') ? 'A' : 'AB',
      preference: prefersCertainty ? 'certainty' : 'auction',
      explanation:
        'Structured fallback matched branded sweatshirts at Grade AB or better from the sourcing text.',
    })

    return buildParseResponse(request, output, 'structured_fallback')
  }
}
