import type { MandateParseRequest, MandateParseResponse, ModelMandateOutput } from '@fleek/contracts'

export interface MandateParser {
  parse(request: MandateParseRequest): Promise<MandateParseResponse>
}

export function createParseId(): string {
  return crypto.randomUUID()
}

export function buildParseResponse(
  request: MandateParseRequest,
  output: ModelMandateOutput,
  source: MandateParseResponse['source'],
  parseId = createParseId(),
): MandateParseResponse {
  return {
    parseId,
    auctionId: request.auctionId,
    generation: request.generation,
    lotVersion: request.lotVersion,
    categoryIds: output.categoryIds,
    minimumGrade: output.minimumGrade,
    preference: output.preference,
    explanation: output.explanation,
    source,
  }
}
