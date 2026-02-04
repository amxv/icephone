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

