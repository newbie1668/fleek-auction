# Fleek Auction House — scaffold and build design

**Date:** 11 July 2026  
**Status:** Approved design awaiting written-spec review  
**Team:** Two product managers, one engineer, one design engineer  
**Primary track:** Agents & LLMs  
**Target:** A reliable, live, three-minute hackathon demonstration

This design supersedes the earlier browser-only Vite plan. The founders' briefing makes a live model interaction and a genuinely non-scripted rival bid important parts of the proof. The settlement rules remain deterministic, but inputs, agent activity, and outcomes are computed live.

## 1. Goal

Build one Fleek-style wholesale auction in which:

1. A labelled comparable dataset calculates a transparent demonstration price range.
2. A seller publishes an opening bid, private reserve, Buy Now price, and short duration.
3. A buyer describes a sourcing mandate in natural language.
4. A live model converts the mandate into displayed, schema-validated constraints for buyer approval.
5. A second browser submits a real rival bid.
6. A bounded buyer agent reacts to the changing auction state without another buyer click.
7. A deterministic server-side engine closes the auction correctly and produces a redacted audit trail.
8. Changing a reserve, maximum, or rival bid produces a different valid result without changing code.

The product claim is not that a generic LLM predicts wholesale prices. Fleek's pricing intelligence estimates where a lot should clear; Auction House turns that estimate into live demand discovery and execution.

## 2. Non-goals

The prototype will not implement:

- Fleek authentication or production APIs;
- payments, deposits, credit reservation, or checkout;
- a production pricing model or model fine-tuning;
- visual classification, video processing, sizing, authentication, or physical QC;
- persistent storage, production concurrency, fraud controls, notifications, customs, or logistics;
- more than one interactive auction;
- a public production deployment before the local demonstration is stable.

A winning order ends as **Won — pending Fleek physical QC**. No payment is processed.

## 3. Definition of the live proof

The proof is considered live only if all of the following are true:

- The buyer's natural-language mandate is sent to a server-side model during the demonstration.
- The returned object is validated and shown to the buyer before activation.
- A rival bid is entered through a separate browser session, not injected by a presenter-only simulation button.
- The buyer agent receives the resulting state change and issues an allowed action.
- The timer and auction state are authoritative on the server.
- A judge can change one input and produce a different valid result.
- The event log is generated from actual commands and state transitions.

The model, network, or provider may fail. A clearly labelled structured-form fallback keeps the product demonstrable, but the primary judging path uses the live model.

## 4. Architecture

Use a local-first TypeScript monorepo with one language and one package manager.

| Layer | Technology | Responsibility |
|---|---|---|
| Web application | Vite, React, TypeScript | Seller, marketplace, buyer, rival-buyer, and presenter launchpad views |
| HTTP server | Node.js, Express | Health check, comparable guidance, mandate parsing, demo reset, and initial session links |
| Live transport | Socket.IO | Typed commands, acknowledgements, reconnection, and role-specific snapshots |
| Contracts | TypeScript and Zod | Commands, events, snapshots, model output, and validation |
| Auction domain | Pure TypeScript | Pricing, reserve, Buy Now, expiry, winner, and event generation |
| State | In-memory server `Map` | One auction, parties, opaque demo tokens, and private mandates |
| Model adapter | OpenAI-compatible HTTP adapter | Natural-language mandate to structured policy |
| Tests | Vitest | Domain, privacy, schema, and server command tests |
| Styling | Plain CSS with tokens | Fast, dependency-light UI implementation |
| Development | tsx, concurrently, ESLint, TypeScript project references | One root dev command and one root verification command |

Use Node.js 22.12 or newer. Use npm workspaces without Turborepo, Nx, a database, or a component library.

### Repository layout

