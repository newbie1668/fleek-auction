# Fleek Auction House — working demo design

**Date:** 11 July 2026

**Status:** Conversational design approved; awaiting written-spec review

**Timebox:** Two-hour working-demo build

**Primary track:** Agents & LLMs

## 1. Purpose and authority

This specification turns the verified repository scaffold into one working, server-authoritative auction demonstration. It extends `2026-07-11-fleek-auction-house-scaffold-design.md` and uses `outputs/fleek-auction-house-ui.html` plus its seller, market, and buyer PNGs as the visual reference.

Where the earlier design requires a live model as the primary judging path, this timeboxed build first guarantees an explicitly labelled structured fallback behind the same parser interface. An OpenAI-compatible live adapter activates only when all three model environment variables are configured. The product must never describe fallback output as a live model result.

The older browser-only implementation plan remains superseded. Its colours, layout, copy, and artwork are reusable; its hard-coded auction JavaScript, simulated rival command, presenter-forced close, and duplicated private values are not.

## 2. Goal

Deliver a resettable multi-browser demonstration in which:

1. A seller publishes one wholesale lot with protected terms.
2. A buyer submits sourcing text and reviews a schema-valid parsed mandate.
3. The buyer separately approves a private maximum.
4. A real rival browser submits its own private maximum.
5. A deterministic proxy auction recalculates the visible price without another primary-buyer click.
6. The server timer closes to the correct winner and clearing price.
7. Buy Now provides a second complete path.
8. Every browser receives only the public and private data permitted for its role.

The demonstration proves that Fleek can replace asynchronous offer negotiation with bounded, live price discovery. It does not claim that the fallback parser or synthetic comparable data is production Fleek intelligence.

## 3. Locked fixture

| Field | Value |
|---|---:|
| Lot | 50-piece Grade AB Branded Sweatshirt Lot |
| Listing type | Exact bundle |
| Supplier | Thrift Kings Wholesale |
| Fixed shipping | £48 |
| Comparable evidence | 12 synthetic demonstration rows |
| Guidance low / median / high | £560 / £640 / £720 |
| Starting bid | £520 |
| Private reserve | £620 |
| Buy Now | £760 |
| Increment | £10 |
| Default duration | 90 seconds |
| Primary buyer maximum | £690 |
| Baseline rival maximum | £650 |
| Baseline result | Primary buyer wins at £660 |
| Alternate rival maximum | £710 |
| Alternate result | Rival buyer wins at £700 |

All money is represented as integer pence. Shipping is displayed separately and excluded from proxy-bid arithmetic. Outcomes are pending Fleek physical QC, and no payment is processed.

## 4. Scope

### Included

- one interactive auction and two clearly labelled static market cards;
- presenter launchpad and reset;
- separate seller, public-market, primary-buyer, and rival-buyer browser sessions;
- seller terms and comparable guidance;
- deterministic proxy bidding, reserve handling, Buy Now, and expiry;
- structured mandate parsing with optional live-model activation;
- buyer policy approval with a separately entered private maximum;
- role-specific snapshots and public/private activity logs;
- reconnect to the latest snapshot;
- baseline, alternate-rival, and Buy Now paths;
- desktop-first responsiveness for ordinary laptop widths.

### Excluded

- Fleek production APIs or authentication;
- database persistence;
- payments, deposits, credits, or checkout;
- production pricing, model training, fraud, notifications, customs, or logistics;
- physical QC implementation;
- more than one live auction;
- production concurrency guarantees;
- deployment before the local demonstration is stable;
- mobile-specific polish beyond a usable stacked layout.

## 5. Architecture

The existing npm workspace remains:

- `packages/contracts`: strict Zod schemas and shared TypeScript transport types;
- `apps/server`: Express, Socket.IO, pure auction domain, in-memory runtime, guidance, and mandate parser;
- `apps/web`: Vite, React, typed Socket.IO client, role screens, and plain CSS.

The server owns auction state, timing, authorization, pricing, settlement, mandates, private maxima, and projections. Clients submit commands and render snapshots. Client code never calculates a price, chooses a winner, holds another party's private data, or calls a model provider.

One in-memory runtime contains one auction generation, role sessions, command-idempotency records, approved mandates, expiry timer, and connected sockets. Restarting the server intentionally resets the demo.

## 6. Sessions and routes

At startup the server prints one `/demo?code=...` presenter URL. The presenter exchanges that one-time code for a demo-scoped presenter token. `/demo` is the presenter launchpad, and its authorised Reset action creates a new auction ID and generation and returns one-time links for:

- `/seller?code=...`;
- `/buyer?code=...` for the primary buyer;
- `/rival?code=...` for the rival buyer;
- `/market?code=...` for a public read-only session.

