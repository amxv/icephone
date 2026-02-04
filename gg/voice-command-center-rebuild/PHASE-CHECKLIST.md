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
- [ ] Remove chat/email/phone numbers/VAPI/Cloudflare artifacts
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-0: cleanup`

### Phase 1 — Auth + Tenancy
- [ ] Better Auth wired (server + client + middleware)
- [ ] Team‑scoped auth helpers
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-1: auth + teams`

### Phase 2 — Schema + Data Layer
- [ ] Drizzle schema implemented
- [ ] Base DB helpers (team scope, audit)
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-2: schema + data layer`

### Phase 3 — Leads + Pipeline
- [ ] Lead CRUD + status
- [ ] Pipeline drag/drop wired
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-3: leads + pipeline`

### Phase 4 — Voice Agents + Calls
- [ ] OpenAI Realtime session API
- [ ] Calls storage + transcript capture
- [ ] Agents CRUD
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-4: voice + calls`

### Phase 5 — Campaigns + Call Queue
- [ ] Campaign CRUD
- [ ] Campaign leads + queue
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-5: campaigns + queue`

### Phase 6 — Knowledge Base
- [ ] R2 upload + OpenAI vector store
- [ ] Knowledge sources/files
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-6: knowledge base`

### Phase 7 — Appointments (Cal.com)
- [ ] Cal.com integration
- [ ] Appointments UI wired
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-7: appointments`

### Phase 8 — Analytics + Admin
- [ ] Analytics queries
- [ ] Admin stats + audit logs
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-8: analytics + admin`

### Phase 9 — Quality Pass (Typecheck + Lint)
- [ ] Fix typecheck errors
- [ ] Fix lint/format errors
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-9: quality pass`

### Phase 10 — Realtime Tools (Cal.com + Scheduling)
- [ ] Add Cal.com tool for Realtime agent
- [ ] Wire tool handling into voice session route
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-10: realtime tools`

### Phase 11 — Async Campaign Scheduling Infra
- [ ] Map current scheduling/mass-calling flow
- [ ] Add async infra scaffolding (queues/workers, status)
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-11: async scheduling`

### Phase 12 — Codebase Optimization
- [ ] Performance/structure pass
- [ ] Identify backend optimizations for campaigns/queue/analytics
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-12: optimization`

### Phase 13 — Campaigns & Call Queue Gap Analysis
- [ ] Review campaigns + call queue for product gaps
- [ ] Document async scheduling gaps (business hours, retries, throttling, concurrency)
- [ ] Address critical gaps (backend scaffolding)
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-13: campaign gaps`

### Phase 14 — Voice Agent Customization (Voice + Instructions)
- [ ] Add voice selection + custom instructions fields
- [ ] Wire to Realtime session prompt/tooling
- [ ] Enforce model `gpt-realtime-mini-2025-12-15`
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-14: agent customization`

### Phase 15 — Analytics Expansion (Calls + KPIs)
- [ ] Backend metrics for call KPIs (pickup rate, outcomes, etc)
- [ ] Analytics dashboard UI (analytics screen)
- [ ] Analytics UI expansion
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-15: analytics expansion`

### Phase 16 — Codebase Cleanup (No Lint/TS Bypass)
- [ ] Remove @ts-nocheck/@ts-ignore/eslint-disable
- [ ] Replace with proper types/logic
- [ ] Resolve TODOs and incomplete logic surfaced during cleanup
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-16: codebase cleanup`

### Phase 17 — CRM Product Gap Analysis (Leads/Pipeline/Appointments)
- [ ] Identify CRM gaps and add missing logic
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-17: crm gaps`

### Phase 18 — Final QA + PR
- [ ] Run `bun run typecheck`, `bunx biome check --write --unsafe .`, `bun run lint`
- [ ] Open PR on completion
- [ ] Update `PROGRESS.md`
- [ ] Commit: `phase-18: final qa`
