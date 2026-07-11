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

## Boundaries

This repository is a hackathon demonstration. It does not connect to Fleek production APIs, process payments, authenticate real users, or perform physical QC.

See `docs/superpowers/specs/2026-07-11-fleek-auction-house-scaffold-design.md` for the approved system design.
