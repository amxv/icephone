# Implementation Plan (Voice‑First Rewrite)

This is the step‑by‑step plan to rebuild the backend while keeping the UI intact.

---

## Phase 0 — Prep + Cleanup
**Goal:** remove dead surface areas and prep for Vercel.

Tasks:
1. Remove chat/email/phone numbers UI + actions (see `05-prune-list.md`).
2. Remove VAPI code and Cloudflare worker artifacts.
3. Remove Cloudflare deployment config.
4. Confirm all routes still render after deletions.

Deliverable:
- UI still works (static) without chat/email/phone numbers.

---

## Phase 1 — Auth + Tenancy (Better Auth)
**Goal:** Replace Clerk with Better Auth and add team‑scoped auth.

Tasks:
1. Implement Better Auth server/client config.
2. Create `users`, `teams`, `team_members`, auth tables.
3. On signup: create team and set `default_team_id`.
4. Replace `currentUser`/`auth` usages with Better Auth session.
5. Update middleware to protect routes.

Deliverable:
- Users can sign up/sign in and have a team context.

---

## Phase 2 — New Schema + Data Layer
**Goal:** Implement v1 schema and DB access layer.

Tasks:
1. Implement schema from `03-schema-v1.md` using Drizzle.
2. Create a `requireSession()` and `requireTeam()` helper.
3. Define base DB utilities and `team_id` scoping.
4. Add audit log helper.

Deliverable:
- DB schema + shared data layer helpers.

---

## Phase 3 — Leads + Pipeline
**Goal:** Wire core CRM to UI.

Tasks:
1. Implement `listLeads`, `getLead`, `createLead`, `updateLead`, `updateLeadStatus`.
2. Implement `lead_notes`.
3. Wire into Leads page + Pipeline board.

Deliverable:
- Leads + Pipeline fully functional.

---

## Phase 4 — Voice Agents + Calls (Web)
**Goal:** Replace VAPI with OpenAI Realtime voice.

Tasks:
1. Implement `agents`, `agent_roles`, `voice_presets`.
2. Implement `POST /api/voice/session` for ephemeral token creation.
3. Build call capture: create call at session start, store transcript + summary at end.
4. Wire Voice Agent UI + test call widget.
5. Implement Calls list + details.

Deliverable:
- Agents + Calls fully functional with web voice.

---

## Phase 5 — Campaigns + Call Queue
**Goal:** Campaign orchestration (manual start/stop, no scheduler).

Tasks:
1. Implement `campaigns`, `campaign_leads`, `campaign_runs`, `call_queue`.
2. Implement campaign CRUD + lead assignment.
3. Wire Campaign list + detail dashboards.
4. Call queue shows pending leads (manual execution).

Deliverable:
- Campaigns + Call Queue fully functional (execution stubbed).

---

## Phase 6 — Knowledge Base (R2 + Vector Store)
**Goal:** Upload, index, query.

Tasks:
1. Implement R2 storage helpers.
2. Implement OpenAI Files + Vector Store integration.
3. Store metadata in `knowledge_sources`/`knowledge_files`.
4. Wire Knowledge UI (sources + documents + search).
5. Provide manual status refresh.

Deliverable:
- Knowledge base working with OpenAI Vector Store.

---

## Phase 7 — Appointments (Cal.com)
**Goal:** Calendar UI backed by Cal.com.

Tasks:
1. Implement Cal.com client.
2. Store booking IDs in `appointments` table.
3. Wire to calendar UI.

Deliverable:
- Calendar works with Cal.com.

---

## Phase 8 — Analytics + Admin
**Goal:** Voice‑focused analytics and audit logs.

Tasks:
1. Implement analytics queries for dashboard + analytics pages.
2. Implement admin stats + audit logs.

Deliverable:
- Analytics and Admin dashboards functional.

---

## Implementation Notes
- Maintain UI contracts from `02-ui-data-contracts.md`.
- Use Zod validation in all server actions.
- Every action must be team‑scoped + audit‑logged.
- Avoid background jobs until later.

