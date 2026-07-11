# Fleek Auction House Working Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified transport scaffold into a working, resettable, multi-browser wholesale auction using the approved Fleek UI and a server-authoritative proxy engine.

**Architecture:** Freeze strict shared contracts first. Build a pure auction engine and privacy projections, an in-memory runtime with sessions/model fallback/timers, and the React role screens as isolated units; then compose them through Express and Socket.IO and prove the full lifecycle with real clients and browsers. The server alone owns private values, pricing, settlement, and time.

**Tech Stack:** Node.js 22.12+, npm workspaces, TypeScript 6, Zod 4, Express 5, Socket.IO 4, Vite 8, React 19, plain CSS, Vitest 4.

## Global Constraints

- Continue on the existing `scaffold` branch and preserve the draft PR.
- Use the visual structure, tokens, copy, and inline garment art from `outputs/fleek-auction-house-ui.html`; do not port its inline auction JavaScript.
- Use integer pence for all money. Shipping is displayed separately and excluded from auction arithmetic.
- Lock the fixture at £520 start, £620 reserve, £760 Buy Now, £10 increment, 90 seconds, £690 primary maximum, and £650 baseline rival maximum.
- The baseline must close at £660; a £710 rival must close at £700; Buy Now must close once at £760.
- The model receives sourcing text only. The private maximum, reserve, current bid, party identity, and tokens never enter a model request.
- Fallback output must be labelled `Structured fallback` and state that no LLM interpreted the text.
- The server sends individually projected role snapshots; no client receives a complete private state and hides fields locally.
- No database, production authentication, payment, Fleek API, component library, router, or new state-management dependency.
- Keep existing health/ping behaviour and the root `npm run verify` command green.
- No button may simulate a rival bid or force auction settlement.

## Execution graph

1. Task 1 freezes contracts on `scaffold`.
2. After Task 1, Task 2 (server domain) and Tasks 7–8 (web client/UI) may run in parallel in isolated worktrees created from the same contract-freeze commit.
3. Tasks 3–6 complete the backend pure services, runtime, and integration after Task 2.
4. Task 9 integrates the backend and UI commits, runs the full live smoke, and updates the draft PR.

Only the integration owner edits `packages/contracts/src/index.ts`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, root package files, or `package-lock.json` after contract freeze.

---

### Task 1: Freeze auction, mandate, session, and transport contracts

**Files:**
- Create: `packages/contracts/src/system.ts`
- Create: `packages/contracts/src/auction.ts`
- Create: `packages/contracts/src/mandate.ts`
- Create: `packages/contracts/src/sessions.ts`
- Create: `packages/contracts/src/guidance.ts`
- Create: `packages/contracts/src/socket-events.ts`
- Create: `packages/contracts/src/demo-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: the existing `HealthStatusSchema`, `PingRequestSchema`, and `PingAckSchema`.
- Produces: strict schemas and inferred types for auction commands, acknowledgements, snapshots, mandates, guidance, sessions, and Socket.IO events.

- [ ] **Step 1: Write failing contract tests for strict commands and privacy-safe snapshots**

Create `packages/contracts/src/demo-contracts.test.ts` with these concrete cases:

```ts
import { describe, expect, it } from 'vitest'
import {
  AuctionSnapshotSchema,
  CommandAckSchema,
  MandateParseRequestSchema,
  PublishCommandSchema,
  SessionExchangeRequestSchema,
} from './index.js'

const scope = {
  auctionId: 'auction-1',
  generation: 1,
  commandId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
}