```text
fleek-auction/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── screens/
│   │   │   │   ├── DemoLaunchpad.tsx
│   │   │   │   ├── SellerScreen.tsx
│   │   │   │   ├── MarketScreen.tsx
│   │   │   │   └── BuyerScreen.tsx
│   │   │   ├── socket/
│   │   │   ├── styles/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── server/
│       ├── src/
│       │   ├── auction/
│       │   │   ├── engine.ts
│       │   │   ├── engine.test.ts
│       │   │   ├── projections.ts
│       │   │   └── projections.test.ts
│       │   ├── agent/
│       │   │   ├── decideAction.ts
│       │   │   └── decideAction.test.ts
│       │   ├── guidance/
│       │   ├── model/
│       │   │   ├── MandateParser.ts
│       │   │   ├── OpenAICompatibleMandateParser.ts
│       │   │   └── StructuredFallbackParser.ts
│       │   ├── store/
│       │   ├── sockets/
│       │   ├── app.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── auction.ts
│       │   ├── mandate.ts
│       │   ├── socketEvents.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── data/
│   └── comparables.json
├── docs/
│   ├── demo-script.md
│   ├── model-preflight.md
│   ├── product-decisions.md
│   ├── qa-checklist.md
│   └── superpowers/specs/
│       └── 2026-07-11-fleek-auction-house-scaffold-design.md
├── .env.example
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── README.md
```

No router dependency is required. The Vite application selects a screen from the URL path and a one-time bootstrap code. Each screen exchanges the bootstrap code for an opaque session token, saves the token in session storage, and immediately removes the code from the URL. The demo launchpad opens the seller, primary buyer, and rival-buyer sessions in separate tabs.

During development, Vite listens on `0.0.0.0` so a second laptop on the same network can participate. Vite proxies `/api` and `/socket.io` to the Node server, including WebSocket upgrade traffic, so browsers use one origin and the scaffold does not need CORS configuration.

Root scripts are fixed as follows:

- `npm run dev` uses `concurrently` to start the web and server workspaces.
- `npm run verify` runs lint, typecheck, tests, and production builds for every workspace.
- The server workspace uses `tsx watch` in development and `tsc` plus Node for its production build.

## 5. Authoritative data flow

1. `data/comparables.json` contains source-labelled representative rows.
2. The server filters comparables by category, grade, and broadly similar lot size, then calculates low, median, and high total-lot prices.
3. The seller browser submits auction terms to the server.
4. The server validates and publishes the auction, then broadcasts redacted snapshots.
5. The primary buyer submits natural-language intent over HTTPS.
6. The model adapter returns a structured mandate. Zod validates the output, and the buyer approves or edits it.
7. Approval activates a server-side policy. For the default `Prefer auction` policy, the agent issues one `SET_MAX_BID` command and the engine stores that maximum as a persistent proxy instruction.
8. The approved mandate and private maximum stay on the server and in that buyer's private snapshot.
9. A rival browser submits a private maximum through a typed Socket.IO command.
10. The server processes the rival command synchronously. The engine compares both persistent maxima, recalculates the visible price, and generates a real `automatic_bid` event for the leading proxy without another buyer click.
11. The agent controller observes every new sequence. It issues `BUY_NOW` or `WALK_AWAY` only when the approved policy requires it; otherwise an already-active proxy produces no duplicate command.
12. The auction engine produces events and returns a new immutable state.
13. The server generates a separate snapshot for every connected viewer and sends it individually.
14. Server time triggers expiry. The engine returns sold, unsold, or Buy Now, and the UI displays the corresponding end state.

Client code never calculates the price, chooses the winner, holds another party's private data, or calls the model provider.

## 6. Auction rules

All money is stored as integer pence. Shipping remains separate from the base auction price.

### Seller terms

- `startingPricePence`
- `reservePricePence` — seller and system only
- `buyNowPricePence`
- `incrementPence`
- `durationMs`

Validation: `starting price <= reserve price <= Buy Now price`, all values are positive integers, and the duration is between 30 and 180 seconds for the demonstration.

Seller terms and lot metadata are immutable after publish. Changing them requires a presenter reset, which creates a new auction ID, generation, and session tokens.

### Locked demonstration fixture

| Field | Value |
|---|---:|
| Lot | 50-piece Grade AB branded sweatshirt supplier lot |
| Evidence | 12 synthetic demonstration comparables |
| Fixed shipping | £48 |
| Guidance low / median / high | £560 / £640 / £720 |
| Starting bid | £520 |
| Private reserve | £620 |
| Buy Now | £760 |
| Increment | £10 |
| Duration | 90 seconds |
| Primary buyer maximum | £690 |
| Rival maximum entered in second browser | £650 |
| Expected visible price after rival | £660 |
| Expected result | Primary buyer wins at £660, pending QC |

