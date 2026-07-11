# Fleek Auction Repository Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a verified local Git repository that gives the engineer and design engineer independently runnable TypeScript workspaces, shared typed contracts, working HTTP and Socket.IO connectivity, and the approved project documentation.

**Architecture:** An npm-workspaces monorepo contains a Vite/React web application, an Express/Socket.IO server, and a compiled Zod contracts package. The scaffold proves the development, testing, build, proxy, and live-transport seams without implementing auction business logic.

**Tech Stack:** Node.js 22.12+, npm 11+, TypeScript, Vite, React, Express, Socket.IO, Zod, Vitest, ESLint, tsx, concurrently, Git.

## Global Constraints

- Repository path: `/Users/foomingli/Documents/Codex/2026-07-10/here/fleek-auction`.
- Initialise local Git with branch `main`; do not create a GitHub remote in this plan.
- Use npm workspaces in the order `packages/*`, then `apps/*`.
- Keep secrets out of Git; `.env.example` contains names only.
- Use integer milliseconds and strict Zod validation in shared health/transport contracts.
- The web application talks to `/api` and `/socket.io` through the Vite same-origin proxy.
- The server listens on `127.0.0.1:3001`; Vite listens on `0.0.0.0:5173` for second-device access.
- `npm run verify` must run lint, typecheck, tests, and builds successfully.
- This plan scaffolds boundaries only. Auction rules, role sessions, mandate parsing, comparables, and production UI belong to subsequent implementation plans.

---

## File map

```text
fleek-auction/
├── apps/
│   ├── server/
│   │   ├── src/app.test.ts       # HTTP and Socket.IO integration proof
│   │   ├── src/app.ts            # Express/HTTP/Socket.IO factory
│   │   ├── src/index.ts          # Process entrypoint
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/lib/routes.test.ts # screen resolver contract
│       ├── src/lib/routes.ts      # path-to-screen mapping
│       ├── src/App.tsx            # scaffold health/transport screen
│       ├── src/main.tsx           # React entrypoint
│       ├── src/socket.ts          # typed Socket.IO client
│       ├── src/styles.css         # initial design tokens and layout
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   └── contracts/
│       ├── src/index.test.ts      # Zod contract tests
│       ├── src/index.ts           # health and typed socket contracts
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── demo-script.md
│   ├── model-preflight.md
│   ├── product-decisions.md
│   ├── qa-checklist.md
│   └── superpowers/
│       ├── plans/2026-07-11-fleek-auction-repository-scaffold.md
│       └── specs/2026-07-11-fleek-auction-house-scaffold-design.md
├── .env.example
├── .gitignore
├── README.md
├── eslint.config.js
├── package.json
├── package-lock.json
└── tsconfig.base.json
```

---

### Task 1: Initialise the repository and root workspace

**Files:**
- Create: `fleek-auction/package.json`
- Create: `fleek-auction/tsconfig.base.json`
- Create: `fleek-auction/eslint.config.js`
- Create: `fleek-auction/.gitignore`
- Create: `fleek-auction/.env.example`
- Create: `fleek-auction/README.md`
- Create: `fleek-auction/docs/superpowers/specs/2026-07-11-fleek-auction-house-scaffold-design.md`
- Create: `fleek-auction/docs/superpowers/plans/2026-07-11-fleek-auction-repository-scaffold.md`

**Interfaces:**
- Consumes: the approved design and this implementation plan from `outputs/`.
- Produces: root scripts `dev`, `lint`, `typecheck`, `test`, `build`, and `verify`; shared TypeScript and ESLint configuration; local Git history.

- [ ] **Step 1: Create the repository directory and initialise Git**

```bash
mkdir -p /Users/foomingli/Documents/Codex/2026-07-10/here/fleek-auction/docs/superpowers/specs
mkdir -p /Users/foomingli/Documents/Codex/2026-07-10/here/fleek-auction/docs/superpowers/plans
cd /Users/foomingli/Documents/Codex/2026-07-10/here/fleek-auction
git init -b main
```

Expected: `Initialized empty Git repository` and `git branch --show-current` prints `main`.

- [ ] **Step 2: Copy the reviewed design and plan into the repository**