describe('working-demo contracts', () => {
  it('accepts the locked seller terms', () => {
    const command = PublishCommandSchema.parse({
      ...scope,
      lotVersion: 1,
      terms: {
        startingPricePence: 52_000,
        reservePricePence: 62_000,
        buyNowPricePence: 76_000,
        incrementPence: 1_000,
        durationMs: 90_000,
      },
    })
    expect(command.terms.reservePricePence).toBe(62_000)
  })

  it('rejects private values in a mandate parse request', () => {
    expect(() =>
      MandateParseRequestSchema.parse({
        auctionId: 'auction-1',
        generation: 1,
        lotVersion: 1,
        sourcingText: 'Grade AB branded sweatshirts',
        maxTotalPence: 69_000,
      }),
    ).toThrow()
  })

  it('rejects unknown fields in a public snapshot', () => {
    expect(() =>
      AuctionSnapshotSchema.parse({
        viewer: 'public',
        auctionId: 'auction-1',
        generation: 1,
        sequence: 0,
        status: 'draft',
        lot: {
          lotId: 'sweatshirt-lot',
          version: 1,
          title: '50-piece Grade AB Branded Sweatshirt Lot',
          categoryId: 'branded_sweatshirts',
          grade: 'AB',
          lotSize: 50,
          shippingPence: 4_800,
          listingType: 'exact_bundle',
        },
        currentPricePence: 52_000,
        reserveMet: false,
        buyNowPricePence: 76_000,
        incrementPence: 1_000,
        bidCount: 0,
        endsAtMs: null,
        serverNowMs: 1_000,
        publicEvents: [],
        reservePricePence: 62_000,
      }),
    ).toThrow()
  })

  it('requires a UUID session bootstrap code', () => {
    expect(() => SessionExchangeRequestSchema.parse({ code: 'short' })).toThrow()
  })

  it('accepts a redacted rejected acknowledgement', () => {
    const ack = CommandAckSchema.parse({
      ok: false,
      code: 'AUCTION_CLOSED',
      message: 'The auction is closed.',
      sequence: 7,
    })
    expect(ack.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the contract test and capture RED**

Run:

```bash
npm run test -w @fleek/contracts -- demo-contracts.test.ts
```

Expected: FAIL because the new schemas are not exported.

- [ ] **Step 3: Define the auction contracts**

Create `packages/contracts/src/auction.ts` with these exact public shapes:

```ts
import { z } from 'zod'
import { ApprovedMandateSchema } from './mandate.js'

export const AuctionScopeSchema = z.object({
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
}).strict()

export const BaseCommandSchema = AuctionScopeSchema.extend({
  commandId: z.string().uuid(),
}).strict()

export const LotSchema = z.object({
  lotId: z.literal('sweatshirt-lot'),
  version: z.literal(1),
  title: z.literal('50-piece Grade AB Branded Sweatshirt Lot'),
  categoryId: z.literal('branded_sweatshirts'),
  grade: z.literal('AB'),
  lotSize: z.literal(50),
  shippingPence: z.literal(4_800),
  listingType: z.literal('exact_bundle'),
}).strict()

export const AuctionTermsSchema = z.object({
  startingPricePence: z.number().int().positive(),
  reservePricePence: z.number().int().positive(),
  buyNowPricePence: z.number().int().positive(),
  incrementPence: z.number().int().positive(),
  durationMs: z.number().int().min(30_000).max(180_000),
}).strict().superRefine((terms, context) => {
  if (terms.startingPricePence > terms.reservePricePence) {
    context.addIssue({ code: 'custom', path: ['reservePricePence'], message: 'Reserve must be at or above the starting price.' })
  }
  if (terms.reservePricePence > terms.buyNowPricePence) {
    context.addIssue({ code: 'custom', path: ['buyNowPricePence'], message: 'Buy Now must be at or above the reserve.' })
  }
})

export const PublishCommandSchema = BaseCommandSchema.extend({
  lotVersion: z.literal(1),
  terms: AuctionTermsSchema,
}).strict()

export const SetMaxCommandSchema = BaseCommandSchema.extend({
  maxPence: z.number().int().positive(),
}).strict()

export const BuyNowCommandSchema = BaseCommandSchema

export const AuctionStatusSchema = z.enum([
  'draft',
  'live',
  'sold_auction_pending_qc',
  'sold_buy_now_pending_qc',
  'ended_unsold',
])

export const PublicEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  type: z.enum(['published', 'bid_received', 'reserve_met', 'automatic_bid', 'expired', 'sold_auction_pending_qc', 'sold_buy_now_pending_qc', 'ended_unsold']),
  atMs: z.number().int().nonnegative(),
  message: z.string().min(1),
  visiblePricePence: z.number().int().nonnegative().optional(),
}).strict()

export const PrivateEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  type: z.enum(['mandate_parsed', 'mandate_approved', 'maximum_registered', 'outbid', 'won', 'lost']),
  atMs: z.number().int().nonnegative(),
  message: z.string().min(1),
  ownMaxPence: z.number().int().positive().optional(),
}).strict()

const PublicViewSchema = z.object({
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  status: AuctionStatusSchema,
  lot: LotSchema,
  currentPricePence: z.number().int().nonnegative(),
  reserveMet: z.boolean(),
  buyNowPricePence: z.number().int().positive(),
  incrementPence: z.number().int().positive(),
  bidCount: z.number().int().nonnegative(),
  endsAtMs: z.number().int().nonnegative().nullable(),
  serverNowMs: z.number().int().nonnegative(),
  publicEvents: z.array(PublicEventSchema),
}).strict()

export const AgentStatusSchema = z.enum(['inactive', 'active', 'stopped', 'won', 'lost'])

export const PublicSnapshotSchema = PublicViewSchema.extend({ viewer: z.literal('public') }).strict()
export const SellerSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('seller'),
  startingPricePence: z.number().int().positive(),
  reservePricePence: z.number().int().positive(),
}).strict()
export const BuyerSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('buyer'),
  party: z.enum(['primary', 'rival']),
  ownMaxPence: z.number().int().positive().nullable(),
  isLeader: z.boolean(),
  agentStatus: AgentStatusSchema,
  approvedMandate: ApprovedMandateSchema.nullable(),
  privateEvents: z.array(PrivateEventSchema),
}).strict()
export const PresenterSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('presenter'),
  modelStatus: z.enum(['configured', 'fallback']),
}).strict()
export const AuctionSnapshotSchema = z.discriminatedUnion('viewer', [
  PublicSnapshotSchema,
  SellerSnapshotSchema,
  BuyerSnapshotSchema,
  PresenterSnapshotSchema,
])

export const CommandAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), code: z.enum(['ACCEPTED', 'IDEMPOTENT']), message: z.string(), sequence: z.number().int().nonnegative() }).strict(),
  z.object({ ok: z.literal(false), code: z.enum(['INVALID_COMMAND', 'FORBIDDEN', 'SESSION_EXPIRED', 'AUCTION_NOT_LIVE', 'AUCTION_CLOSED', 'COMMAND_ID_REUSED', 'STALE_AUCTION', 'STALE_LOT', 'STALE_PARSE', 'INVALID_TERMS', 'MAX_BELOW_START', 'MAX_AT_OR_ABOVE_BUY_NOW', 'MAX_CANNOT_DECREASE']), message: z.string(), sequence: z.number().int().nonnegative() }).strict(),
])

export type AuctionScope = z.infer<typeof AuctionScopeSchema>
export type Lot = z.infer<typeof LotSchema>
export type AuctionTerms = z.infer<typeof AuctionTermsSchema>
export type AuctionStatus = z.infer<typeof AuctionStatusSchema>
export type PublicEvent = z.infer<typeof PublicEventSchema>
export type PrivateEvent = z.infer<typeof PrivateEventSchema>
export type AgentStatus = z.infer<typeof AgentStatusSchema>
export type PublishCommand = z.infer<typeof PublishCommandSchema>
export type SetMaxCommand = z.infer<typeof SetMaxCommandSchema>
export type BuyNowCommand = z.infer<typeof BuyNowCommandSchema>
export type AuctionSnapshot = z.infer<typeof AuctionSnapshotSchema>
export type CommandAck = z.infer<typeof CommandAckSchema>
```

Do not introduce a circular import from `mandate.ts` back to `auction.ts`; repeat `auctionId` and `generation` fields in the mandate schemas.

- [ ] **Step 4: Define strict mandate, session, and guidance HTTP contracts**

Create `packages/contracts/src/mandate.ts`:

```ts
import { z } from 'zod'

export const ParsedPolicySchema = z.object({
  categoryIds: z.tuple([z.literal('branded_sweatshirts')]),
  minimumGrade: z.enum(['A', 'AB', 'B']),
  preference: z.enum(['auction', 'certainty']),
  explanation: z.string().min(1),
  source: z.enum(['live_model', 'structured_fallback']),
}).strict()

export const MandateParseRequestSchema = z.object({
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  lotVersion: z.literal(1),
  sourcingText: z.string().trim().min(8).max(500),
  mode: z.enum(['auto', 'structured_fallback']).default('auto'),
}).strict()

export const MandateParseResponseSchema = ParsedPolicySchema.extend({
  parseId: z.string().uuid(),
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  lotVersion: z.literal(1),
}).strict()

export const ApprovedMandateSchema = ParsedPolicySchema.extend({
  parseId: z.string().uuid(),
  maxTotalPence: z.number().int().positive(),
  allowBuyNow: z.boolean(),
}).strict()

export const ApproveMandateCommandSchema = z.object({
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  commandId: z.string().uuid(),
  parseId: z.string().uuid(),
  lotVersion: z.literal(1),
  categoryIds: z.tuple([z.literal('branded_sweatshirts')]),
  minimumGrade: z.enum(['A', 'AB', 'B']),
  preference: z.enum(['auction', 'certainty']),
  maxTotalPence: z.number().int().positive(),
  allowBuyNow: z.boolean(),
}).strict()

export type ParsedPolicy = z.infer<typeof ParsedPolicySchema>
export type MandateParseRequest = z.infer<typeof MandateParseRequestSchema>
export type MandateParseResponse = z.infer<typeof MandateParseResponseSchema>
export type ApprovedMandate = z.infer<typeof ApprovedMandateSchema>
export type ApproveMandateCommand = z.infer<typeof ApproveMandateCommandSchema>
```

Create `packages/contracts/src/sessions.ts` and `guidance.ts`:

```ts
// sessions.ts
import { z } from 'zod'

export const SessionRoleSchema = z.enum(['presenter', 'seller', 'primary_buyer', 'rival_buyer', 'public'])
export const SessionExchangeRequestSchema = z.object({ code: z.string().uuid() }).strict()
export const SessionExchangeResponseSchema = z.object({
  token: z.string().min(32),
  role: SessionRoleSchema,
  party: z.enum(['primary', 'rival']).nullable(),
  auctionId: z.string().min(1).nullable(),
  generation: z.number().int().nonnegative().nullable(),
}).strict()
export const RoleLinksSchema = z.object({ seller: z.string(), buyer: z.string(), rival: z.string(), market: z.string() }).strict()
export const DemoResetResponseSchema = z.object({
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  links: RoleLinksSchema,
}).strict()
export type SessionRole = z.infer<typeof SessionRoleSchema>
export type SessionExchangeResponse = z.infer<typeof SessionExchangeResponseSchema>
export type DemoResetResponse = z.infer<typeof DemoResetResponseSchema>

// guidance.ts
import { z } from 'zod'
export const GuidanceResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), evidenceLabel: z.literal('Synthetic demo data'), count: z.number().int().nonnegative(), lowPence: z.number().int(), medianPence: z.number().int(), highPence: z.number().int() }).strict(),
  z.object({ status: z.literal('insufficient_evidence'), evidenceLabel: z.literal('Synthetic demo data'), count: z.number().int().nonnegative() }).strict(),
])
export type GuidanceResponse = z.infer<typeof GuidanceResponseSchema>
```

- [ ] **Step 5: Define typed Socket.IO interfaces and re-export the contract surface**

Create `packages/contracts/src/system.ts` by moving the existing definitions unchanged:

```ts
import { z } from 'zod'

export const HealthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('fleek-auction-server'),
  modelConfigured: z.boolean(),
  timestampMs: z.number().int().nonnegative(),
}).strict()
export type HealthStatus = z.infer<typeof HealthStatusSchema>

export const PingRequestSchema = z.object({ requestId: z.string().uuid() }).strict()
export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingAckSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    requestId: z.string().uuid(),
    serverTimeMs: z.number().int().nonnegative(),
  }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('INVALID_PING') }).strict(),
])
export type PingAck = z.infer<typeof PingAckSchema>
```

Create `packages/contracts/src/socket-events.ts`:

```ts
import type { AuctionSnapshot, BuyNowCommand, CommandAck, PublishCommand, SetMaxCommand } from './auction.js'
import type { ApproveMandateCommand } from './mandate.js'
import type { HealthStatus, PingAck, PingRequest } from './system.js'

type Ack = (response: CommandAck) => void

export interface ClientToServerEvents {
  'system:ping': (payload: PingRequest, acknowledge: (response: PingAck) => void) => void
  'auction:publish': (payload: PublishCommand, acknowledge: Ack) => void
  'auction:set-max': (payload: SetMaxCommand, acknowledge: Ack) => void
  'auction:buy-now': (payload: BuyNowCommand, acknowledge: Ack) => void
  'mandate:approve': (payload: ApproveMandateCommand, acknowledge: Ack) => void
}

export interface ServerToClientEvents {
  'system:ready': (payload: HealthStatus) => void
  'auction:snapshot': (payload: AuctionSnapshot) => void
  'session:error': (payload: { code: 'SESSION_EXPIRED'; message: string }) => void
}
```

Move the existing health/ping schemas and inferred types without behavioural changes into `packages/contracts/src/system.ts`. Move the existing socket interfaces out of `index.ts`, then make `index.ts` contain only:

```ts
export * from './system.js'
export * from './auction.js'
export * from './mandate.js'
export * from './sessions.js'
export * from './guidance.js'
export * from './socket-events.js'
```

Update existing tests to import through `index.ts` as before.

- [ ] **Step 6: Run contract verification and commit the freeze**

Run:

```bash
npm run test -w @fleek/contracts
npm run typecheck -w @fleek/contracts
npm run build -w @fleek/contracts
npm run lint
```

Expected: every existing system test and new demo-contract test passes; TypeScript, build, and lint exit `0`.

Commit:

```bash
git add packages/contracts
git commit -m "feat: freeze auction demo contracts"
```

Record this commit as `CONTRACT_FREEZE_SHA`; every parallel worktree starts from it.

---

### Task 2: Implement and prove the pure auction engine

**Files:**
- Create: `apps/server/src/auction/types.ts`
- Create: `apps/server/src/auction/engine.ts`
- Create: `apps/server/src/auction/engine.test.ts`

**Interfaces:**
- Consumes: `Lot`, `AuctionTerms`, `AuctionStatus`, `PublicEvent`, and `PrivateEvent` from `@fleek/contracts`.
- Produces: `createDraftAuction(input): AuctionState` and `applyAuctionCommand(state, command, nowMs): AuctionCommandResult`.

- [ ] **Step 1: Define the internal domain types**

Create `apps/server/src/auction/types.ts`:

```ts
import type {
  AuctionStatus,
  AuctionTerms,
  Lot,
  PrivateEvent,
  PublicEvent,
} from '@fleek/contracts'

export type BidderId = 'primary' | 'rival'

export interface BidIntent {
  bidderId: BidderId
  maxPence: number
  priority: number
  firstRegisteredAtMs: number
}

export type AuctionDomainEvent =
  | ({ audience: 'public' } & PublicEvent)
  | ({ audience: 'buyer'; bidderId: BidderId } & PrivateEvent)

export interface AuctionState {
  auctionId: string
  generation: number
  lot: Lot
  status: AuctionStatus
  terms: AuctionTerms | null
  currentPricePence: number
  leaderId: BidderId | null
  winnerId: BidderId | null
  reserveMet: boolean
  bidCount: number
  bidIntents: readonly BidIntent[]
  events: readonly AuctionDomainEvent[]
  startsAtMs: number | null
  endsAtMs: number | null
  sequence: number
}

export type AuctionCommand =
  | { type: 'publish'; lotVersion: 1; terms: AuctionTerms }
  | { type: 'set_max'; bidderId: BidderId; maxPence: number }
  | { type: 'buy_now'; bidderId: BidderId }
  | { type: 'expire' }

export type AuctionCommandErrorCode =
  | 'INVALID_TERMS'
  | 'STALE_LOT'
  | 'AUCTION_NOT_LIVE'
  | 'AUCTION_CLOSED'
  | 'MAX_BELOW_START'
  | 'MAX_AT_OR_ABOVE_BUY_NOW'
  | 'MAX_CANNOT_DECREASE'
  | 'EXPIRE_TOO_EARLY'

export type AuctionCommandResult =
  | { ok: true; state: AuctionState; emittedEvents: readonly AuctionDomainEvent[] }
  | {
      ok: false
      state: AuctionState
      code: AuctionCommandErrorCode
      message: string
      emittedEvents: readonly AuctionDomainEvent[]
    }
```

- [ ] **Step 2: Write RED tests for the locked lifecycle and rule boundaries**

Create `apps/server/src/auction/engine.test.ts`. Use a fixed lot, `nowMs = 1_000`, and these assertions:

```ts
import { describe, expect, it } from 'vitest'
import { applyAuctionCommand, createDraftAuction } from './engine.js'
import type { AuctionState } from './types.js'

const lot = {
  lotId: 'sweatshirt-lot' as const,
  version: 1 as const,
  title: '50-piece Grade AB Branded Sweatshirt Lot' as const,
  categoryId: 'branded_sweatshirts' as const,
  grade: 'AB' as const,
  lotSize: 50 as const,
  shippingPence: 4_800 as const,
  listingType: 'exact_bundle' as const,
}

const terms = {
  startingPricePence: 52_000,
  reservePricePence: 62_000,
  buyNowPricePence: 76_000,
  incrementPence: 1_000,
  durationMs: 90_000,
}

function published(): AuctionState {
  const draft = createDraftAuction({ auctionId: 'auction-1', generation: 1, lot })
  const result = applyAuctionCommand(draft, { type: 'publish', lotVersion: 1, terms }, 1_000)
  if (!result.ok) throw new Error(result.message)
  return result.state
}

function setMax(state: AuctionState, bidderId: 'primary' | 'rival', maxPence: number, nowMs: number) {
  return applyAuctionCommand(state, { type: 'set_max', bidderId, maxPence }, nowMs)
}

describe('auction engine', () => {
  it('publishes the locked terms for exactly 90 seconds', () => {
    const state = published()
    expect(state).toMatchObject({ status: 'live', currentPricePence: 52_000, bidCount: 0, startsAtMs: 1_000, endsAtMs: 91_000 })
  })

  it('moves the first £690 maximum to reserve', () => {
    const result = setMax(published(), 'primary', 69_000, 2_000)
    expect(result.ok).toBe(true)
    expect(result.state).toMatchObject({ leaderId: 'primary', currentPricePence: 62_000, reserveMet: true, bidCount: 1 })
  })

  it('keeps primary leading at £660 after the £650 rival', () => {
    const primary = setMax(published(), 'primary', 69_000, 2_000).state
    const rival = setMax(primary, 'rival', 65_000, 3_000)
    expect(rival.state).toMatchObject({ leaderId: 'primary', currentPricePence: 66_000, bidCount: 2 })
    expect(rival.emittedEvents.some((event) => event.type === 'automatic_bid')).toBe(true)
  })

  it('lets the £710 rival lead and win at £700', () => {
    const primary = setMax(published(), 'primary', 69_000, 2_000).state
    const rival = setMax(primary, 'rival', 71_000, 3_000).state
    const expired = applyAuctionCommand(rival, { type: 'expire' }, 91_000)
    expect(expired.state).toMatchObject({ status: 'sold_auction_pending_qc', leaderId: 'rival', winnerId: 'rival', currentPricePence: 70_000 })
  })

  it('preserves earlier priority for equal maxima', () => {
    const primary = setMax(published(), 'primary', 69_000, 2_000).state
    const rival = setMax(primary, 'rival', 69_000, 3_000)
    expect(rival.state).toMatchObject({ leaderId: 'primary', currentPricePence: 69_000 })
  })

  it('makes the same maximum idempotent and rejects a decrease', () => {
    const first = setMax(published(), 'primary', 69_000, 2_000).state
    const same = setMax(first, 'primary', 69_000, 3_000)
    expect(same).toMatchObject({ ok: true, state: { sequence: first.sequence, bidCount: 1 } })
    const lower = setMax(first, 'primary', 68_000, 3_000)
    expect(lower).toMatchObject({ ok: false, code: 'MAX_CANNOT_DECREASE', state: first })
  })

  it('rejects maxima below start or at Buy Now without mutation', () => {
    const state = published()
    expect(setMax(state, 'primary', 51_000, 2_000)).toMatchObject({ ok: false, code: 'MAX_BELOW_START', state })
    expect(setMax(state, 'primary', 76_000, 2_000)).toMatchObject({ ok: false, code: 'MAX_AT_OR_ABOVE_BUY_NOW', state })
  })

  it('ends without sale when reserve is missed', () => {
    const belowReserve = setMax(published(), 'primary', 60_000, 2_000).state
    const expired = applyAuctionCommand(belowReserve, { type: 'expire' }, 91_000)
    expect(expired.state).toMatchObject({ status: 'ended_unsold', winnerId: null, currentPricePence: 52_000 })
  })

  it('closes Buy Now once at £760', () => {
    const sold = applyAuctionCommand(published(), { type: 'buy_now', bidderId: 'rival' }, 2_000)
    expect(sold.state).toMatchObject({ status: 'sold_buy_now_pending_qc', winnerId: 'rival', currentPricePence: 76_000 })
    expect(applyAuctionCommand(sold.state, { type: 'buy_now', bidderId: 'primary' }, 3_000)).toMatchObject({ ok: false, code: 'AUCTION_CLOSED' })
  })

  it('expires before applying a command at the exact deadline', () => {
    const primary = setMax(published(), 'primary', 69_000, 2_000).state
    const result = setMax(primary, 'rival', 65_000, 91_000)
    expect(result).toMatchObject({ ok: false, code: 'AUCTION_CLOSED', state: { status: 'sold_auction_pending_qc', winnerId: 'primary' } })
  })
})
```

- [ ] **Step 3: Run the engine test and capture RED**

Run:

```bash
npm run test -w @fleek/server -- src/auction/engine.test.ts
```

Expected: FAIL because `engine.ts` does not exist.

- [ ] **Step 4: Implement the immutable transition and proxy calculation**

Create `apps/server/src/auction/engine.ts` with these exports and helpers:

```ts
import { AuctionTermsSchema, type Lot } from '@fleek/contracts'
import type {
  AuctionCommandErrorCode,
  AuctionCommand,
  AuctionCommandResult,
  AuctionDomainEvent,
  AuctionState,
  BidIntent,
} from './types.js'

export function createDraftAuction(input: {
  auctionId: string
  generation: number
  lot: Lot
}): AuctionState {
  return {
    ...input,
    status: 'draft',
    terms: null,
    currentPricePence: 0,
    leaderId: null,
    winnerId: null,
    reserveMet: false,
    bidCount: 0,
    bidIntents: [],
    events: [],
    startsAtMs: null,
    endsAtMs: null,
    sequence: 0,
  }
}

function rank(intents: readonly BidIntent[]): readonly BidIntent[] {
  return [...intents].sort((left, right) =>
    right.maxPence - left.maxPence || left.priority - right.priority,
  )
}

function visiblePrice(state: AuctionState, intents: readonly BidIntent[]): number {
  const terms = state.terms
  if (!terms) return 0
  const [highest, second] = rank(intents)
  if (!highest) return terms.startingPricePence
  let price = second
    ? Math.min(highest.maxPence, second.maxPence + terms.incrementPence)
    : terms.startingPricePence
  if (highest.maxPence >= terms.reservePricePence && price < terms.reservePricePence) {
    price = terms.reservePricePence
  }
  return price
}

type EventDraft = AuctionDomainEvent extends infer Event
  ? Event extends AuctionDomainEvent
    ? Omit<Event, 'sequence'>
    : never
  : never

function append(
  state: AuctionState,
  patch: Partial<AuctionState>,
  drafts: readonly EventDraft[],
): { state: AuctionState; emittedEvents: readonly AuctionDomainEvent[] } {
  let sequence = state.sequence
  const emittedEvents = drafts.map((draft) => ({ ...draft, sequence: ++sequence }) as AuctionDomainEvent)
  return {
    emittedEvents,
    state: {
      ...state,
      ...patch,
      sequence,
      events: [...state.events, ...emittedEvents],
    },
  }
}

function accepted(
  state: AuctionState,
  emittedEvents: readonly AuctionDomainEvent[] = [],
): AuctionCommandResult {
  return { ok: true, state, emittedEvents }
}

function rejected(
  state: AuctionState,
  code: AuctionCommandErrorCode,
  message: string,
  emittedEvents: readonly AuctionDomainEvent[] = [],
): AuctionCommandResult {
  return { ok: false, state, code, message, emittedEvents }
}

export function applyAuctionCommand(
  state: AuctionState,
  command: AuctionCommand,
  nowMs: number,
): AuctionCommandResult {
  const terminal = state.status !== 'draft' && state.status !== 'live'
  if (terminal) return rejected(state, 'AUCTION_CLOSED', 'The auction is closed.')

  if (
    command.type !== 'expire' &&
    state.status === 'live' &&
    state.endsAtMs !== null &&
    nowMs >= state.endsAtMs
  ) {
    const expiry = applyAuctionCommand(state, { type: 'expire' }, nowMs)
    return rejected(expiry.state, 'AUCTION_CLOSED', 'The auction expired before this command.', expiry.emittedEvents)
  }

  if (command.type === 'publish') {
    if (state.status !== 'draft') return rejected(state, 'AUCTION_NOT_LIVE', 'The draft is no longer publishable.')
    if (command.lotVersion !== state.lot.version) return rejected(state, 'STALE_LOT', 'The lot version changed.')
    const parsedTerms = AuctionTermsSchema.safeParse(command.terms)
    if (!parsedTerms.success) return rejected(state, 'INVALID_TERMS', 'Check the auction prices and duration.')
    const next = append(
      state,
      {
        status: 'live',
        terms: parsedTerms.data,
        currentPricePence: parsedTerms.data.startingPricePence,
        startsAtMs: nowMs,
        endsAtMs: nowMs + parsedTerms.data.durationMs,
      },
      [{
        audience: 'public',
        type: 'published',
        atMs: nowMs,
        message: `Auction published at £${parsedTerms.data.startingPricePence / 100}.`,
        visiblePricePence: parsedTerms.data.startingPricePence,
      }],
    )
    return accepted(next.state, next.emittedEvents)
  }

  if (state.status !== 'live' || !state.terms) {
    return rejected(state, 'AUCTION_NOT_LIVE', 'Publish the auction first.')
  }

  if (command.type === 'set_max') {
    if (!Number.isInteger(command.maxPence) || command.maxPence < state.terms.startingPricePence) {
      return rejected(state, 'MAX_BELOW_START', 'The private maximum must reach the starting price.')
    }
    if (command.maxPence >= state.terms.buyNowPricePence) {
      return rejected(state, 'MAX_AT_OR_ABOVE_BUY_NOW', 'Use Buy Now or choose a lower private maximum.')
    }
    const existing = state.bidIntents.find((intent) => intent.bidderId === command.bidderId)
    if (existing?.maxPence === command.maxPence) return accepted(state)
    if (existing && command.maxPence < existing.maxPence) {
      return rejected(state, 'MAX_CANNOT_DECREASE', 'An active maximum can only increase.')
    }

    const nextIntent: BidIntent = {
      bidderId: command.bidderId,
      maxPence: command.maxPence,
      priority: existing?.priority ?? state.bidIntents.length,
      firstRegisteredAtMs: existing?.firstRegisteredAtMs ?? nowMs,
    }
    const intents = existing
      ? state.bidIntents.map((intent) => intent.bidderId === command.bidderId ? nextIntent : intent)
      : [...state.bidIntents, nextIntent]
    const [leader] = rank(intents)
    const price = visiblePrice(state, intents)
    const reserveMet = price >= state.terms.reservePricePence
    const drafts: EventDraft[] = [
      { audience: 'buyer', bidderId: command.bidderId, type: 'maximum_registered', atMs: nowMs, message: 'Your private maximum is active.', ownMaxPence: command.maxPence },
      { audience: 'public', type: 'bid_received', atMs: nowMs, message: 'A private maximum was registered.', visiblePricePence: price },
    ]
    if (!state.reserveMet && reserveMet) {
      drafts.push({ audience: 'public', type: 'reserve_met', atMs: nowMs, message: 'The private reserve has been met.', visiblePricePence: price })
    }
    if (state.bidIntents.length > 0 && price !== state.currentPricePence) {
      drafts.push({ audience: 'public', type: 'automatic_bid', atMs: nowMs, message: 'The proxy auction updated the current bid.', visiblePricePence: price })
    }
    if (state.leaderId && state.leaderId !== leader!.bidderId) {
      drafts.push({ audience: 'buyer', bidderId: state.leaderId, type: 'outbid', atMs: nowMs, message: 'Another private maximum is now leading.' })
    }
    const next = append(state, {
      bidIntents: intents,
      bidCount: state.bidCount + 1,
      leaderId: leader!.bidderId,
      currentPricePence: price,
      reserveMet,
    }, drafts)
    return accepted(next.state, next.emittedEvents)
  }

  if (command.type === 'buy_now') {
    const next = append(state, {
      status: 'sold_buy_now_pending_qc',
      currentPricePence: state.terms.buyNowPricePence,
      leaderId: command.bidderId,
      winnerId: command.bidderId,
    }, [
      { audience: 'public', type: 'sold_buy_now_pending_qc', atMs: nowMs, message: 'Sold via Buy Now — pending Fleek physical QC.', visiblePricePence: state.terms.buyNowPricePence },
      { audience: 'buyer', bidderId: command.bidderId, type: 'won', atMs: nowMs, message: 'You won via Buy Now.' },
    ])
    return accepted(next.state, next.emittedEvents)
  }

  if (state.endsAtMs === null || nowMs < state.endsAtMs) {
    return rejected(state, 'EXPIRE_TOO_EARLY', 'The auction has not reached its deadline.')
  }
  const sold = state.reserveMet && state.leaderId !== null
  const terminalStatus = sold ? 'sold_auction_pending_qc' : 'ended_unsold'
  const drafts: EventDraft[] = [
    { audience: 'public', type: 'expired', atMs: nowMs, message: 'The auction timer ended.', visiblePricePence: state.currentPricePence },
    sold
      ? { audience: 'public', type: 'sold_auction_pending_qc', atMs: nowMs, message: 'Sold at auction — pending Fleek physical QC.', visiblePricePence: state.currentPricePence }
      : { audience: 'public', type: 'ended_unsold', atMs: nowMs, message: 'Auction ended without a sale — private reserve not met.', visiblePricePence: state.currentPricePence },
  ]
  if (sold) drafts.push({ audience: 'buyer', bidderId: state.leaderId!, type: 'won', atMs: nowMs, message: 'You won at auction.' })
  const next = append(state, { status: terminalStatus, winnerId: sold ? state.leaderId : null }, drafts)
  return accepted(next.state, next.emittedEvents)
}
```

The final implementation must contain no I/O, randomness, timers, environment access, or logging; `nowMs` is its only time source.

- [ ] **Step 5: Verify the engine and commit**

Run:

```bash
npm run test -w @fleek/server -- src/auction/engine.test.ts
npm run typecheck -w @fleek/server
npm run lint
```

Expected: ten engine tests pass; typecheck and lint exit `0`.

Commit:

```bash
git add apps/server/src/auction
git commit -m "feat: add deterministic auction engine"
```

---

### Task 3: Add the locked fixture, guidance calculation, and privacy projections

**Files:**
- Create: `data/comparables.json`
- Create: `apps/server/src/demo/fixture.ts`
- Create: `apps/server/src/guidance/calculateGuidance.ts`
- Create: `apps/server/src/guidance/guidance.test.ts`
- Create: `apps/server/src/auction/projections.ts`
- Create: `apps/server/src/auction/projections.test.ts`

**Interfaces:**
- Consumes: `AuctionState` and frozen snapshot/guidance/mandate contracts.
- Produces: `lockedLot`, `lockedTerms`, `calculateGuidance(rows, query)`, and `projectSnapshot(input): AuctionSnapshot`.

- [ ] **Step 1: Add the exact locked fixture and comparable rows**

Create `apps/server/src/demo/fixture.ts`:

```ts
import type { AuctionTerms, Lot } from '@fleek/contracts'

export const lockedLot: Lot = {
  lotId: 'sweatshirt-lot',
  version: 1,
  title: '50-piece Grade AB Branded Sweatshirt Lot',
  categoryId: 'branded_sweatshirts',
  grade: 'AB',
  lotSize: 50,
  shippingPence: 4_800,
  listingType: 'exact_bundle',
}

export const lockedTerms: AuctionTerms = {
  startingPricePence: 52_000,
  reservePricePence: 62_000,
  buyNowPricePence: 76_000,
  incrementPence: 1_000,
  durationMs: 90_000,
}

export const lockedPrimaryMaxPence = 69_000
export const lockedRivalMaxPence = 65_000
export const alternateRivalMaxPence = 71_000
```

Create `data/comparables.json` with exactly twelve strict rows using lot size `50`, category `branded_sweatshirts`, grades `A` or `AB`, evidence type `synthetic_demo`, and total prices:

```json
[
  { "id": "synthetic-01", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 52000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-02", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 54000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-03", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 56000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-04", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 58000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-05", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 62000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-06", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 64000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-07", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 66000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-08", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 70000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-09", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 72000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-10", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 74000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-11", "categoryId": "branded_sweatshirts", "grade": "AB", "lotSize": 50, "totalPricePence": 76000, "evidenceType": "synthetic_demo" },
  { "id": "synthetic-12", "categoryId": "branded_sweatshirts", "grade": "A", "lotSize": 50, "totalPricePence": 78000, "evidenceType": "synthetic_demo" }
]
```

- [ ] **Step 2: Write RED guidance tests**

Create `apps/server/src/guidance/guidance.test.ts` with tests that load the JSON and assert:

```ts
const result = calculateGuidance(rows, {
  categoryId: 'branded_sweatshirts',
  minimumGrade: 'AB',
  targetLotSize: 50,
})
expect(result).toEqual({
  status: 'ok',
  evidenceLabel: 'Synthetic demo data',
  count: 12,
  lowPence: 56_000,
  medianPence: 64_000,
  highPence: 72_000,
})
```

Also assert that a 40-piece £44,800 row normalizes to £56,000; Grade B and another category are excluded; and fewer than five matching rows returns `{ status: 'insufficient_evidence', evidenceLabel: 'Synthetic demo data', count: 4 }`.

Run:

```bash
npm run test -w @fleek/server -- src/guidance/guidance.test.ts
```

Expected: FAIL because `calculateGuidance` is missing.

- [ ] **Step 3: Implement integer-only nearest-rank guidance**

Create `apps/server/src/guidance/calculateGuidance.ts` with:

```ts
import type { GuidanceResponse } from '@fleek/contracts'

export interface ComparableRow {
  id: string
  categoryId: 'branded_sweatshirts'
  grade: 'A' | 'AB' | 'B'
  lotSize: number
  totalPricePence: number
  evidenceType: 'synthetic_demo'
}

export interface GuidanceQuery {
  categoryId: 'branded_sweatshirts'
  minimumGrade: 'A' | 'AB' | 'B'
  targetLotSize: number
}

const gradeRank = { B: 1, AB: 2, A: 3 } as const

function nearestRank(sorted: readonly number[], percentile: number): number {
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1)
  return sorted[index]!
}

export function calculateGuidance(
  rows: readonly ComparableRow[],
  query: GuidanceQuery,
): GuidanceResponse {
  const minimumSize = query.targetLotSize * 0.8
  const maximumSize = query.targetLotSize * 1.2
  const normalized = rows
    .filter((row) =>
      row.categoryId === query.categoryId &&
      gradeRank[row.grade] >= gradeRank[query.minimumGrade] &&
      row.lotSize >= minimumSize &&
      row.lotSize <= maximumSize,
    )
    .map((row) => Math.round(row.totalPricePence / row.lotSize) * query.targetLotSize)
    .sort((left, right) => left - right)

  if (normalized.length < 5) {
    return { status: 'insufficient_evidence', evidenceLabel: 'Synthetic demo data', count: normalized.length }
  }

  return {
    status: 'ok',
    evidenceLabel: 'Synthetic demo data',
    count: normalized.length,
    lowPence: nearestRank(normalized, 0.25),
    medianPence: nearestRank(normalized, 0.5),
    highPence: nearestRank(normalized, 0.75),
  }
}
```

- [ ] **Step 4: Write RED privacy-projection tests**

Create `apps/server/src/auction/projections.test.ts`. Build the baseline engine state and a private-state object with both maxima and the primary approved mandate. Assert:

```ts
const publicSnapshot = projectSnapshot({ state, viewer: { role: 'public', partyId: null }, privateState, serverNowMs: 4_000, modelConfigured: false })
const sellerSnapshot = projectSnapshot({ state, viewer: { role: 'seller', partyId: null }, privateState, serverNowMs: 4_000, modelConfigured: false })
const primarySnapshot = projectSnapshot({ state, viewer: { role: 'primary_buyer', partyId: 'primary' }, privateState, serverNowMs: 4_000, modelConfigured: false })
const rivalSnapshot = projectSnapshot({ state, viewer: { role: 'rival_buyer', partyId: 'rival' }, privateState, serverNowMs: 4_000, modelConfigured: false })

expect(JSON.stringify(publicSnapshot)).not.toMatch(/reservePricePence|ownMaxPence|approvedMandate|privateEvents|primary|rival/)
expect(sellerSnapshot).toMatchObject({ viewer: 'seller', reservePricePence: 62_000 })
expect(JSON.stringify(sellerSnapshot)).not.toMatch(/ownMaxPence|approvedMandate|privateEvents/)
expect(primarySnapshot).toMatchObject({ viewer: 'buyer', party: 'primary', ownMaxPence: 69_000, isLeader: true })
expect(JSON.stringify(primarySnapshot)).not.toContain('65000')
expect(rivalSnapshot).toMatchObject({ viewer: 'buyer', party: 'rival', ownMaxPence: 65_000, isLeader: false })
expect(JSON.stringify(rivalSnapshot)).not.toContain('69000')
```

Parse every result with `AuctionSnapshotSchema` and add a test proving the private activity list contains only that buyer's events.

Run:

```bash
npm run test -w @fleek/server -- src/auction/projections.test.ts
```

Expected: FAIL because `projectSnapshot` is missing.

- [ ] **Step 5: Implement role-specific projections**

Create `apps/server/src/auction/projections.ts` with:

```ts
import { AuctionSnapshotSchema, type AgentStatus, type ApprovedMandate, type AuctionSnapshot } from '@fleek/contracts'
import type { AuctionState, BidderId } from './types.js'
import { lockedTerms } from '../demo/fixture.js'

export interface ViewerContext {
  role: 'presenter' | 'seller' | 'primary_buyer' | 'rival_buyer' | 'public'
  partyId: BidderId | null
}

export interface ProjectionPrivateState {
  approvedMandates: Partial<Record<BidderId, ApprovedMandate>>
  agentStatus: Record<BidderId, AgentStatus>
}

export function projectSnapshot(input: {
  state: AuctionState
  viewer: ViewerContext
  privateState: ProjectionPrivateState
  serverNowMs: number
  modelConfigured: boolean
}): AuctionSnapshot {
  const terms = input.state.terms ?? lockedTerms
  const publicEvents = input.state.events
    .filter((event) => event.audience === 'public')
    .map(({ audience: _audience, ...event }) => event)
  const publicView = {
    auctionId: input.state.auctionId,
    generation: input.state.generation,
    sequence: input.state.sequence,
    status: input.state.status,
    lot: input.state.lot,
    currentPricePence: input.state.currentPricePence || terms.startingPricePence,
    reserveMet: input.state.reserveMet,
    buyNowPricePence: terms.buyNowPricePence,
    incrementPence: terms.incrementPence,
    bidCount: input.state.bidCount,
    endsAtMs: input.state.endsAtMs,
    serverNowMs: input.serverNowMs,
    publicEvents,
  }

  if (input.viewer.role === 'seller') {
    return AuctionSnapshotSchema.parse({ ...publicView, viewer: 'seller', startingPricePence: terms.startingPricePence, reservePricePence: terms.reservePricePence })
  }
  if (input.viewer.role === 'primary_buyer' || input.viewer.role === 'rival_buyer') {
    const party = input.viewer.partyId!
    const ownIntent = input.state.bidIntents.find((intent) => intent.bidderId === party)
    const privateEvents = input.state.events
      .filter((event) => event.audience === 'buyer' && event.bidderId === party)
      .map(({ audience: _audience, bidderId: _bidderId, ...event }) => event)
    return AuctionSnapshotSchema.parse({
      ...publicView,
      viewer: 'buyer',
      party,
      ownMaxPence: ownIntent?.maxPence ?? null,
      isLeader: input.state.leaderId === party,
      agentStatus: input.privateState.agentStatus[party],
      approvedMandate: input.privateState.approvedMandates[party] ?? null,
      privateEvents,
    })
  }
  if (input.viewer.role === 'presenter') {
    return AuctionSnapshotSchema.parse({ ...publicView, viewer: 'presenter', modelStatus: input.modelConfigured ? 'configured' : 'fallback' })
  }
  return AuctionSnapshotSchema.parse({ ...publicView, viewer: 'public' })
}
```

- [ ] **Step 6: Verify pure services and commit**

Run:

```bash
npm run test -w @fleek/server -- src/guidance/guidance.test.ts src/auction/projections.test.ts
npm run typecheck -w @fleek/server
npm run lint
```

Expected: guidance and projection suites pass; typecheck and lint exit `0`.

Commit:

```bash
git add data apps/server/src/demo apps/server/src/guidance apps/server/src/auction/projections.ts apps/server/src/auction/projections.test.ts
git commit -m "feat: add guidance and privacy projections"
```

---

### Task 4: Add one-time role sessions and mandate parsers

**Files:**
- Create: `apps/server/src/sessions/SessionRegistry.ts`
- Create: `apps/server/src/sessions/SessionRegistry.test.ts`
- Create: `apps/server/src/sessions/bearer.ts`
- Create: `apps/server/src/model/MandateParser.ts`
- Create: `apps/server/src/model/StructuredFallbackParser.ts`
- Create: `apps/server/src/model/OpenAICompatibleMandateParser.ts`
- Create: `apps/server/src/model/createMandateParser.ts`
- Create: `apps/server/src/model/model.test.ts`

**Interfaces:**
- Produces: `SessionRegistry`, `SessionContext`, `readBearerToken`, `MandateParser`, and `createMandateParser(env, fetchImpl)`.
- Consumes: frozen session and mandate schemas only; it does not depend on the auction engine.

- [ ] **Step 1: Write RED tests for one-time codes and generation invalidation**

Create `apps/server/src/sessions/SessionRegistry.test.ts` with a deterministic secret factory and assert:

```ts
const secrets = ['presenter-code', 'presenter-token', 'seller-code', 'buyer-code', 'rival-code', 'market-code', 'seller-token']
const registry = new SessionRegistry({ nextSecret: () => secrets.shift()! })
const presenterCode = registry.issuePresenterBootstrap()
const presenter = registry.exchange(presenterCode)
expect(presenter?.session).toMatchObject({ role: 'presenter', auctionId: null, generation: null })
expect(registry.exchange(presenterCode)).toBeNull()

const links = registry.issueAuctionBootstraps({ auctionId: 'auction-1', generation: 1 })
const sellerCode = new URL(links.seller, 'http://demo.local').searchParams.get('code')!
const seller = registry.exchange(sellerCode)!
expect(seller.session).toMatchObject({ role: 'seller', auctionId: 'auction-1', generation: 1 })
expect(registry.authenticate(seller.token)).toEqual(seller.session)

registry.invalidateAuctionSessions({ auctionId: 'auction-1', generation: 1 })
expect(registry.authenticate(seller.token)).toBeNull()
expect(registry.authenticate(presenter!.token)).toEqual(presenter!.session)
```

Also assert codes are single-use, a token cannot be exchanged as a code, role links map to the correct roles/parties, and failed exchange/authentication results never echo the supplied secret.

Run:

```bash
npm run test -w @fleek/server -- src/sessions/SessionRegistry.test.ts
```

Expected: FAIL because `SessionRegistry` is missing.

- [ ] **Step 2: Implement hashed in-memory sessions**

Create `SessionRegistry.ts` around these exact interfaces:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { AuctionScope, SessionRole } from '@fleek/contracts'

export interface SessionContext {
  sessionId: string
  role: SessionRole
  partyId: 'primary' | 'rival' | null
  auctionId: string | null
  generation: number | null
}

export interface SessionRegistryOptions {
  nextCode?: () => string
  nextSecret?: () => string
}

export class SessionRegistry {
  constructor(options: SessionRegistryOptions = {})
  issuePresenterBootstrap(): string
  issueAuctionBootstraps(scope: AuctionScope): { seller: string; buyer: string; rival: string; market: string }
  exchange(code: string): { token: string; session: SessionContext } | null
  authenticate(token: string): SessionContext | null
  invalidateAuctionSessions(scope: AuctionScope): readonly string[]
}
```

Default codes use `randomUUID()`. Default tokens use `randomBytes(32).toString('base64url')`. Store only `sha256(secret)` keys and immutable session metadata. Presenter sessions have null auction/generation and survive auction reset; seller, primary, rival, and public sessions are generation-bound. `issueAuctionBootstraps` returns relative paths `/seller?code=...`, `/buyer?code=...`, `/rival?code=...`, and `/market?code=...`.

Create `bearer.ts`:

```ts
export function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}
```

- [ ] **Step 3: Write RED parser tests for fallback honesty and model privacy**

Create `apps/server/src/model/model.test.ts` with these cases:

```ts
it('returns the labelled locked fallback', async () => {
  const result = await new StructuredFallbackParser().parse({ sourcingText: 'Grade AB branded sweatshirts' })
  expect(result).toEqual({
    categoryIds: ['branded_sweatshirts'],
    minimumGrade: 'AB',
    preference: 'auction',
    explanation: 'No LLM interpreted this text. Confirm the locked demo category, grade, and preference.',
    source: 'structured_fallback',
  })
})

it('does not activate live mode with partial configuration', () => {
  expect(createMandateParser({ LLM_BASE_URL: 'https://example.test/v1' }).modelConfigured).toBe(false)
})

it('sends sourcing text and no auction secrets to the live provider', async () => {
  let requestBody = ''
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBody = String(init?.body)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ categoryIds: ['branded_sweatshirts'], minimumGrade: 'AB', preference: 'auction', explanation: 'Matched Grade AB branded sweatshirts.' }) } }] }), { status: 200 })
  }
  const { parser } = createMandateParser({ LLM_BASE_URL: 'https://example.test/v1', LLM_API_KEY: 'secret', LLM_MODEL: 'demo-model' }, fetchImpl)
  const result = await parser.parse({ sourcingText: 'I want Grade AB branded sweatshirts' })
  expect(result.source).toBe('live_model')
  expect(requestBody).toContain('I want Grade AB branded sweatshirts')
  expect(requestBody).not.toMatch(/69000|62000|currentPrice|reserve|maxTotal|token|party/)
})
```

Add cases for unknown output keys, malformed JSON, non-2xx provider responses, and abort/timeout mapping. Live failures must throw typed `MandateParserError` codes `MODEL_TIMEOUT`, `MODEL_UNAVAILABLE`, or `INVALID_MODEL_OUTPUT`; they must not silently return fallback.

Run:

```bash
npm run test -w @fleek/server -- src/model/model.test.ts
```

Expected: FAIL because the parser files are missing.

- [ ] **Step 4: Implement fallback and OpenAI-compatible adapters**

Create `MandateParser.ts`:

```ts
import type { ParsedPolicy } from '@fleek/contracts'