For the changed-input proof, set the rival maximum to £710. The rival then leads at £700 and wins at expiry. These values are fixtures, not Fleek production data.

### Bid intents

Each buyer submits a private maximum. The engine exposes only the visible current price, leader status, reserve-met boolean, bid count, and redacted events.

Proxy pricing:

```text
H = highest private maximum
S = second-highest private maximum
visible price = min(H, S + increment)
visible price cannot be below the starting price
if H reaches the reserve but visible price is below it, visible price becomes the reserve
equal maxima are led by the earlier valid intent
```

For one bidder, `S` is absent and the visible price is the starting price unless that bidder's maximum reaches the reserve, in which case the visible price becomes the reserve. A maximum below the starting price is rejected. A buyer may only increase, never lower, an active maximum. Resubmitting the same maximum is idempotent and does not increase the public bid count.

Buy Now is an explicit action, not a proxy ceiling. An `auction:set-max` value equal to or above Buy Now is rejected with an instruction to lower the proxy maximum or select Buy Now. A `Prefer certainty` policy may have a total budget at or above Buy Now, but it invokes the separate Buy Now command instead of registering that amount as a proxy maximum. The visible auction price therefore never exceeds the still-available Buy Now price.

The public bid count increases when a buyer first registers a maximum or raises it. Automatic proxy repricing does not increment the count. Updating a maximum preserves the buyer's original tie priority. `WALK_AWAY` stops future agent actions but cannot withdraw or lower an already registered maximum; that maximum remains binding until close. The auction clearing price is the visible price at expiry when reserve is met.

At expiry, the auction sells only if the reserve has been met. Buy Now remains available until the auction closes and closes it immediately. Commands received after closure are rejected without changing state. Anti-sniping extensions are excluded.

Before applying every command, the server supplies authoritative `now`. If `now >= endsAt`, the engine applies expiry first and rejects the original command as closed. All commands for the auction run through one serial queue, fixing bid, Buy Now, and expiry ordering. Timer callbacks carry the auction generation and no-op if a reset has made them stale.

The reserve is structurally private, not guaranteed to be impossible to infer. A price may jump to the reserve when a maximum reaches it; the product promise is that the reserve field is never disclosed or transmitted to buyers, not that market behaviour can never reveal the threshold.

### Statuses

- `draft`
- `live`
- `sold_auction_pending_qc`
- `sold_buy_now_pending_qc`
- `ended_unsold`

## 7. Buyer mandate and agent boundary

The buyer writes sourcing intent such as:

> I want Grade AB branded sweatshirts and I prefer getting a deal over buying immediately.

The private maximum is entered in a separate numeric field. The model provider never receives the ceiling, seller reserve, current bid, or another buyer's data.

The model returns:

```json
{
  "categoryIds": ["branded_sweatshirts"],
  "minimumGrade": "AB",
  "preference": "auction",
  "explanation": "Matched branded sweatshirts at Grade AB or better."
}
```

The output must pass a strict Zod schema with unknown keys rejected. Category IDs use a fixed fixture enum and grades use the rank `A = 3`, `AB = 2`, `B = 1`; minimum `AB` therefore accepts `A` or `AB`. The model prompt lists the allowed category IDs and common aliases and may not invent a new ID. The buyer then reviews a combined policy containing the parsed sourcing constraints, their separately entered private maximum, and an explicit `Allow Buy Now` control. The ceiling covers the lot base price only; fixed shipping is displayed separately and is not part of proxy-bid arithmetic. The buyer explicitly approves the combined policy before the agent becomes active.

For `Prefer auction`, the maximum must be below Buy Now. For `Prefer certainty`, the maximum may equal or exceed Buy Now; if Buy Now is allowed and within that maximum, the agent selects Buy Now instead of registering a proxy maximum.

Every parse response includes `auctionId`, `generation`, `lotVersion`, and `parseId`. `mandate:approve` must match all four and the current session; a late response from before a reset or lot change is rejected.

