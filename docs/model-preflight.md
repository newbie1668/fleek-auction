# Model preflight

The live model receives sourcing text only. It must never receive a private maximum, seller reserve, current bid, or customer identifier.

Record before feature work:

1. Provider base URL, model name, protocol, timeout, and retention policy.
2. One redacted request using: `I want Grade AB branded sweatshirts and prefer getting a deal.`
3. One schema-valid response containing only controlled category IDs, minimum grade, preference, and explanation.
4. Confirmation that invalid JSON and timeouts use the labelled structured fallback.