export interface ParserInput { sourcingText: string }
export interface MandateParser { parse(input: ParserInput): Promise<ParsedPolicy> }
export type MandateParserErrorCode = 'MODEL_TIMEOUT' | 'MODEL_UNAVAILABLE' | 'INVALID_MODEL_OUTPUT'
export class MandateParserError extends Error {
  constructor(readonly code: MandateParserErrorCode, message: string) { super(message) }
}
```

`StructuredFallbackParser.parse` returns the exact object in Step 3. `OpenAICompatibleMandateParser` receives `{ baseUrl, apiKey, model, fetchImpl, timeoutMs = 8_000 }`, posts to `${baseUrlWithoutTrailingSlash}/chat/completions`, requests JSON, reads `choices[0].message.content`, parses JSON, validates it with `ParsedPolicySchema.omit({ source: true })`, rejects unknown keys, and adds `source: 'live_model'`. The system prompt lists only `branded_sweatshirts`, grades `A|AB|B`, and preferences `auction|certainty`.

Create `createMandateParser.ts`:

```ts
export function createMandateParser(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const configured = Boolean(env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL)
  const fallback = new StructuredFallbackParser()
  return {
    parser: configured
      ? new OpenAICompatibleMandateParser({ baseUrl: env.LLM_BASE_URL!, apiKey: env.LLM_API_KEY!, model: env.LLM_MODEL!, fetchImpl })
      : fallback,
    fallback,
    modelConfigured: configured,
  }
}
```

- [ ] **Step 5: Verify sessions/model services and commit**

Run:

```bash
npm run test -w @fleek/server -- src/sessions/SessionRegistry.test.ts src/model/model.test.ts
npm run typecheck -w @fleek/server
npm run lint
```

Expected: session and parser tests pass; typecheck and lint exit `0`.

Commit:

```bash
git add apps/server/src/sessions apps/server/src/model
git commit -m "feat: add demo sessions and mandate parsers"
```

---

### Task 5: Build the serial in-memory demo runtime

**Files:**
- Create: `apps/server/src/runtime/serialQueue.ts`
- Create: `apps/server/src/runtime/stablePayloadHash.ts`
- Create: `apps/server/src/runtime/DemoRuntime.ts`
- Create: `apps/server/src/runtime/DemoRuntime.test.ts`

**Interfaces:**
- Consumes: engine, projections, sessions, parsers, guidance, and frozen commands.
- Produces: `DemoRuntime.reset`, `parseMandate`, `dispatch`, `snapshotFor`, `subscribe`, `presenterBootstrapCode`, `tick`, and `stop`.

- [ ] **Step 1: Add deterministic queue and hash helpers with RED tests**

In `DemoRuntime.test.ts`, first assert that two concurrent queue jobs complete in insertion order and that `stablePayloadHash('auction:set-max', payload)` is identical for object keys in a different order but different when `maxPence` changes.

Implement `serialQueue.ts`:

```ts
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(job: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(job, job)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}
```

Implement `stablePayloadHash.ts` using `createHash('sha256')`, recursively sorted object keys, preserved array order, and the string `${eventName}:${canonicalJson}`.

- [ ] **Step 2: Write RED runtime tests for roles, idempotency, parsing, reset, and expiry**

Create a fake clock/scheduler and deterministic UUID source. Build a presenter session through `SessionRegistry`, call `reset`, exchange the four role codes, and assert these scenarios:

```ts
const reset = await runtime.reset(presenterSession)
expect(reset).toMatchObject({ generation: 1, links: { seller: expect.any(String), buyer: expect.any(String), rival: expect.any(String), market: expect.any(String) } })