The model does not calculate price guidance, hold secrets, choose the winner, or settle the auction. After approval, a deterministic `decideAgentAction` function observes the live state:

- If the auction does not match the approved category or grade, walk away.
- If Buy Now is allowed and the Buy Now price is within the private maximum, Buy Now only when the buyer has explicitly selected the `Prefer certainty` policy.
- Under `Prefer auction`, register the approved maximum once as a persistent proxy instruction.
- When a rival maximum arrives, the auction engine recalculates the visible price automatically; this is the proxy agent's bounded reaction.
- If the leading rival maximum exceeds the buyer's approved maximum, mark the agent stopped and walk away without another bid.
- Never create more than one action for the same auction event sequence.

The primary buyer policy defaults to `Prefer auction`; therefore a rival bid demonstrates a live bounded reaction rather than immediately taking Buy Now.

`decideAgentAction` receives an `AgentObservation`, never the full auction state. It contains public lot and auction fields plus only the owning buyer's approved mandate, own maximum, own leader status, and last processed sequence. It never contains the reserve amount, another buyer's maximum, or another buyer's identity.

The controller evaluates only mandate approval and externally caused auction sequences. It records the last processed sequence, ignores its own generated events, and returns `NO_ACTION` when the proxy maximum is already active. `NO_ACTION`, `WALK_AWAY`, `WON`, and `LOST` are terminal for that sequence and cannot self-trigger another evaluation.

### Model configuration

The server uses these environment variables:

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
```

The initial implementation uses an OpenAI-compatible JSON request behind the `MandateParser` interface. If event credits use a different protocol, only the adapter changes. The provider key never enters the browser bundle or logs.

## 8. Comparable guidance

The default demonstration dataset contains exactly 12 synthetic rows with:

- source label and optional source URL, required for `public_asking_price` rows and omitted for synthetic rows;
- category ID from the fixture enum;
- grade from `A`, `AB`, or `B`;
- lot size;
- total asking price in pence;
- evidence type set to `public_asking_price` or `synthetic_demo`.

For the locked fixture, a comparable must match `branded_sweatshirts`, be Grade `A` or `AB`, and contain 40–60 pieces. At least five rows are required; otherwise the result is `insufficient_evidence`. Each row is normalized to an integer per-piece price with `round(totalPricePence / lotSize)`, then scaled to the target 50-piece lot. After sorting those normalized totals, the server uses the nearest-rank 25th, 50th, and 75th percentiles. The locked rows produce £560 low, £640 median, and £720 high.

The 12 locked normalized totals in pence are `[52000, 54000, 56000, 58000, 62000, 64000, 66000, 70000, 72000, 74000, 76000, 78000]`. This list is the golden guidance fixture used by engineering, QA, and the demo script.

The UI calls this **Demo market guidance**, not an optimal, fair, guaranteed, or production Fleek price. If Fleek provides anonymised sold data, only the dataset adapter, rows, and evidence label change; the calculation and UI contract remain unchanged.

## 9. Client/server contracts

HTTP endpoints:

- `GET /api/health` — server and model-configuration status without secrets;
- `POST /api/sessions/exchange` — exchange one one-time bootstrap code for one opaque session token;
- `POST /api/demo/reset` — presenter-authorised reset returning a new auction generation and one-time session links;
- `GET /api/guidance/:lotId` — filtered guidance with evidence labels;
- `POST /api/mandates/parse` — primary-buyer-authorised live model parse of sourcing text only.

The parse request is `{ auctionId, generation, lotVersion, sourcingText }`. The response is `{ parseId, auctionId, generation, lotVersion, categoryIds, minimumGrade, preference, explanation, source: "live_model" }`. The labelled fallback returns the same shape with `source: "structured_fallback"`. Neither request nor response contains a private maximum.

Core client commands:

- `auction:publish`
- `auction:set-max`
- `auction:buy-now`
- `mandate:approve`

Core server events:

- `auction:snapshot`
- `auction:command-accepted`
- `auction:command-rejected`
- `auction:expired`
- `session:error`

Shared contract shapes are Zod-backed and exported from `packages/contracts`:

```text
BaseCommand = {
  auctionId: string,
  generation: integer,
  commandId: UUID
}