Each browser exchanges its one-time code for an opaque session token, removes the code from the URL, stores only its token in session storage, and uses the token for HTTP authorization and the Socket.IO handshake. Seller, buyer, rival, and public sessions are bound to one role, party, auction, and generation. The presenter token is bound to the local demo runtime and survives Reset so the launchpad can issue the next set of role links.

Reset cancels the old timer, clears idempotency records, invalidates old auction-role sessions, and disconnects their sockets with `SESSION_EXPIRED`. Expired screens link back to `/demo`. Only the presenter token can invoke Reset.

This is demo isolation, not production authentication.

## 7. Auction engine

The pure engine accepts explicit state, command, and server time. It performs no I/O, random generation, timers, or logging.

Publish accepts positive integer-pence terms only, requires `starting price <= reserve price <= Buy Now price`, and requires a duration from 30 through 180 seconds.

Statuses:

- `draft`;
- `live`;
- `sold_auction_pending_qc`;
- `sold_buy_now_pending_qc`;
- `ended_unsold`.

Proxy pricing:

```text
H = highest private maximum
S = second-highest private maximum
visible = min(H, S + increment)
visible cannot be below the starting price
if H reaches reserve and visible is below reserve, visible becomes reserve
equal maxima are led by the earlier valid maximum
```

A maximum below the starting bid or at/above Buy Now is rejected. A buyer can raise but not lower an active maximum. Repeating the same maximum is idempotent. Automatic repricing does not increment the public bid count.

Buy Now is a separate command. It remains available until close, closes once at £760, and rejects all later commands.

Before every command, the runtime applies expiry when `now >= endsAtMs`. Expiry sells at the current visible price only when reserve is met; otherwise it ends unsold. A 250 ms runtime timer checks expiry and emits countdown updates at most once per second. No anti-sniping extension is included.

## 8. Mandate and bounded agent

The primary buyer enters sourcing text:

> I want Grade AB branded sweatshirts and I prefer getting a deal over buying immediately.

The parser returns only:

```json
{
  "categoryIds": ["branded_sweatshirts"],
  "minimumGrade": "AB",
  "preference": "auction",
  "explanation": "Matched branded sweatshirts at Grade AB or better.",
  "source": "structured_fallback"
}
```

Unknown keys and unsupported categories, grades, or preferences are rejected. The private maximum is entered separately and never sent to the parser. The parser never receives reserve, current bid, another buyer's data, or a customer identifier.

When `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` are all present, the server may use the OpenAI-compatible adapter with an eight-second timeout and the same strict output schema. Otherwise it returns the deterministic locked-fixture object above with `source: "structured_fallback"`. The fallback label states that no LLM interpreted the sourcing text, and the buyer must confirm the structured category, grade, and preference before approval. The UI shows `Live model` or `Structured fallback` beside the result.

After the buyer approves the parsed mandate and £690 ceiling, deterministic policy code registers that maximum once. A rival change causes the engine to reprice automatically. The event log records the rival bid and automatic proxy response. The model does not calculate guidance, bid amounts, winners, or settlement.

## 9. Transport and projections

HTTP endpoints:

- `GET /api/health`;
- `POST /api/demo/reset`;
- `POST /api/sessions/exchange`;
- `GET /api/guidance/:lotId`;
- `POST /api/mandates/parse`.

Socket commands:

- `auction:publish`;
- `auction:set-max`;
- `auction:buy-now`;
- `mandate:approve`.

Server events:

- `auction:snapshot`;
- `session:error`.

Every command uses a UUID, strict schema validation, role checks, and an acknowledgement. Reusing a command ID with the identical payload returns its stored acknowledgement; reusing it with a changed payload returns `COMMAND_ID_REUSED`.

Every socket receives an individually generated snapshot:

- public: public auction fields and public events only;
- seller: public data plus starting price and private reserve;
- buyer: public data plus that buyer's own maximum, leader state, agent state, approved mandate, and private events;
- presenter: public data plus model and session status.

The server never broadcasts a complete private state and relies on the browser to hide it.

## 10. User interface

The output HTML and PNGs define the visual direction. The React implementation reuses:

- paper, ink, yellow, violet, green, and amber colour tokens;
- Fleek header and hackathon badge;
- rounded white cards and compact chips;
- inline garment illustrations;
- seller guidance and auction-term layout;
- three-card market layout;
- buyer auction panel, proxy card, and activity log;
- public/private labelling and restrained toast feedback.

The following behaviour changes are mandatory:

- editable fields must drive server commands instead of duplicated constants;
- the seller summary must reflect entered terms;
- market price and reserve state must come from the same snapshot;
- the buyer maximum displayed must be the submitted value;
- closed auctions disable later controls;
- activity tabs show their correct audience without leaking private content;
- SVG artwork must not erase badges;
- no button may secretly create a rival bid or force settlement.

### Presenter launchpad

Shows server/model status, current auction ID, reset, and role links. It may provide a copy/open action for each link. It does not inject bids or close the auction.

### Seller

Shows the exact lot, labelled guidance, editable start/reserve/Buy Now/duration, live summary, reserve privacy explanation, validation errors, and publish outcome.

### Market

Shows the one live card plus two static `Demo listing` cards. The live card exposes only current price, reserve-met status, bid count, Buy Now, and countdown.

### Primary buyer

Shows lot facts, live public state, sourcing-text parser, parsed-policy review, separate maximum, agent status, Buy Now, and public/private activity tabs.

### Rival buyer

Uses the buyer visual frame but replaces mandate approval with a direct private-maximum form and Buy Now. It never shows the primary buyer's identity or maximum.

### Responsive behaviour

The three-column buyer and two-column seller layouts remain the desktop reference. Below 980 px they stack into one column, navigation wraps, the presenter controls wrap, and no `min-width: 1180px` constraint remains. Pixel-perfect mobile polish is not required.

## 11. Failure handling

- Invalid terms or maximum: field-specific rejection with no state mutation.
- Model unavailable, timeout, or invalid output: show the failure and permit the labelled fallback.
- Socket disconnect: show reconnecting, reconnect with the session token, and render the latest complete snapshot.
- Expired session or reset generation: show `SESSION_EXPIRED` and link to `/demo`.
- Duplicate changed command: show `COMMAND_ID_REUSED`.
- Post-close command: show `AUCTION_CLOSED`.
- Server restart: create a fresh fixture; old sessions expire.
- No matching comparable evidence: show `Insufficient comparable evidence` and allow manual terms.

Errors and server logs never echo a private reserve, maximum, token, or provider credential.

## 12. Verification

Automated coverage must include:

- engine validation, reserve hit/miss, baseline £660 outcome, alternate £700 outcome, ties, Buy Now, exact expiry boundary, and post-close rejection;
- public/seller/buyer projection privacy;
- guidance filtering and locked £560/£640/£720 output;
- strict mandate schema and fallback source label;
- session capability checks, reset invalidation, command idempotency, and reconnect snapshot;
- three real Socket.IO clients completing the baseline lifecycle;
- route, transport-status, and request-ID helpers already present in the web workspace.

Manual acceptance must prove:

1. Seller, primary buyer, rival buyer, and market open from fresh links.
2. Baseline £690/£650 path closes at £660.
3. Alternate £690/£710 path closes at £700.
4. Buy Now closes once at £760.
5. Public payloads contain no reserve or private maximum.
6. One browser reconnects to the latest state.
7. The UI clearly states whether parsing used a live model or fallback.
8. `npm run verify` passes lint, typecheck, tests, and every build.

## 13. Parallel implementation boundaries

The contract surface is frozen before parallel feature work.

- Contracts/engine owner: `packages/contracts` and `apps/server/src/auction`.
- Runtime owner: server sessions, dispatcher, parser, guidance, HTTP, and Socket.IO composition.
- UI owner: `apps/web`, consuming frozen snapshot fixtures before live integration.
- Integration owner: `apps/server/src/app.ts`, root configuration, package lock, final verification, and live smoke test.

Only the integration owner edits shared hot files during parallel work. Each unit receives focused tests before integration.

## 14. Cut order

If time becomes constrained:

1. Keep the pure engine, privacy projections, real rival session, fallback parser, server expiry, reset, and baseline outcome.
2. Keep Buy Now because it is already present in the approved visual and product promise.
3. Cut richer reconnect animation and comparable explanation.
4. Cut the two static market cards.
5. Do not replace the real rival with a simulated presenter button.
6. Do not move pricing or private state into the browser.

## 15. Definition of done

The working demo is complete when:

- one root command starts the server and web app;
- four browser roles interact with one authoritative auction;
- the visual treatment clearly matches the existing output screens;
- seller terms, buyer policy, and rival maximum change live server state;
- baseline, alternate, and Buy Now outcomes are correct;
- private fields remain absent from unauthorised snapshots and logs;
- reset issues a fresh generation and new session links;
- fallback parsing works without credentials and is labelled honestly;
- the live adapter can activate without client changes when credentials are supplied;
- all automated verification and the multi-browser smoke test pass.

Model credentials and Fleek-provided production data remain external readiness items, not blockers for this working-demo build.