const publishAck = await runtime.dispatch(sellerSession, 'auction:publish', publishCommand)
expect(publishAck).toMatchObject({ ok: true, code: 'ACCEPTED' })

const parsed = await runtime.parseMandate(primarySession, {
  auctionId: reset.auctionId,
  generation: 1,
  lotVersion: 1,
  sourcingText: 'I want Grade AB branded sweatshirts and prefer getting a deal.',
  mode: 'structured_fallback',
})
expect(parsed.source).toBe('structured_fallback')

const approved = await runtime.dispatch(primarySession, 'mandate:approve', {
  auctionId: reset.auctionId,
  generation: 1,
  commandId: '11111111-1111-4111-8111-111111111111',
  parseId: parsed.parseId,
  lotVersion: 1,
  categoryIds: ['branded_sweatshirts'],
  minimumGrade: 'AB',
  preference: 'auction',
  maxTotalPence: 69_000,
  allowBuyNow: true,
})
expect(approved.ok).toBe(true)
expect(runtime.snapshotFor(primarySession)).toMatchObject({ viewer: 'buyer', ownMaxPence: 69_000, currentPricePence: 62_000, isLeader: true })

const rivalAck = await runtime.dispatch(rivalSession, 'auction:set-max', {
  auctionId: reset.auctionId,
  generation: 1,
  commandId: '22222222-2222-4222-8222-222222222222',
  maxPence: 65_000,
})
expect(rivalAck.ok).toBe(true)
expect(runtime.snapshotFor(publicSession)).toMatchObject({ currentPricePence: 66_000, bidCount: 2 })
```

Add exact tests for:

- presenter-only reset and seller-only publish;
- primary-only parse/approval and rival-only direct maximum;
- a live parse failure does not fall back until `mode: 'structured_fallback'` is sent;
- approval fields must match the stored parse record and current auction/generation/lot version;
- same command ID/same event/payload returns `IDEMPOTENT` with no sequence change;
- same command ID with changed maximum returns `COMMAND_ID_REUSED`;
- `tick(endsAtMs)` closes baseline at £660;
- reset before an old scheduled tick prevents the old generation mutating the new auction;
- alternate £710 rival closes at £700;
- rival Buy Now closes once at £760;
- reset invalidates old auction sessions while preserving presenter;
- public/seller/primary/rival `snapshotFor` results pass their strict schemas.

Run:

```bash
npm run test -w @fleek/server -- src/runtime/DemoRuntime.test.ts
```

Expected: FAIL because `DemoRuntime` is missing.

- [ ] **Step 3: Implement the runtime surface and injected dependencies**

Create `DemoRuntime.ts` around:

```ts
export type RuntimeEvent =
  | { type: 'snapshots_changed' }
  | { type: 'sessions_expired'; sessionIds: readonly string[] }