auction:publish body = BaseCommand + { lotVersion, terms }
auction:set-max body = BaseCommand + { maxPence }
auction:buy-now body = BaseCommand
mandate:approve body = BaseCommand + {
  parseId,
  lotVersion,
  categoryIds,
  minimumGrade,
  maxTotalPence,
  allowBuyNow,
  preference
}

CommandAck = {
  ok: boolean,
  code: string,
  message: string,
  sequence: integer
}
```

`AuctionSnapshot` is a discriminated union keyed by viewer role. Every variant contains `auctionId`, `generation`, `sequence`, public lot/auction state, countdown, and public events. Seller and buyer variants add only the private fields allowed by the privacy matrix.

```text
PublicAuctionView = {
  auctionId, generation, sequence, status,
  lot: { lotId, version, title, categoryId, grade, lotSize, shippingPence },
  currentPricePence, reserveMet, buyNowPricePence,
  incrementPence, bidCount, endsAtMs, serverNowMs,
  publicEvents: PublicEvent[]
}

SellerSnapshot = PublicAuctionView + {
  viewer: "seller",
  reservePricePence,
  startingPricePence
}

BuyerSnapshot = PublicAuctionView + {
  viewer: "buyer",
  ownMaxPence: number | null,
  isLeader,
  agentStatus: "inactive" | "active" | "stopped" | "won" | "lost",
  approvedMandate: ApprovedMandate | null,
  privateEvents: PrivateEvent[]
}

