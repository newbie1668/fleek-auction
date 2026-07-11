# Fleek Auction House

Hackathon prototype for a Fleek-style wholesale auction with live rival bidding, a bounded buyer agent, and deterministic market clearing.

## Workspaces

- `apps/web` — Vite and React interface.
- `apps/server` — Express, Socket.IO, and server-authoritative state.
- `packages/contracts` — shared Zod schemas and TypeScript event contracts.

## Commands

```bash
npm install
npm run dev
npm run verify
```

Web: `http://localhost:5173`.  
Server health: `http://localhost:3001/api/health`.

On startup the server prints a presenter launchpad URL with a one-time bootstrap code. You can also open `http://localhost:5173/demo` and the launchpad will claim the presenter session.

## Demo path

1. Open the presenter launchpad and use **Reset demo fixture** if needed.
2. Open **Seller**, publish the locked terms (£520 / reserve £620 / Buy Now £760 / 90s).
3. Open **Primary buyer**, parse the sourcing mandate, set a £690 ceiling, approve the agent.
4. Open **Rival buyer**, register £650.
5. Watch the proxy hold the lead at £660, then let the timer clear to pending QC.
6. Reset and try rival £710 to prove a different £700 outcome.

Without `LLM_*` env vars the labelled structured fallback keeps the mandate path demonstrable.

## Boundaries

This repository is a hackathon demonstration. It does not connect to Fleek production APIs, process payments, authenticate real users, or perform physical QC.

See `docs/superpowers/specs/2026-07-11-fleek-auction-house-scaffold-design.md` for the approved system design.