export interface RuntimeDependencies {
  now: () => number
  nextId: () => string
  setInterval: (callback: () => void, ms: number) => NodeJS.Timeout
  clearInterval: (handle: NodeJS.Timeout) => void
  sessions: SessionRegistry
  parser: MandateParser
  fallbackParser: MandateParser
  modelConfigured: boolean
  guidanceRows: readonly ComparableRow[]
}

export class DemoRuntime {
  readonly presenterBootstrapCode: string
  constructor(dependencies: RuntimeDependencies)
  reset(presenter: SessionContext): Promise<DemoResetResponse>
  parseMandate(session: SessionContext, request: MandateParseRequest): Promise<MandateParseResponse>
  dispatch(
    session: SessionContext,
    event: 'auction:publish' | 'auction:set-max' | 'auction:buy-now' | 'mandate:approve',
    command: PublishCommand | SetMaxCommand | BuyNowCommand | ApproveMandateCommand,
  ): Promise<CommandAck>
  snapshotFor(session: SessionContext): AuctionSnapshot
  guidanceFor(session: SessionContext, lotId: string): GuidanceResponse | null
  subscribe(listener: (event: RuntimeEvent) => void): () => void
  tick(nowMs?: number): void
  stop(): void
}
```

Internal runtime state contains exactly:

- current `AuctionState` and monotonically increasing generation;
- `ProjectionPrivateState` for approved mandates and agent status;
- stored parse records keyed by parse ID and bound to primary session/auction/generation/lot version;
- idempotency records keyed by `auctionId:sessionId:commandId` with event name, stable hash, and acknowledgement;
- one `SerialQueue`, timer handle, last emitted countdown second, and listener set.

- [ ] **Step 4: Implement authorization, approval policy, idempotency, and expiry**

Use one role capability function:

```ts
const allowed = {
  'auction:publish': ['seller'],
  'auction:set-max': ['rival_buyer'],
  'auction:buy-now': ['rival_buyer', 'primary_buyer'],
  'mandate:approve': ['primary_buyer'],
} as const
```

Before dispatch:

1. authenticate the supplied `SessionContext` against current scope;
2. parse the event-specific schema;
3. reject stale auction/generation;
4. check the idempotency key/hash;
5. run the command in `SerialQueue`;
6. store the acknowledgement and notify listeners after a changed state.

For primary `mandate:approve`, retrieve the stored parse record, require every approved parsed field to match it, require `maxTotalPence < buyNowPricePence` for `auction`, store the approved mandate privately, and internally apply one `set_max` as bidder `primary`. For `certainty`, require `allowBuyNow` and a maximum at least Buy Now, then internally apply Buy Now instead. Primary direct `auction:buy-now` is accepted only when its approved mandate has `preference: 'certainty'`, `allowBuyNow: true`, and sufficient maximum. Rival Buy Now is direct.

When the engine leader changes after a rival maximum, set primary agent status to `active` if still leading or `stopped` if outbid. On terminal states set winner to `won` and the other buyer to `lost`.

Publishing starts a 250 ms interval tagged with the current generation. `tick` no-ops for stale generations, applies expiry at the exact deadline, notifies only when state changes or displayed seconds change, and clears the interval after close. Reset/Buy Now/stop also clear it.

- [ ] **Step 5: Verify runtime behaviour and commit**

Run:

```bash
npm run test -w @fleek/server -- src/runtime/DemoRuntime.test.ts
npm run typecheck -w @fleek/server
npm run lint
```

Expected: all runtime role, lifecycle, idempotency, reset, and timer tests pass.

Commit:

```bash
git add apps/server/src/runtime
git commit -m "feat: add authoritative auction runtime"
```

---

### Task 6: Compose HTTP, Socket.IO, and real-client lifecycle integration

**Files:**
- Create: `apps/server/src/runtime/createDefaultRuntime.ts`
- Create: `apps/server/src/http/registerRoutes.ts`
- Create: `apps/server/src/sockets/registerSocketHandlers.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`
- Modify: `apps/server/src/index.ts`

**Interfaces:**
- Consumes: `DemoRuntime`, `SessionRegistry`, parser factory, contracts, and existing Express/Socket.IO scaffold.
- Produces: the five approved HTTP endpoints, authenticated typed socket commands, role-specific broadcasts, and a printed presenter URL.

- [ ] **Step 1: Build the default runtime composition without new dependencies**

Create `createDefaultRuntime.ts` that:

1. instantiates `SessionRegistry`;
2. calls `createMandateParser(process.env)`;
3. reads `data/comparables.json` with `readFileSync(new URL('../../../../data/comparables.json', import.meta.url), 'utf8')` and validates rows before use;
4. constructs `DemoRuntime` with `Date.now`, `randomUUID`, global timers, live/fallback parsers, model status, and rows;
5. returns `{ runtime, sessions, modelConfigured }`.

Keep this factory injectable:

```ts
export interface RuntimeBundle {
  runtime: DemoRuntime
  sessions: SessionRegistry
  modelConfigured: boolean
}