```bash
cp /Users/foomingli/Documents/Codex/2026-07-10/here/outputs/fleek-auction-house-scaffold-design.md docs/superpowers/specs/2026-07-11-fleek-auction-house-scaffold-design.md
cp /Users/foomingli/Documents/Codex/2026-07-10/here/outputs/fleek-auction-repository-scaffold-plan.md docs/superpowers/plans/2026-07-11-fleek-auction-repository-scaffold.md
```

Expected: both files exist inside `docs/superpowers/`.

- [ ] **Step 3: Create the root package configuration**

Create `package.json`:

```json
{
  "name": "fleek-auction",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12.0"
  },
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "npm run build -w @fleek/contracts && concurrently -k -n contracts,server,web -c yellow,cyan,magenta \"npm run dev -w @fleek/contracts\" \"npm run dev -w @fleek/server\" \"npm run dev -w @fleek/web\"",
    "lint": "eslint .",
    "typecheck": "npm run build -w @fleek/contracts && npm run typecheck -w @fleek/server && npm run typecheck -w @fleek/web",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build -w @fleek/contracts && npm run build -w @fleek/server && npm run build -w @fleek/web",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

- [ ] **Step 4: Create shared TypeScript configuration**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmitOnError": true
  }
}
```

- [ ] **Step 5: Create root lint configuration**

Create `eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/server/**/*.ts', 'packages/contracts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
```

- [ ] **Step 6: Create environment and Git exclusions**

Create `.env.example`:

```dotenv
PORT=3001
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
coverage/
.worktrees/
.superpowers/
```

- [ ] **Step 7: Create the repository README**

Create `README.md`:

````markdown
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

Web: `http://localhost:5173`  
Server health: `http://localhost:3001/api/health`

## Boundaries

This repository is a hackathon demonstration. It does not connect to Fleek production APIs, process payments, authenticate real users, or perform physical QC.

See `docs/superpowers/specs/2026-07-11-fleek-auction-house-scaffold-design.md` for the approved system design.
````

- [ ] **Step 8: Install root development dependencies**

```bash
npm install --save-dev concurrently eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh typescript
```

Expected: `package-lock.json` is created and `npm ls --depth=0` exits successfully.

- [ ] **Step 9: Verify the root configuration**

```bash
npm run lint
git status --short
```

Expected: lint exits `0`; Git lists only the new repository files.

- [ ] **Step 10: Commit the repository foundation**

```bash
git add .
git commit -m "chore: initialize fleek auction workspace"
```

Expected: first commit is created on `main`.

---

### Task 2: Add the compiled shared-contracts workspace