PublicSnapshot = PublicAuctionView + { viewer: "public" }
PresenterSnapshot = PublicAuctionView + { viewer: "presenter", modelStatus }
```

`PublicEvent` contains only `{ sequence, type, atMs, visiblePricePence?, message }`. `PrivateEvent` may additionally contain the owning buyer's own maximum or parsed policy. Event audiences are fixed when the event is created; a private event is never converted into a public event by the client.

The socket handshake binds one server-side session to one role, party, auction ID, and generation. Commands never accept a role or token in their body.

Authenticated HTTP calls use the same token in an `Authorization: Bearer` header. The server derives role, party, auction, and generation from the stored session rather than trusting request fields.

| Capability | Presenter | Seller | Primary buyer | Rival buyer | Public |
|---|---:|---:|---:|---:|---:|
| Reset and issue session links | Yes | No | No | No | No |
| Publish seller terms | No | Yes | No | No | No |
| Parse and approve a mandate | No | No | Yes | No | No |
| Set or raise own maximum | No | No | Via approved agent | Yes | No |
| Buy Now | No | No | Via approved policy | Yes | No |
| Read public state | Yes | Yes | Yes | Yes | Yes |

Every command uses a Socket.IO acknowledgement. Idempotency is keyed by `(auctionId, sessionId, commandId)` and stores a hash of the payload plus its acknowledgement. Reusing an ID with the same payload returns the stored acknowledgement; reusing it with a different payload returns `COMMAND_ID_REUSED`.

`auction:set-max` and `auction:buy-now` are evaluated atomically against current authoritative state rather than rejected merely because another event advanced the sequence. Generation, role, ownership, deadline, amount, and status preconditions are always enforced. Seller publish also requires the current lot version.

All commands pass through one serial dispatcher. Before each transition the dispatcher applies expiry when `now >= endsAt`. A 250 ms timer checks expiry and emits countdown snapshots at most once per second. Timer callbacks contain the generation and no-op after reset.

The mandate parser and comparable-guidance endpoints use HTTP because they are request/response operations rather than continuous auction events. Acknowledgements, rejected commands, model errors, reconnect payloads, session errors, and logs use redacted schemas and never echo a reserve or private maximum.

## 10. Screens

### Demo launchpad

A clearly labelled presenter-only screen creates or resets the fixture and provides separate links for:

- seller;
- primary buyer;
- rival buyer.

It also provides an optional fourth read-only public-market link, but the judged path requires only the three interactive sessions above.

At server startup, the terminal prints one local presenter launch URL containing a single-use bootstrap code. After exchange, the launchpad displays model connectivity, server connectivity, and the current auction ID. It never contains a button that secretly injects a rival bid.

### Seller

- Structured lot card and evidence label.
- Live comparable range.
- Inputs for starting bid, private reserve, Buy Now, and duration.
- Clear public/private labels.
- Publish button and seller-private outcome.

### Public market

- One interactive auction card plus at most two clearly labelled static example cards.
- Current visible bid, reserve-met status, bid count, Buy Now, and countdown.
- No reserve amount, buyer maximum, buyer identity, or presenter control.

### Buyer

- Lot facts and public auction state.
- Natural-language mandate field.
- Parsed-policy confirmation card.
- Private maximum and agent status visible only to that buyer.
- Real bid/Buy Now actions for the rival buyer.
- Public and buyer-private activity tabs.

### End state

- `Won at auction — pending Fleek physical QC`
- `Won via Buy Now — pending Fleek physical QC`
- `Auction ended without a sale — private reserve not met`
- `Hackathon demonstration — payment not processed`

## 11. Privacy model

There is no production authentication. The server issues opaque, random demo session tokens and stores them in memory. Each browser exchanges a single-use bootstrap code, removes it from the URL, stores only its own token in session storage, and passes it during the Socket.IO handshake. Every token is bound to one role, party, auction ID, and generation.

Server projections are mandatory:

| Field | Seller | Public | Owning buyer | Rival buyer |
|---|---:|---:|---:|---:|
| Starting/current price | Yes | Yes | Yes | Yes |
| Reserve amount | Yes | No | No | No |
| Reserve-met status | Yes | Yes | Yes | Yes |
| Buy Now | Yes | Yes | Yes | Yes |
| Buyer's own maximum | No | No | Yes | No |
| Rival maximum | No | No | No | Yes, only when it is their own |
| Public events | Yes | Yes | Yes | Yes |
| Buyer-private events | No | No | Yes | Own events only |

The server sends each socket an individually generated snapshot. It does not broadcast a full state object and rely on the clients to hide fields.

Reset cancels the active timer, creates a new auction ID and generation, clears command/idempotency records, invalidates every old role token, and disconnects old sockets with `SESSION_EXPIRED`. Expired screens show a link back to the launchpad; the presenter opens the new session links for the next run.

## 12. Failure handling

| Failure | Behaviour |
|---|---|
| Model timeout after 8 seconds, invalid JSON, or unavailable provider | Show a precise error and offer the labelled structured fallback form. Do not present fallback output as model-generated. |
| Socket disconnect | Automatically reconnect, rejoin with the session token, and request the complete latest snapshot. |
| Old auction generation or expired session | Reject with `SESSION_EXPIRED` and return the launchpad route; never apply the command to the new fixture. |
| Duplicate command ID and identical payload | Return the stored acknowledgement without applying it again. |
| Duplicate command ID and changed payload | Reject with `COMMAND_ID_REUSED`. |
| Invalid seller terms or buyer maximum | Reject without state mutation and show a field-specific message. |
| Command after close | Reject with `AUCTION_CLOSED`. |
| Server restart | Create a fresh fixture and tokens; old tabs receive `SESSION_EXPIRED` and return to the launchpad. |
| No relevant comparables | Show `Insufficient comparable evidence` and allow the seller to set terms without guidance. |

All errors are visible in the owning view and useful in the server console. Secrets, reserve amounts, and private maxima are redacted from server logs.

## 13. Testing and verification

### Automated tests

Auction engine:

- valid publish;
- first maximum below and above reserve;
- maximum below starting price rejected;
- maximum equal to or above Buy Now rejected;
- same maximum idempotent, higher maximum accepted, lower maximum rejected;
- lower and higher rival maximum;
- equal-maximum tie;
- reserve miss and reserve hit;
- Buy Now;
- expiry immediately before, exactly at, and after `endsAt`;
- stale timer generation after reset;
- command after closure;
- duplicate command ID with the same and a different payload;
- complete proxy lifecycle from activation through rival bid and expiry.

Privacy projections:

- public snapshots contain no reserve or private maximum;
- seller snapshots contain no buyer maximum;
- buyer snapshots contain only that buyer's maximum and events;
- public events contain no private identity or amount;
- acknowledgements, errors, reconnect responses, model errors, and logs contain no unauthorised private field, including nested objects.

Sessions and capabilities:

- unknown, expired, wrong-role, and wrong-auction tokens;
- presenter-only reset;
- seller-only publish;
- primary-buyer-only mandate approval;
- each buyer can change only its own maximum;
- reset invalidates tokens and idempotency records.

Model and agent:

- valid mandate;
- malformed JSON;
- unknown model keys rejected;
- invalid category or grade rejected;
- missing or non-integer private ceiling rejected during approval;
- late parse from an old lot version or generation rejected;
- category mismatch;
- prefer-auction path;
- prefer-certainty path;
- maximum exceeded;
- duplicate event sequence;
- two full auction states with the same `AgentObservation` produce the same action even when their hidden reserve or rival maximum differs.

Comparable guidance:

- filtering;
- per-piece normalization and integer nearest-rank percentiles;
- empty and insufficient evidence;
- correct evidence labels.

### Golden lifecycle

The baseline automated and manual scenario must produce this order:

1. `published` — visible price £520.
2. Private `mandate_parsed` and `mandate_approved` for the primary buyer.
3. `maximum_registered` — primary buyer ceiling £690 stored privately; public price becomes £620 and `reserve_met` is emitted.
4. Rival browser registers £650 — public `bid_received` followed by `automatic_bid`; primary buyer remains leader at £660.
5. `expired` followed by `sold_auction_pending_qc` at £660.

In the changed-input scenario, the rival registers £710 at step 4, becomes leader at £700, and wins at £700. Automatic proxy repricing does not create a second maximum-registration command.

### Manual acceptance

- Start from a clean server and open seller, buyer, and rival sessions.
- Complete the primary auction path twice.
- Change the reserve or rival maximum and prove the outcome changes.
- Disconnect and reconnect one buyer tab.
- Run the model path once and the labelled fallback once.
- Inspect public Socket.IO payloads and logs for private values.
- If the P1 Buy Now UI ships, complete that path once.

Before submission, record a backup demonstration after the local path succeeds twice.

## 14. Four-person ownership

### Engineer — system owner

Owns:

- contracts and schemas;
- server and session tokens;
- pure auction engine and tests;
- Socket.IO command processing;
- privacy projections;
- model adapter and agent policy;
- root workspace configuration and server-side integration support.

The engineer does not own CSS polish, research, pitch writing, or the comparable dataset.

### Design engineer — experience owner

Owns:

- Vite/React application;
- design tokens and reusable components;
- launchpad, seller, market, and buyer screens;
- socket-driven loading, success, error, and reconnect states;
- the browser Socket.IO adapter and typed mock snapshots;
- public/private labels and activity log;
- responsive layout, accessibility, and restrained animation.

The design engineer begins against typed mock snapshots and replaces the mock transport with the socket client after the contract freezes.

### Product PM — rules and evidence owner

Owns:

- immediate questions to Fleek mentors;
- auction rule decisions and acceptance criteria;
- source-labelled comparable rows;
- public customer evidence and problem validation;
- privacy matrix review;
- keeping P0/P1/P2 scope explicit.

This PM must answer product questions quickly enough that the engineer never waits for policy decisions.

The Product PM defines expected behaviour and acceptance criteria. The Demo PM executes those criteria, records results, and owns the defect log; neither duplicates the other's document.

### Demo PM — execution and judging owner

Owns:

- ninety-second and three-minute demo scripts;
- judge-objection answers;
- end-to-end QA checklist and defect log;
- timekeeping and feature-freeze enforcement;
- submission copy, screenshots, and backup recording;
- keeping the product story aligned with the four judging criteria.

This PM continuously rehearses against the latest working build rather than waiting for visual polish.

### File ownership and integration

- The engineer owns `apps/server/`, `packages/contracts/`, root configuration, and all contract changes.
- The design engineer owns `apps/web/` and consumes the frozen contracts.
- The Product PM owns `data/comparables.json` and `docs/product-decisions.md`.
- The Demo PM owns `docs/demo-script.md` and `docs/qa-checklist.md`.
- Only the engineer changes `packages/contracts/` after contract freeze.
- Use short-lived `engine/core` and `design/ui` branches, integrate at least every 45 minutes, and keep `main` demonstrable.

### Model readiness gate

Within the first 30 minutes, the Product PM obtains the model base URL, key, model name, protocol, and retention information. The engineer runs one live parse using sourcing text with no private ceiling and saves a redacted request/response in `docs/model-preflight.md`. If no valid live response exists by 90 minutes, development continues against the same `MandateParser` interface with the labelled fallback; the Demo PM must not describe that fallback as a live model call.

## 15. Working schedule

| Window | Engineer | Design engineer | Product PM | Demo PM |
|---|---|---|---|---|
| First 30 minutes | Contracts, root scaffold, model preflight | App shell and typed mock screens from this spec | Verify locked rules; secure model/data access | Convert golden lifecycle into QA and demo steps |
| 30–90 minutes | Engine tests, state store, Socket.IO | Seller and buyer core views | Add evidence provenance without changing schemas | Copy, objections, and live QA |
| 90–150 minutes | Mandate parser, agent loop, rival flow | Replace mocks with live socket data | Verify calculations and privacy | First end-to-end rehearsal |
| Afternoon core | Expiry, Buy Now, reconnect, errors | Activity log, end states, accessibility | Mentor validation and scope decisions | Repeated QA and narration |
| Feature freeze | Fix only | Fix only | Validate only | Record, rehearse, and submit |

The locked fixture, mandate schema, role capabilities, privacy matrix, and golden lifecycle in this document are the inputs to contract freeze after 30 minutes. A later mentor answer changes a contract only when the Product PM records the decision and the engineer versions the contract; the design engineer never edits the contract independently. Feature freeze occurs no later than 16:30.

## 16. Priority and cut order

### P0

- Contracts and pure engine.
- Engine tests for Buy Now and reserve hit/miss even though their extra UI scenarios are not required in the primary demo.
- One lot and comparable guidance.
- Seller publish.
- Live mandate parse and approval.
- Real second-browser rival maximum.
- Automatic buyer-agent reaction.
- Server expiry and one correct end state.
- Role-specific privacy projections.
- Basic Socket.IO reconnect and latest-snapshot recovery.
- Reset and changed-input rerun.

### P1

- Buy Now UI scenario.
- Reserve-miss UI scenario.
- Reconnect-state visual polish.
- Rich comparable explanation.

### P2

- Static feed cards.
- Video or vision analysis.
- Deployment.
- More lots or users.

Cut P2 first, then visual motion, then the reserve-miss scenario. Never cut server authority, privacy projection tests, the real rival browser, or the live mandate parse from the primary proof.

### Submission readiness

- Core P0 path passes twice from fresh session links.
- Any shipped P1 path is rehearsed once.
- A backup recording, screenshots, submission copy, and model-fallback disclosure are complete.

## 17. Definition of done

The scaffold and P0 core workflow are ready when:

- one root command starts web and server development processes;
- one root verification command runs lint, typecheck, tests, and builds;
- three browser sessions interact with one authoritative auction;
- the live model produces a validated mandate and the buyer approves it;
- the bounded agent reacts to a real rival event;
- reserve and maximum values never appear in unauthorised snapshots or logs;
- the timer closes to the correct result;
- changing one input changes the outcome without code changes;
- all simulated and representative elements are explicitly labelled;
- the local demonstration completes twice from a clean reset and newly issued session links.

Submission is ready only when the backup recording and submission materials in the preceding checklist also exist.

## 18. Resolved design decisions

- TypeScript end-to-end is preferred over a Python service because the team has only one engineer and one design engineer.
- A small server is required; a browser-only build cannot protect keys or private auction data and cannot prove a real rival session.
- Socket.IO is preferred over raw WebSockets for typed events, acknowledgement, broadcasting, and reconnection.
- State is intentionally in memory; persistence would add risk without strengthening the proof.
- The model parses intent; deterministic code handles transaction rules.
- The primary policy prefers auction so the live rival event remains visible.
- Physical QC and payment occur after the demonstrated market-clearing step and are not implemented.
- The local build is the source of truth. Hosting is a stretch task after feature freeze, not a dependency for judging.