export function createDefaultRuntime(): RuntimeBundle
```

- [ ] **Step 2: Write RED HTTP route tests**

Extend `apps/server/src/app.test.ts` with a started server and injected deterministic runtime bundle. Assert:

- `GET /api/health` preserves the existing schema and reports model status;
- `POST /api/sessions/exchange` exchanges the initial presenter code once and returns `410 { code: 'SESSION_EXPIRED' }` on reuse;
- `POST /api/demo/reset` returns `401` without bearer auth and returns fresh role links with a presenter token;
- `GET /api/guidance/sweatshirt-lot` returns £560/£640/£720 for any current valid role token;
- `POST /api/mandates/parse` rejects seller/public/rival tokens with `403`;
- parse request with `maxTotalPence`, `reservePricePence`, or any unknown key returns `400 INVALID_COMMAND`;
- primary `mode: 'structured_fallback'` returns a strict labelled parse response.

Run:

```bash
npm run test -w @fleek/server -- src/app.test.ts
```

Expected: the new endpoint tests fail with 404.

- [ ] **Step 3: Register strict HTTP routes**

Create `registerRoutes.ts`:

```ts
export function registerRoutes(input: {
  app: Express
  runtime: DemoRuntime
  sessions: SessionRegistry
  modelConfigured: boolean
}): void
```

Implement:

- `GET /api/health`: unchanged strict health payload.
- `POST /api/sessions/exchange`: parse `SessionExchangeRequestSchema`; exchange once; return `410 SESSION_EXPIRED` when absent/reused.
- `POST /api/demo/reset`: read/authenticate bearer token; require presenter; parse a strict empty object; await runtime reset.
- `GET /api/guidance/:lotId`: authenticate any current session; return `404 LOT_NOT_FOUND` for an unknown ID.
- `POST /api/mandates/parse`: authenticate primary buyer; parse `MandateParseRequestSchema`; call runtime; map typed model errors to `503` with `{ code, message, fallbackAvailable: true }`; do not include provider response bodies.

Use one `sendError(response, status, code, message, extras?)` helper that returns only redacted, fixed strings.

- [ ] **Step 4: Write RED real Socket.IO lifecycle tests**

Add helpers in `app.test.ts` to connect a typed client with `{ auth: { token }, transports: ['websocket'] }` and wait for `auction:snapshot`. Use HTTP to exchange fresh role links, then assert:

1. seller publishes the locked terms;
2. primary calls fallback parse over HTTP and approves £690 over Socket.IO;
3. public snapshot becomes £620/reserve met;
4. rival emits £650 and all clients update to £660 without another primary command;
5. primary snapshot contains £690 but no £650; rival contains £650 but no £690; public contains neither; seller contains reserve but neither maximum;
6. disconnect/reconnect primary and immediately receive the latest £660 snapshot;
7. advance the injected fake clock to `endsAtMs`, call `runtime.tick()`, and receive terminal £660 snapshots;
8. reset from presenter and assert old role clients receive `session:error` then disconnect;
9. repeat with a £710 rival and assert £700;
10. reset and let rival Buy Now close once at £760.

Preserve the current missing-ack and malformed-ping regression tests.

- [ ] **Step 5: Register authenticated socket handlers and projected broadcasts**

Create `registerSocketHandlers.ts`:

```ts
export interface DemoSocketData { session: SessionContext }

export function registerSocketHandlers(input: {
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, DemoSocketData>
  runtime: DemoRuntime
  sessions: SessionRegistry
}): () => void
```

Implementation rules:

- Socket middleware reads `socket.handshake.auth.token`, authenticates it, and stores only the immutable session context in `socket.data`.
- Invalid authentication rejects connection with an error whose `data` is `{ code: 'SESSION_EXPIRED' }`.
- Connection emits `system:ready` and that session's complete latest `auction:snapshot`.
- Preserve `system:ping` including its missing-ack guard.
- Each command handler first guards the acknowledgement callback, strictly parses the payload, calls `runtime.dispatch(socket.data.session, eventName, payload)`, and acknowledges with a redacted `CommandAck`.
- On `snapshots_changed`, iterate connected sockets and emit `runtime.snapshotFor(socket.data.session)` individually.
- On `sessions_expired`, find sockets by `sessionId`, emit `session:error`, then disconnect them.
- Return the runtime unsubscribe function for server cleanup.

- [ ] **Step 6: Refactor the composition root and presenter startup message**

Change `createApp` to:

```ts
export function createApp(bundle: RuntimeBundle = createDefaultRuntime()) {
  const expressApp = express()
  expressApp.use(express.json({ limit: '32kb' }))
  registerRoutes({ app: expressApp, ...bundle })
  const httpServer = createServer(expressApp)
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, DemoSocketData>(httpServer, { path: '/socket.io' })
  const unsubscribe = registerSocketHandlers({ io, runtime: bundle.runtime, sessions: bundle.sessions })
  httpServer.on('close', () => { unsubscribe(); bundle.runtime.stop() })
  return {
    expressApp,
    httpServer,
    io,
    runtime: bundle.runtime,
    presenterPath: `/demo?code=${encodeURIComponent(bundle.runtime.presenterBootstrapCode)}`,
  }
}
```

In `index.ts`, bind to `127.0.0.1:3001` as before and log both the server URL and `http://127.0.0.1:5173${presenterPath}`. Never log any role token or model credential.

- [ ] **Step 7: Verify server integration and commit**

Run:

```bash
npm run test -w @fleek/server
npm run typecheck -w @fleek/server
npm run build -w @fleek/server
npm run lint
```

Expected: original health/ping tests and the full real-client lifecycle pass; all checks exit `0`.

Commit:

```bash
git add apps/server/src
git commit -m "feat: connect live auction server"
```

---

### Task 7: Add the browser session, HTTP, socket, and view-model layer

**Files:**
- Modify: `apps/web/src/lib/routes.ts`
- Modify: `apps/web/src/lib/routes.test.ts`
- Create: `apps/web/src/lib/money.ts`
- Create: `apps/web/src/lib/money.test.ts`
- Create: `apps/web/src/lib/countdown.ts`
- Create: `apps/web/src/lib/countdown.test.ts`
- Create: `apps/web/src/lib/session-storage.ts`
- Create: `apps/web/src/lib/session-storage.test.ts`
- Create: `apps/web/src/lib/http.ts`
- Create: `apps/web/src/auction/snapshot-fixtures.ts`
- Create: `apps/web/src/auction/snapshot-fixtures.test.ts`
- Create: `apps/web/src/auction/socket-client.ts`
- Create: `apps/web/src/session/use-role-session.ts`
- Modify: `apps/web/src/socket.ts`