**Files:**
- Create: `fleek-auction/packages/contracts/package.json`
- Create: `fleek-auction/packages/contracts/tsconfig.json`
- Create: `fleek-auction/packages/contracts/src/index.test.ts`
- Create: `fleek-auction/packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: root TypeScript and ESLint configuration.
- Produces: `HealthStatusSchema`, `PingRequestSchema`, `PingAckSchema`, `ClientToServerEvents`, and `ServerToClientEvents` from `@fleek/contracts`.

- [ ] **Step 1: Create the contracts package and test configuration**

Create `packages/contracts/package.json`:

```json
{
  "name": "@fleek/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc -p tsconfig.json --watch --preserveWatchOutput",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Install package dependencies:

```bash
npm install -w @fleek/contracts zod
npm install --save-dev -w @fleek/contracts vitest
```

- [ ] **Step 2: Write the failing contract tests**

Create `packages/contracts/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HealthStatusSchema, PingAckSchema, PingRequestSchema } from './index.js'

describe('transport contracts', () => {
  it('accepts a safe health response', () => {
    const value = HealthStatusSchema.parse({
      status: 'ok',
      service: 'fleek-auction-server',
      modelConfigured: false,
      timestampMs: 1_000,
    })

    expect(value.status).toBe('ok')
  })

  it('rejects malformed ping requests', () => {
    expect(() => PingRequestSchema.parse({ requestId: 'not-a-uuid' })).toThrow()
  })

  it('accepts a successful ping acknowledgement', () => {
    const value = PingAckSchema.parse({
      ok: true,
      requestId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
      serverTimeMs: 1_000,
    })

    expect(value.ok).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm run test -w @fleek/contracts
```

Expected: FAIL because `packages/contracts/src/index.ts` does not exist.

- [ ] **Step 4: Implement the transport contracts**

Create `packages/contracts/src/index.ts`:

```ts
import { z } from 'zod'

export const HealthStatusSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('fleek-auction-server'),
    modelConfigured: z.boolean(),
    timestampMs: z.number().int().nonnegative(),
  })
  .strict()

export type HealthStatus = z.infer<typeof HealthStatusSchema>

export const PingRequestSchema = z
  .object({
    requestId: z.string().uuid(),
  })
  .strict()

export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingAckSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      requestId: z.string().uuid(),
      serverTimeMs: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.literal('INVALID_PING'),
    })
    .strict(),
])

export type PingAck = z.infer<typeof PingAckSchema>

export interface ClientToServerEvents {
  'system:ping': (payload: PingRequest, acknowledge: (response: PingAck) => void) => void
}

export interface ServerToClientEvents {
  'system:ready': (payload: HealthStatus) => void
}
```

- [ ] **Step 5: Verify contracts and build output**

```bash
npm run test -w @fleek/contracts
npm run typecheck -w @fleek/contracts
npm run build -w @fleek/contracts
```

Expected: three tests pass; `packages/contracts/dist/index.js` and `index.d.ts` exist.

- [ ] **Step 6: Commit the contracts workspace**

```bash
git add packages/contracts package.json package-lock.json
git commit -m "feat: add shared transport contracts"
```

---

### Task 3: Add the verified Express and Socket.IO server

**Files:**
- Create: `fleek-auction/apps/server/package.json`
- Create: `fleek-auction/apps/server/tsconfig.json`
- Create: `fleek-auction/apps/server/src/app.test.ts`
- Create: `fleek-auction/apps/server/src/app.ts`
- Create: `fleek-auction/apps/server/src/index.ts`

**Interfaces:**
- Consumes: `HealthStatusSchema`, `PingRequestSchema`, `ClientToServerEvents`, and `ServerToClientEvents` from `@fleek/contracts`.
- Produces: `createApp(): { httpServer, io }`, `GET /api/health`, `system:ready`, and acknowledged `system:ping`.

- [ ] **Step 1: Create the server workspace**

Create `apps/server/package.json`:

```json
{
  "name": "@fleek/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@fleek/contracts": "*"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

Create `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

Install dependencies:

```bash
npm install -w @fleek/server express socket.io
npm install --save-dev -w @fleek/server @types/express @types/node socket.io-client tsx vitest
npm install
npm run build -w @fleek/contracts
```

- [ ] **Step 2: Write failing server integration tests**

Create `apps/server/src/app.test.ts`:

```ts
import type { AddressInfo } from 'node:net'
import { io as createClient, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'
import { HealthStatusSchema, PingAckSchema } from '@fleek/contracts'
import { createApp } from './app.js'

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()))
})

async function startServer() {
  const app = createApp()
  await new Promise<void>((resolve) => app.httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = app.httpServer.address() as AddressInfo
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        app.io.close(() => resolve())
      }),
  )
  return { ...app, address: `http://127.0.0.1:${port}` }
}

describe('server scaffold', () => {
  it('returns a schema-valid health response', async () => {
    const { address } = await startServer()
    const response = await fetch(`${address}/api/health`)
    const health = HealthStatusSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(health.service).toBe('fleek-auction-server')
  })

  it('acknowledges a typed socket ping', async () => {
    const { address } = await startServer()
    const client: TestClient = createClient(address, {
      autoConnect: false,
      transports: ['websocket'],
    })
    cleanup.push(async () => {
      client.close()
    })

    const ready = new Promise<void>((resolve) => {
      client.once('system:ready', () => resolve())
    })
    client.connect()
    await ready

    const requestId = '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8'
    const response = await client.timeout(1_000).emitWithAck('system:ping', { requestId })
    const acknowledgement = PingAckSchema.parse(response)

    expect(acknowledgement).toMatchObject({ ok: true, requestId })
  })
})
```

- [ ] **Step 3: Run the server tests to verify they fail**

```bash
npm run test -w @fleek/server
```

Expected: FAIL because `apps/server/src/app.ts` does not exist.

- [ ] **Step 4: Implement the server factory**

Create `apps/server/src/app.ts`:

```ts
import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import {
  HealthStatusSchema,
  PingRequestSchema,
  type ClientToServerEvents,
  type HealthStatus,
  type ServerToClientEvents,
} from '@fleek/contracts'

