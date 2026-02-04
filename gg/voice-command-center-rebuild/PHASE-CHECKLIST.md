# Phase Checklist + Commit Discipline

**Rule:** Every phase ends with a commit. Update `PROGRESS.md` before committing.

---

## Commit Naming Convention
Use: `phase-<n>: <short description>`
Examples:
- `phase-0: remove chat/email/phone numbers`
- `phase-1: better-auth + teams`

---

## Phase Checklist

### Phase 0 — Cleanup
- [x] Remove chat/email/phone numbers/VAPI/Cloudflare artifacts
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-0: cleanup`

### Phase 1 — Auth + Tenancy
- [x] Better Auth wired (server + client + middleware)
- [x] Team‑scoped auth helpers
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-1: auth + teams`

### Phase 2 — Schema + Data Layer
- [x] Drizzle schema implemented
- [x] Base DB helpers (team scope, audit)
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-2: schema + data layer`

### Phase 3 — Leads + Pipeline
- [x] Lead CRUD + status
- [x] Pipeline drag/drop wired
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-3: leads + pipeline`

### Phase 4 — Voice Agents + Calls
- [x] OpenAI Realtime session API
- [x] Calls storage + transcript capture
- [x] Agents CRUD
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-4: voice + calls`

### Phase 5 — Campaigns + Call Queue
- [x] Campaign CRUD
- [x] Campaign leads + queue
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-5: campaigns + queue`

### Phase 6 — Knowledge Base
- [x] R2 upload + OpenAI vector store
- [x] Knowledge sources/files
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-6: knowledge base`

### Phase 7 — Appointments (Cal.com)
- [x] Cal.com integration
- [x] Appointments UI wired
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-7: appointments`

### Phase 8 — Analytics + Admin
- [x] Analytics queries
- [x] Admin stats + audit logs
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-8: analytics + admin`

### Phase 9 — Quality Pass (Typecheck + Lint)
- [x] Fix typecheck errors
- [x] Fix lint/format errors
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-9: quality pass`

### Phase 10 — Realtime Tools (Cal.com + Scheduling)
- [x] Add Cal.com tool for Realtime agent
- [x] Wire tool handling into voice session route
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-10: realtime tools`

### Phase 11 — Async Campaign Scheduling Infra
- [x] Map current scheduling/mass-calling flow
- [x] Add async infra scaffolding (queues/workers, status)
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-11: async scheduling`

### Phase 12 — Codebase Optimization
- [x] Performance/structure pass
- [x] Identify backend optimizations for campaigns/queue/analytics
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-12: optimization`

### Phase 13 — Campaigns & Call Queue Gap Analysis
- [x] Review campaigns + call queue for product gaps
- [x] Document async scheduling gaps (business hours, retries, throttling, concurrency)
- [x] Address critical gaps (backend scaffolding)
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-13: campaign gaps`

### Phase 14 — Voice Agent Customization (Voice + Instructions)
- [x] Add voice selection + custom instructions fields
- [x] Wire to Realtime session prompt/tooling
- [x] Enforce model `gpt-realtime-mini-2025-12-15`
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-14: agent customization`

### Phase 15 — Analytics Expansion (Calls + KPIs)
- [x] Backend metrics for call KPIs (pickup rate, outcomes, etc)
- [x] Analytics dashboard UI (analytics screen)
- [x] Analytics UI expansion
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-15: analytics expansion`

### Phase 16 — Codebase Cleanup (No Lint/TS Bypass)
- [x] Remove @ts-nocheck/@ts-ignore/eslint-disable
- [x] Replace with proper types/logic
- [x] Resolve TODOs and incomplete logic surfaced during cleanup
- [x] Enforce OpenAI-only voice providers and remove non-OpenAI voice usage
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-16: codebase cleanup`

### Phase 17 — CRM Product Gap Analysis (Leads/Pipeline/Appointments)
- [x] Identify CRM gaps and add missing logic
- [x] Strengthen campaign/call-queue async processing infrastructure
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-17: crm gaps`

### Phase 18 — Final QA + PR
- [x] Run `bun run typecheck`, `bunx biome check --write --unsafe .`, `bun run lint`
- [x] Open PR on completion
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-18: final qa`