**Interfaces:**
- Consumes: frozen HTTP and Socket.IO contracts.
- Produces: route resolution, formatting/parsing helpers, token storage, authenticated HTTP functions, a token-bound socket, schema-valid fixtures, and `useRoleSession`.

- [ ] **Step 1: Extend routing and write helper RED tests**

Add `'/rival' -> 'rival'` and the `rival` member to `DemoScreen`. Extend the current route table test.

Create tests for these exact helpers:

```ts
expect(parsePoundsToPence('£690')).toBe(69_000)
expect(parsePoundsToPence('760.50')).toBe(76_050)
expect(parsePoundsToPence('-1')).toBeNull()
expect(parsePoundsToPence('12.345')).toBeNull()
expect(formatPence(66_000)).toBe('£660')
expect(formatPence(76_050)).toBe('£760.50')

expect(formatCountdown(91_000, 1_000)).toBe('1m 30s')
expect(formatCountdown(91_000, 90_100)).toBe('1s')
expect(formatCountdown(91_000, 91_000)).toBe('Ended')
```

Implement `parsePoundsToPence` with a currency-symbol/comma cleanup plus `/^\d+(?:\.\d{1,2})?$/`; convert using string major/minor parts, not floating-point multiplication. `formatPence` uses integer division and two-digit minor units. `formatCountdown` rounds remaining milliseconds up to a whole second.

- [ ] **Step 2: Write and implement route-scoped session-storage helpers**

Create `session-storage.test.ts` with an in-memory `StorageLike` and assert:

- token keys are `fleek-auction:session:presenter|seller|market|buyer|rival`;
- seller and buyer tokens never overwrite each other;
- clearing an expired route removes only that route;
- `readBootstrapCode(new URL('http://demo/buyer?code=<uuid>'))` returns the UUID;
- `withoutBootstrapCode` removes `code` and preserves every other query parameter.

Create `session-storage.ts`:

```ts
export type RoleRoute = 'presenter' | 'seller' | 'market' | 'buyer' | 'rival'
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const sessionKey = (role: RoleRoute) => `fleek-auction:session:${role}`
export const readStoredToken = (storage: StorageLike, role: RoleRoute) => storage.getItem(sessionKey(role))
export const storeToken = (storage: StorageLike, role: RoleRoute, token: string) => storage.setItem(sessionKey(role), token)
export const clearToken = (storage: StorageLike, role: RoleRoute) => storage.removeItem(sessionKey(role))
export const readBootstrapCode = (url: URL) => url.searchParams.get('code')
export function withoutBootstrapCode(url: URL): string {
  const copy = new URL(url)
  copy.searchParams.delete('code')
  return `${copy.pathname}${copy.search}${copy.hash}`
}
```

- [ ] **Step 3: Add schema-valid snapshots for UI development and privacy tests**

Create `snapshot-fixtures.ts` using frozen timestamps and contract types. Export:

- `sellerDraftSnapshot`;
- `publicPublishedSnapshot`;
- `primaryPreApprovalSnapshot`;
- `primaryLeadingSnapshot` at £620;
- `baselineAfterRivalSnapshot` at £660 with primary leading;
- `alternatePrimarySnapshot` at £700 with primary stopped;
- `alternateRivalSnapshot` at £700 with rival leading;
- `baselineClosedSnapshot` at £660;
- `buyNowClosedSnapshot` at £760;
- `fallbackParsedMandate` and `liveParsedMandate`.

Use `serverNowMs = 1_000` and `endsAtMs = 91_000`. Baseline public bid count is `2`, not the old HTML's `3 automatic bids`. In `snapshot-fixtures.test.ts`, parse every snapshot with `AuctionSnapshotSchema` and assert structural privacy: public has no reserve/max/mandate/private-event keys; seller has reserve but no buyer-private keys; each buyer has one `ownMaxPence` and no other party identity or maximum. Do not treat a publicly visible price equal to £620 as a reserve leak.

- [ ] **Step 4: Implement strict HTTP adapters**

Create `http.ts`:

```ts
import {
  DemoResetResponseSchema,
  GuidanceResponseSchema,
  MandateParseResponseSchema,
  SessionExchangeResponseSchema,
  type MandateParseRequest,
} from '@fleek/contracts'

async function readJson(response: Response): Promise<unknown> {
  const payload: unknown = await response.json()
  if (!response.ok) {
    const error = payload as { code?: string; message?: string; fallbackAvailable?: boolean }
    throw Object.assign(new Error(error.message ?? `Request failed with ${response.status}`), {
      code: error.code ?? 'HTTP_ERROR',
      fallbackAvailable: Boolean(error.fallbackAvailable),
    })
  }
  return payload
}

export async function exchangeSession(code: string) {
  return SessionExchangeResponseSchema.parse(await readJson(await fetch('/api/sessions/exchange', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
  })))
}

export async function resetDemo(token: string) {
  return DemoResetResponseSchema.parse(await readJson(await fetch('/api/demo/reset', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
  })))
}

export async function getGuidance(token: string, lotId: string) {
  return GuidanceResponseSchema.parse(await readJson(await fetch(`/api/guidance/${encodeURIComponent(lotId)}`, {
    headers: { authorization: `Bearer ${token}` },
  })))
}

export async function parseMandate(token: string, request: MandateParseRequest) {
  return MandateParseResponseSchema.parse(await readJson(await fetch('/api/mandates/parse', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(request),
  })))
}
```

- [ ] **Step 5: Replace the global socket with a token-bound factory**

Change `socket.ts` to re-export from `auction/socket-client.ts`. Create:

```ts
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'

export type DemoSocket = Socket<ServerToClientEvents, ClientToServerEvents>
export function createDemoSocket(token: string): DemoSocket {
  return io({ autoConnect: false, path: '/socket.io', auth: { token } })
}
```

Do not connect before code exchange. A factory prevents React StrictMode cleanup from mutating a shared singleton.

- [ ] **Step 6: Implement the role-session hook without optimistic auction state**

Create `use-role-session.ts` exporting:

```ts
export type SessionPhase = 'exchanging' | 'connecting' | 'ready' | 'reconnecting' | 'missing' | 'expired' | 'error'
export type CommandInputByEvent = {
  'auction:publish': Omit<PublishCommand, 'commandId'>
  'auction:set-max': Omit<SetMaxCommand, 'commandId'>
  'auction:buy-now': Omit<BuyNowCommand, 'commandId'>
  'mandate:approve': Omit<ApproveMandateCommand, 'commandId'>
}
export function useRoleSession(input: {
  route: 'presenter' | 'seller' | 'market' | 'buyer' | 'rival'
  expectedRole: 'presenter' | 'seller' | 'public' | 'primary_buyer' | 'rival_buyer'
}): {
  phase: SessionPhase
  token: string | null
  snapshot: AuctionSnapshot | null
  error: { code: string; message: string } | null
  sendCommand: <Event extends keyof CommandInputByEvent>(
    event: Event,
    payload: CommandInputByEvent[Event],
  ) => Promise<CommandAck>
}
```

The hook must:

1. exchange `?code=` once, store the token, and call `history.replaceState` with `withoutBootstrapCode`;
2. otherwise load only the route-scoped session token;
3. create/connect one token-bound socket and parse every snapshot with `AuctionSnapshotSchema`;
4. verify the received viewer/party matches the route before setting `ready`;
5. set `reconnecting` on disconnect and recover from the next complete snapshot;
6. clear only this route's token and set `expired` on `session:error` or connect error code `SESSION_EXPIRED`;
7. make `sendCommand` add one `createRequestId()` command ID per explicit submission, use `socket.timeout(1_500).emitWithAck`, parse `CommandAckSchema`, and never mutate the snapshot optimistically;
8. remove only listeners installed by this hook and disconnect its socket during cleanup.

- [ ] **Step 7: Verify the web data layer and commit**

Run:

```bash
npm run test -w @fleek/web
npm run typecheck -w @fleek/web
npm run build -w @fleek/web
npm run lint
```

Expected: routes, money, countdown, storage, fixtures, existing transport, and request-ID tests pass; builds are green.

Commit:

```bash
git add apps/web/src/lib apps/web/src/auction apps/web/src/session apps/web/src/socket.ts
git commit -m "feat: add live demo web client"
```

---

### Task 8: Port the approved UI into live React role screens

**Files:**
- Create: `apps/web/src/auction/view-model.ts`
- Create: `apps/web/src/auction/view-model.test.ts`
- Create: `apps/web/src/components/AppHeader.tsx`
- Create: `apps/web/src/components/LotArtwork.tsx`
- Create: `apps/web/src/components/StatusChip.tsx`
- Create: `apps/web/src/components/ActivityLog.tsx`
- Create: `apps/web/src/components/EndState.tsx`
- Create: `apps/web/src/components/ConnectionBanner.tsx`
- Create: `apps/web/src/screens/DemoLaunchpadScreen.tsx`
- Create: `apps/web/src/screens/SellerScreen.tsx`
- Create: `apps/web/src/screens/MarketScreen.tsx`
- Create: `apps/web/src/screens/BuyerScreen.tsx`
- Create: `apps/web/src/screens/RivalScreen.tsx`
- Create: `apps/web/src/screens/SessionExpiredScreen.tsx`
- Create: `apps/web/src/screens/NotFoundScreen.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `useRoleSession`, HTTP adapters, snapshot contracts, and output UI assets.
- Produces: presenter, seller, market, primary-buyer, and rival-buyer screens connected only through typed callbacks and snapshots.

- [ ] **Step 1: Prove the pure UI audience and terminal-state selectors**

Create `view-model.test.ts`:

```ts
expect(isClosed('live')).toBe(false)
expect(isClosed('sold_auction_pending_qc')).toBe(true)
expect(endStateCopy('sold_auction_pending_qc', true)).toBe('Won at auction — pending Fleek physical QC')
expect(endStateCopy('sold_buy_now_pending_qc', true)).toBe('Won via Buy Now — pending Fleek physical QC')
expect(endStateCopy('ended_unsold', false)).toBe('Auction ended without a sale — private reserve not met')
expect(selectActivity(primaryLeadingSnapshot, 'public')).toEqual(primaryLeadingSnapshot.publicEvents)
expect(selectActivity(primaryLeadingSnapshot, 'private')).toEqual(primaryLeadingSnapshot.privateEvents)
expect(selectActivity(primaryLeadingSnapshot, 'private')).not.toContainEqual(expect.objectContaining({ type: 'published' }))
```

Implement:

```ts
export const isClosed = (status: AuctionStatus) => status !== 'draft' && status !== 'live'
export function endStateCopy(status: AuctionStatus, won: boolean): string | null {
  if (status === 'sold_auction_pending_qc') return won ? 'Won at auction — pending Fleek physical QC' : 'Auction sold — pending Fleek physical QC'
  if (status === 'sold_buy_now_pending_qc') return won ? 'Won via Buy Now — pending Fleek physical QC' : 'Sold via Buy Now — pending Fleek physical QC'
  if (status === 'ended_unsold') return 'Auction ended without a sale — private reserve not met'
  return null
}
export function selectActivity(snapshot: BuyerSnapshot, tab: 'public' | 'private') {
  return tab === 'public' ? snapshot.publicEvents : snapshot.privateEvents
}
```

- [ ] **Step 2: Port visual primitives without behavioural state**

Implement:

- `AppHeader`: Fleek mark, Auction House name, current role as a non-interactive active pill, hackathon badge, and connection state.
- `LotArtwork`: JSX versions of the sweatshirt, jeans, and tops SVGs from the output HTML. Render LIVE/DEMO badges as sibling overlays so setting SVG content cannot delete them.
- `StatusChip`: variants `default|live|success|warning|private|public`.
- `ActivityLog`: `publicEvents`, optional `privateEvents`, controlled tab, and no additive merge.
- `EndState`: terminal copy from `endStateCopy`, plus `Hackathon demonstration — payment not processed`.
- `ConnectionBanner`: visible for exchanging/connecting/reconnecting/error/expired and silent when ready.

No component stores or computes auction state.

- [ ] **Step 3: Build the presenter launchpad and seller screen**

`DemoLaunchpadScreen` receives `{ token, phase }`, calls `resetDemo(token)`, and renders server/model status plus four returned links. Each role row has Open and Copy actions. Copy uses `navigator.clipboard.writeText(new URL(relativeLink, window.location.origin).toString())`. There is no rival, close, expiry, or Buy Now simulation action.

`SellerScreen` receives a strict seller snapshot and token. It:

- fetches guidance for `sweatshirt-lot`;
- initializes controlled strings `520`, `620`, `760`, and duration `90`;
- derives the right summary and 15% demo net estimates from the controlled values;
- validates all money via `parsePoundsToPence` and `start <= reserve <= Buy Now`;
- sends `auction:publish` with entered values, `incrementPence: 1_000`, `durationMs: durationSeconds * 1_000`, current auction/generation, and lot version;
- locks the form when status is not `draft`;
- shows the seller-only reserve and no buyer maximum.

Use the output copy: `Create an auction`, `Set your prices once. Buyers can bid or buy instantly while you're away.`, and `Your reserve stays hidden. Buyers only see whether it has been met.`