function createHealthStatus(): HealthStatus {
  return HealthStatusSchema.parse({
    status: 'ok',
    service: 'fleek-auction-server',
    modelConfigured: Boolean(
      process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL,
    ),
    timestampMs: Date.now(),
  })
}

export function createApp() {
  const expressApp = express()
  expressApp.use(express.json())
  expressApp.get('/api/health', (_request, response) => {
    response.json(createHealthStatus())
  })

  const httpServer = createServer(expressApp)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/socket.io',
  })

  io.on('connection', (socket) => {
    socket.emit('system:ready', createHealthStatus())
    socket.on('system:ping', (payload, acknowledge) => {
      const parsed = PingRequestSchema.safeParse(payload)
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'INVALID_PING' })
        return
      }

      acknowledge({
        ok: true,
        requestId: parsed.data.requestId,
        serverTimeMs: Date.now(),
      })
    })
  })

  return { expressApp, httpServer, io }
}
```

Create `apps/server/src/index.ts`:

```ts
import { createApp } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const { httpServer } = createApp()

httpServer.listen(port, '127.0.0.1', () => {
  console.log(`Fleek Auction server listening on http://127.0.0.1:${port}`)
})
```

- [ ] **Step 5: Verify the server workspace**

```bash
npm run test -w @fleek/server
npm run typecheck -w @fleek/server
npm run build -w @fleek/server
```

Expected: two tests pass and `apps/server/dist/index.js` exists.

- [ ] **Step 6: Commit the server scaffold**

```bash
git add apps/server package.json package-lock.json
git commit -m "feat: add typed realtime server scaffold"
```

---

### Task 4: Add the Vite and React web scaffold

**Files:**
- Create: `fleek-auction/apps/web/package.json`
- Create: `fleek-auction/apps/web/tsconfig.json`
- Create: `fleek-auction/apps/web/vite.config.ts`
- Create: `fleek-auction/apps/web/index.html`
- Create: `fleek-auction/apps/web/src/lib/routes.test.ts`
- Create: `fleek-auction/apps/web/src/lib/routes.ts`
- Create: `fleek-auction/apps/web/src/socket.ts`
- Create: `fleek-auction/apps/web/src/App.tsx`
- Create: `fleek-auction/apps/web/src/main.tsx`
- Create: `fleek-auction/apps/web/src/styles.css`

**Interfaces:**
- Consumes: `HealthStatusSchema`, `ClientToServerEvents`, and `ServerToClientEvents` from `@fleek/contracts`; `/api/health`; `/socket.io`.
- Produces: `resolveScreen(pathname): DemoScreen`, a typed socket client, and a visible HTTP/socket health shell.

- [ ] **Step 1: Create the web workspace configuration**

Create `apps/web/package.json`:

```json
{
  "name": "@fleek/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@fleek/contracts": "*"
  },
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001' },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true },
    },
  },
  test: {
    environment: 'node',
  },
})
```

Install dependencies:

```bash
npm install -w @fleek/web react react-dom socket.io-client
npm install --save-dev -w @fleek/web @types/react @types/react-dom @vitejs/plugin-react vite vitest
npm install
npm run build -w @fleek/contracts
```

- [ ] **Step 2: Write the failing route test**

Create `apps/web/src/lib/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveScreen } from './routes'

describe('resolveScreen', () => {
  it.each([
    ['/demo', 'launchpad'],
    ['/seller', 'seller'],
    ['/market', 'market'],
    ['/buyer', 'buyer'],
    ['/unknown', 'not-found'],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(resolveScreen(pathname)).toBe(expected)
  })
})
```

- [ ] **Step 3: Run the web test to verify it fails**

```bash
npm run test -w @fleek/web
```

Expected: FAIL because `apps/web/src/lib/routes.ts` does not exist.

- [ ] **Step 4: Implement the route resolver**

Create `apps/web/src/lib/routes.ts`:

```ts
export type DemoScreen = 'launchpad' | 'seller' | 'market' | 'buyer' | 'not-found'

