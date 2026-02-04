# IcePhone Voice Command Center Rebuild (Planning Packet)

This packet is the **single source of truth** for a full backend rewrite of IcePhone into a **voice‑first command center**. The UI is already strong; the backend must be rebuilt from first principles and wired to the existing UI contracts.

---

## Why We’re Rewriting (The “Why”)
We initially positioned IcePhone as an AI CRM, but the product scope ballooned (chat, email, SMS, phone numbers, RAG, campaigns, analytics, admin, etc.). The result was **scope creep, fragile backend code, and too many partially‑working systems**. This rewrite refocuses the product on the core ROI: **voice‑first sales + support**.

The new direction is a **high‑quality voice agent command center**:
- Run outbound campaigns and cold calls
- Handle inbound support calls
- Centralize knowledge + audit logging
- Keep CRM essentials (leads, pipeline, appointments)

We are keeping the UI, but **rewriting all server‑side logic** for reliability, scalability, and future extensibility.

---

## Vision + Decisions (Locked)
- **Voice‑first CRM + sales command center** (web voice in Phase 1)
- **No chat or email features** in the product surface
- Core features: **Leads, Campaigns, Knowledge, Calls, Agents, Appointments (Cal.com)**
- Phone numbers UI removed (telephony deferred)
- Tenant model: **one user → one team**, team‑scoped data (future RBAC ready)
- Voice: **OpenAI Realtime API** (web only)
- Knowledge: **OpenAI Vector Store** + **Cloudflare R2**
- Auth: **Better Auth** (email/password)
- Email: **Resend**, only for auth/system messages
- Background jobs: **deferred** (no job runner in Phase 1)

---

## Prompt for the Implementation Agent (How to Navigate Phases)
Use this packet as a strict, sequential roadmap:

1. **Read the packet** in this order:
   - `01-feature-contract-map.md`
   - `02-ui-data-contracts.md`
   - `03-schema-v1.md`
   - `04-services-architecture.md`
   - `05-prune-list.md`
   - `06-implementation-plan.md`
2. **Follow phases strictly** from `06-implementation-plan.md`.
3. **Do not redesign UI**; wire new backend to the existing UI contracts.
4. **Record progress** after every phase (see `PROGRESS.md`).
5. **Commit after each phase** (see `PHASE-CHECKLIST.md`).

---

## How the Packet Works
- **`01-feature-contract-map.md`**: The *feature → data → actions → tables → integrations* contract.
- **`02-ui-data-contracts.md`**: Actual UI data shapes that server actions must return.
- **`03-schema-v1.md`**: The new team‑scoped schema blueprint.
- **`04-services-architecture.md`**: How OpenAI Realtime, Vector Store, R2, Cal.com, Better Auth, and Resend fit together.
- **`05-prune-list.md`**: Exact delete/refactor list (chat/email/phone numbers/VAPI/Cloudflare artifacts).
- **`06-implementation-plan.md`**: Phase roadmap with tasks and sequencing.
- **`PROGRESS.md`**: Log progress and decisions.
- **`PHASE-CHECKLIST.md`**: Enforces commit discipline after each phase.

---

## Where to Start (Actionable)
1. Create branch: `codex/voice-command-center-rewrite`.
2. Execute **Phase 0 cleanup** (remove chat/email/phone numbers/VAPI/Cloudflare artifacts).
3. Update `PROGRESS.md`, then commit and tag the phase.
4. Move to Phase 1 and repeat.
5. Commit each phase as you go.
6. Complete all phases.
---

## Required Reference Docs (Must Read)
These were provided by the user and contain the **correct API details** for external services:

### Please read these documents when relevant - these are up to date guides on implementing these external APIs and packages in nextjs/ts apps:
- `gg/agent-outputs/codebase-researcher/openai-realtime-voice-api-implementation.md`
- `gg/agent-outputs/codebase-researcher/better-auth-implementation.md`
- `gg/agent-outputs/codebase-researcher/2026-02-04_05-12-16-rag-pipeline-research.md`
- `gg/agent-outputs/codebase-researcher/cloudflare-r2-integration.md`
- `gg/agent-outputs/codebase-researcher/resend-integration-guide.md`

---

## Non‑Negotiables
- Team‑scoped data in every query.
- Every server action is validated (Zod) and audited.
- UI contracts from `02-ui-data-contracts.md` remain intact.
- Commit after each phase.