- [ ] **Step 4: Build the public market from one snapshot**

`MarketScreen` renders:

- one interactive live card driven entirely by the public snapshot;
- two fixed cards labelled `DEMO LISTING` for the Levi's and Y2K lots;
- current price, reserve status, bid count, Buy Now, countdown, and end state from the same snapshot;
- a read-only detail disclosure for the live card rather than navigation into a buyer role.

Filters remain visual chips for this timebox; only `All auctions` is active. Static cards never issue commands.

- [ ] **Step 5: Build the primary buyer mandate and proxy flow**

`BuyerScreen` holds only UI form state: sourcing text, parsed response, maximum string, allow-Buy-Now checkbox, active activity tab, pending/error/toast.

Flow:

1. Submit `parseMandate(token, { auctionId, generation, lotVersion: 1, sourcingText, mode: 'auto' })`.
2. If the server throws with `fallbackAvailable`, show `Use structured fallback`; that action repeats with `mode: 'structured_fallback'`.
3. Render parsed category, grade, preference, explanation, and one of:
   - `Live model`;
   - `Structured fallback — no LLM interpreted this text`.
4. Parse the separate maximum; never include it in the parse request.
5. Send `mandate:approve` with parse identity, parsed category/grade/preference, maximum, allow Buy Now, and the current scope.
6. Render own maximum, leader state, agent status, price, reserve state, countdown, and events only from the next snapshot.
7. Disable every action when terminal. Keep the visual Buy Now row, but enable the primary Buy Now button only when an approved certainty mandate permits it; otherwise explain `Choose Prefer certainty to allow Buy Now`.

Use baseline default text and `£690` maximum. A real rival snapshot changes the visible price without a buyer click.

- [ ] **Step 6: Build the rival screen and explicit Buy Now path**

`RivalScreen` reuses the buyer three-column layout and live auction panel. Replace mandate UI with:

- direct private maximum input defaulting to `£650`;
- hint `Use £710 to rehearse the alternate outcome`;
- `Set private maximum` calling `auction:set-max` with entered pence;
- `Buy now` calling `auction:buy-now`;
- own maximum, leader state, and private events from the rival snapshot only.

The component must not contain or render the primary buyer's name, parsed mandate, or maximum.

- [ ] **Step 7: Replace the scaffold App with route-bound role composition**

`App.tsx` resolves the route and renders one route component. For each protected role, call `useRoleSession` with the exact expected role:

```text
launchpad -> presenter
seller    -> seller
market    -> public
buyer     -> primary_buyer
rival     -> rival_buyer
```

Render `SessionExpiredScreen` for phase `expired`, a missing-code/session action for `missing`, `NotFoundScreen` for unknown paths, and `ConnectionBanner` over every active screen. Never offer a role switch that reuses another role's token.

- [ ] **Step 8: Port CSS tokens/layout and add the approved responsive cut**

Replace `styles.css` with the output tokens and class groups for topbar, shell, cards, chips, seller grid, guidance, fields, feed cards, buyer grid, auction panel, proxy card, activity log, toasts, and end states.

Mandatory CSS rules:

```css
:root { --ink:#11110f; --paper:#f5f4ef; --surface:#fff; --line:#deddd7; --muted:#6f6d67; --yellow:#f6d83b; --violet:#6258d4; --green:#087647; --amber:#8b5a08; }
body { margin:0; min-width:320px; min-height:100vh; background:var(--paper); color:var(--ink); }
.seller-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(280px,.72fr); gap:20px; }
.buyer-grid { display:grid; grid-template-columns:minmax(260px,.95fr) minmax(360px,1fr) minmax(260px,.72fr); gap:20px; }
.feed-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
@media (max-width:980px) {
  .seller-grid,.buyer-grid,.feed-grid { grid-template-columns:1fr; }
  .topbar,.launch-actions,.proxy-actions { flex-wrap:wrap; }
  .summary-card { position:static; }
}
```

Do not add `min-width: 1180px`. Remove the old fixed presenter tray entirely. Preserve visible focus styles and button disabled states.

- [ ] **Step 9: Verify UI compilation and commit**

Run:

```bash
npm run test -w @fleek/web
npm run typecheck -w @fleek/web
npm run build -w @fleek/web
npm run lint
```

Expected: web helper/fixture/view-model tests pass and the full React UI builds.

Commit:

```bash
git add apps/web/src
git commit -m "feat: add auction role screens"
```

---

### Task 9: Integrate, rehearse, document, and update the draft PR

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/qa-checklist.md`
- Modify: `docs/model-preflight.md`
- Modify only if integration requires it: `apps/web/src/App.tsx`
- Modify only if integration requires it: `apps/server/src/app.ts`

**Interfaces:**
- Consumes: reviewed backend and UI commits from the contract-freeze SHA.
- Produces: one verified branch, one-command local startup, exact runbook, screenshots/live evidence, and an updated draft PR.

- [ ] **Step 1: Integrate reviewed commits without changing frozen contracts**

From the `scaffold` worktree, cherry-pick or merge the reviewed backend and UI task commits in dependency order. Run:

```bash
git diff CONTRACT_FREEZE_SHA..HEAD -- packages/contracts
```

Expected: only the reviewed Task 1 contract commit affects `packages/contracts`. If backend and UI agents independently changed a frozen schema, stop and reconcile to Task 1 before continuing.

Resolve integration in `App.tsx` and `app.ts` only; do not move auction arithmetic into React or send full private state over Socket.IO.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm install
npm run verify
```

Expected:

- ESLint exits `0`;
- all contract, engine, guidance, projection, session, model, runtime, HTTP/socket, and web tests pass;
- all three workspaces typecheck and build;
- `apps/web/dist/index.html` and `apps/server/dist/index.js` exist.

If any check fails, fix the owning module and rerun `npm run verify`; do not delete a privacy, lifecycle, or golden-path test to make the suite green.

- [ ] **Step 3: Update the local runbook with exact honest claims**

Update `README.md` to include:

````markdown
## Run the demo

```bash
npm install
npm run dev
```

Open the presenter URL printed by the server. Reset creates fresh Seller, Market, Primary Buyer, and Rival Buyer links.

### Baseline path

1. Seller publishes £520 start, £620 private reserve, £760 Buy Now, and a 90-second duration.
2. Primary Buyer parses the sourcing text. Without model credentials, use the visibly labelled structured fallback.
3. Primary Buyer approves a separate £690 maximum.
4. Rival Buyer submits £650.
5. The proxy keeps Primary Buyer leading at £660.
6. The server timer closes at £660, pending Fleek physical QC.

Use £710 in the Rival Buyer view for the alternate £700 outcome. Use Rival Buy Now for the £760 path.

No payment is processed. Comparable rows are synthetic demo data. A fallback result is not a live LLM response.
````

Add the current working-demo spec link. Keep `.env.example` values empty.

- [ ] **Step 4: Make the demo and QA documents executable**

Update `docs/demo-script.md` to use real role links and remove any presenter-simulated rival/close instruction. Update `docs/qa-checklist.md` with checkboxes for:

- presenter exchange/reset;
- seller publish;
- fallback source label;
- baseline £660;
- alternate £700;
- Buy Now £760;
- reconnect latest snapshot;
- session invalidation after reset;
- public/seller/buyer privacy inspection;
- 1440px visual comparison and 980px stacked layout;
- browser/dev-process cleanup.

Update `docs/model-preflight.md` to say `Not configured` unless a real redacted provider response was observed. Never invent provider, retention, or live-response evidence.

- [ ] **Step 5: Run the bounded multi-browser baseline smoke**

Start `npm run dev` in one owning terminal and capture the printed presenter URL. In isolated browser sessions:

1. exchange presenter code and Reset;
2. open Seller, Market, Primary Buyer, and Rival Buyer links;
3. publish the locked terms;
4. parse the locked sourcing text and explicitly choose fallback if model is unconfigured;
5. approve £690;
6. submit £650 in the rival browser;
7. verify buyer and market update to £660 without another primary click;
8. disconnect/reload primary and verify it returns at £660;
9. wait for server expiry and verify primary `Won at auction — pending Fleek physical QC`;
10. verify controls are disabled after close.

Record actual timestamps, source label, result, and defects in the Task 9 implementation report.

- [ ] **Step 6: Run alternate and Buy Now smoke paths**

Reset for fresh links. Publish again, approve primary £690, submit rival £710, and verify rival leads/closes at £700. Reset again, publish, use Rival Buy Now, verify one £760 close, and prove a second action returns `AUCTION_CLOSED` without state change.

At 1440px compare Seller, Market, and Buyer against the supplied PNGs. At 1024px, 900px, and 390px verify no horizontal overflow and stacked cards/actions. Static cards must show `DEMO LISTING`; the buyer view must show `Hackathon demonstration — payment not processed`.

- [ ] **Step 7: Stop every live process and prove repository cleanliness**

Close browser automation sessions. Stop `npm run dev` through its owning terminal. Confirm ports have no listeners:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Expected: both commands print no listeners. Then run:

```bash
git diff --check
git status --short
npm run verify
```

Expected: only intended runbook/demo-document changes are uncommitted before the final documentation commit; final verification exits `0`.

- [ ] **Step 8: Commit, push, and update the existing draft PR**

Commit:

```bash
git add README.md docs/demo-script.md docs/qa-checklist.md docs/model-preflight.md
git commit -m "docs: package working auction demo"
git push origin scaffold
```

Update draft PR #1 title to `Build working Fleek Auction House demo`. Its body must report:

- server-authoritative multi-browser auction;
- baseline £660, alternate £700, and Buy Now £760 evidence;
- model source actually used;
- test/verify counts;
- live browser smoke results;
- explicit exclusions: payments, production auth/API, persistence, and physical QC.

Keep the PR draft until the team rehearses the three-minute pitch.

---

## Completion report

Report:

- branch and final commit;
- PR URL;
- exact test count and `npm run verify` result;
- local presenter URL pattern;
- baseline, alternate, and Buy Now observed results;
- model source observed (`live_model` or `structured_fallback`);
- screenshots/viewport checks completed;
- confirmation that ports are clean and no credentials were committed;
- any cut scope or unresolved blocker.