const screens: Readonly<Record<string, DemoScreen>> = {
  '/': 'launchpad',
  '/demo': 'launchpad',
  '/seller': 'seller',
  '/market': 'market',
  '/buyer': 'buyer',
}

export function resolveScreen(pathname: string): DemoScreen {
  return screens[pathname] ?? 'not-found'
}
```

- [ ] **Step 5: Implement the typed Socket.IO client**

Create `apps/web/src/socket.ts`:

```ts
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  path: '/socket.io',
})
```

- [ ] **Step 6: Implement the React scaffold screen**

Create `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { HealthStatusSchema, PingAckSchema, type HealthStatus } from '@fleek/contracts'
import { resolveScreen } from './lib/routes'
import { socket } from './socket'

type ConnectionState = 'connecting' | 'connected' | 'error'

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const screen = resolveScreen(window.location.pathname)

  useEffect(() => {
    const abortController = new AbortController()

    fetch('/api/health', { signal: abortController.signal })
      .then((response) => response.json())
      .then((payload) => setHealth(HealthStatusSchema.parse(payload)))
      .catch(() => setConnection('error'))

    socket.on('system:ready', (payload) => {
      setHealth(HealthStatusSchema.parse(payload))
      setConnection('connected')
      const requestId = crypto.randomUUID()
      socket.timeout(1_000).emit('system:ping', { requestId }, (error, response) => {
        if (error || !PingAckSchema.safeParse(response).success) setConnection('error')
      })
    })
    socket.on('connect_error', () => setConnection('error'))
    socket.connect()

    return () => {
      abortController.abort()
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])

  return (
    <main className="shell">
      <header className="header">
        <span className="mark" aria-hidden="true" />
        <strong>FLEEK AUCTION HOUSE</strong>
        <span className="badge">SCAFFOLD</span>
      </header>
      <section className="hero">
        <p className="eyebrow">Current screen · {screen}</p>
        <h1>The live market starts here.</h1>
        <p>Shared contracts, server health, and realtime transport are connected.</p>
      </section>
      <section className="status-grid" aria-label="Development status">
        <article>
          <span>HTTP server</span>
          <strong>{health?.status ?? 'checking'}</strong>
        </article>
        <article>
          <span>Socket.IO</span>
          <strong>{connection}</strong>
        </article>
        <article>
          <span>Live model</span>
          <strong>{health?.modelConfigured ? 'configured' : 'not configured'}</strong>
        </article>
      </section>
    </main>
  )
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `apps/web/src/styles.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: #11110f;
  background: #f5f4ef;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input, textarea { font: inherit; }

.shell { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 32px 0 72px; }
.header { display: flex; gap: 10px; align-items: center; padding-bottom: 22px; border-bottom: 2px solid #11110f; letter-spacing: .11em; font-size: 12px; }
.mark { width: 14px; height: 14px; border: 1.5px solid #11110f; border-radius: 4px 4px 7px 4px; background: #f6d83b; }
.badge { margin-left: auto; padding: 6px 10px; border-radius: 999px; color: #4238b5; background: #efedff; font-size: 10px; font-weight: 800; }
.hero { max-width: 780px; padding: 72px 0 48px; }
.eyebrow { color: #5e54d3; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
h1 { margin: 10px 0 16px; font-size: clamp(44px, 8vw, 84px); line-height: .92; letter-spacing: -.06em; }
.hero > p:last-child { max-width: 620px; color: #55524b; font-size: 18px; line-height: 1.5; }
.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.status-grid article { padding: 22px; border: 1px solid #d9d8d2; border-radius: 14px; background: white; }
.status-grid span, .status-grid strong { display: block; }
.status-grid span { margin-bottom: 8px; color: #68665f; font-size: 12px; }
.status-grid strong { font-size: 20px; }

@media (max-width: 720px) {
  .status-grid { grid-template-columns: 1fr; }
  .hero { padding-top: 48px; }
}
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f5f4ef" />
    <title>Fleek Auction House</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Verify the web workspace**

```bash
npm run test -w @fleek/web
npm run typecheck -w @fleek/web
npm run build -w @fleek/web
```

Expected: five route cases pass and `apps/web/dist/index.html` exists.

- [ ] **Step 8: Commit the web scaffold**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat: add realtime web scaffold"
```

---

### Task 5: Add operating documents and verify the full repository

**Files:**
- Create: `fleek-auction/docs/product-decisions.md`
- Create: `fleek-auction/docs/demo-script.md`
- Create: `fleek-auction/docs/qa-checklist.md`
- Create: `fleek-auction/docs/model-preflight.md`

**Interfaces:**
- Consumes: verified contracts, server, web shell, approved spec, and golden fixture.
- Produces: team handoff documents, one-command verification, and a clean local `main` branch.

- [ ] **Step 1: Create the product-decision record**

Create `docs/product-decisions.md`:

```markdown
# Product decisions

- Primary track: Agents & LLMs.
- One interactive 50-piece Grade AB branded-sweatshirt supplier lot.
- Demo terms: £520 start, £620 private reserve, £760 Buy Now, £10 increment, 90-second duration.
- Primary buyer ceiling: £690. Baseline rival ceiling: £650. Alternate rival ceiling: £710.
- The model parses sourcing text only; the private maximum is entered separately.
- The server owns auction state, timing, role projections, and settlement.
- A winning outcome is pending Fleek physical QC; no payment is processed.
```

- [ ] **Step 2: Create the initial demo script**

Create `docs/demo-script.md`:

```markdown
# Demo script

1. Seller publishes the lot with protected terms.
2. Buyer enters sourcing intent; the live model returns Grade AB branded sweatshirts.
3. Buyer approves a separate £690 private ceiling and activates the proxy policy.
4. Rival buyer enters £650 from another browser.
5. The proxy remains leader at £660 without another buyer click.
6. The real timer closes at £660, pending Fleek physical QC.
7. Reset with a £710 rival ceiling to prove a different £700 result.
```

- [ ] **Step 3: Create the scaffold QA checklist**

Create `docs/qa-checklist.md`:

```markdown
# Scaffold QA checklist

- [ ] `npm install` completes from a clean checkout.
- [ ] `npm run verify` exits successfully.
- [ ] `npm run dev` starts contracts, server, and web processes.
- [ ] `/api/health` returns a schema-valid response through Vite.
- [ ] The web page reports HTTP server `ok`.
- [ ] The web page reports Socket.IO `connected`.
- [ ] No `.env` file or credential appears in `git status`.
- [ ] The approved design and repository plan exist under `docs/superpowers/`.
```

- [ ] **Step 4: Create the model preflight procedure**

Create `docs/model-preflight.md`:

```markdown
# Model preflight

The live model receives sourcing text only. It must never receive a private maximum, seller reserve, current bid, or customer identifier.

Record before feature work:

1. Provider base URL, model name, protocol, timeout, and retention policy.
2. One redacted request using: `I want Grade AB branded sweatshirts and prefer getting a deal.`
3. One schema-valid response containing only controlled category IDs, minimum grade, preference, and explanation.
4. Confirmation that invalid JSON and timeouts use the labelled structured fallback.
```

- [ ] **Step 5: Run full repository verification**

```bash
npm run verify
```

Expected:

- ESLint exits `0`.
- Contracts: three tests pass.
- Server: two tests pass.
- Web: five route cases pass.
- Contracts, server, and web builds all complete.

- [ ] **Step 6: Run the live development smoke test**

In terminal one:

```bash
npm run dev
```

In terminal two:

```bash
curl --fail http://127.0.0.1:3001/api/health
curl --fail http://127.0.0.1:5173/api/health
```

Expected: both commands return JSON with `"status":"ok"`. Open `http://127.0.0.1:5173/demo`; the page shows HTTP `ok` and Socket.IO `connected`.

- [ ] **Step 7: Verify repository cleanliness**

```bash
git status --short
git log --oneline --decorate -5
```

Expected: only the four new operating documents are uncommitted; the log contains the foundation, contracts, server, and web commits.

- [ ] **Step 8: Commit the operating handoff**

```bash
git add docs
git commit -m "docs: add hackathon operating handoff"
git status --short
```

Expected: the working tree is clean on `main`.

---

## Completion report

Report:

- absolute repository path;
- active branch and latest commit;
- Node and npm versions used;
- exact verification result;
- local development URLs;
- whether model credentials are configured;
- confirmation that no GitHub remote was created;
- the one remaining question: desired GitHub repository visibility, `private` or `public`.
