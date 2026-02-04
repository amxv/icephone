# Progress Log

This file must be updated after **every phase**. Keep notes concise but specific.

---

## Phase 0 — Cleanup
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Completed Phase 0 cleanup. Removed chat/email/phone-number UI routes and components, removed VAPI API routes/libs, and pruned email/chat types + schema tables. Updated sidebar/admin nav and lead detail UI to remove email/chat surfaces. Voice agent UI adjusted to remove phone assignment/test call in customer view. Admin stats/cards and database overview updated to drop phone/email/chat counts. Rewrote `src/actions/voice-agents.ts` to remove phone/VAPI, removed phone/VAPI types, stubbed call queue + campaign execution (telephony deferred), removed VAPI analytics admin page wiring, and removed Cloudflare deployment artifacts/workers. Dropped Cloudflare-specific DB/email helpers.
- Files removed/changed:
  - Removed: `src/app/(pages)/chats/*`, `src/app/(pages)/emails/*`, `src/app/(pages)/phone-numbers/*`, `src/app/admin/messages/*`, `src/app/admin/emails/*`, `src/app/admin/phone-numbers/*`, `src/app/admin/test-vapi/*`, VAPI API routes under `src/app/api/vapi/*`, chat/email/phone components and actions, VAPI libs/hooks, `src/components/knowledge-base/StreamingRAGChat.tsx`, `src/components/voice-call-widget.tsx`.
  - Updated: `src/components/sidebar-nav.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/components/admin/AdminQuickActions.tsx`, `src/components/admin/AdminStatsCards.tsx`, `src/app/admin/database/AdminDatabaseClient.tsx`, `src/actions/admin.ts`, `src/app/(pages)/knowledge/page.tsx`, `src/app/(pages)/leads/[id]/page.tsx`, `src/components/communication/*` (removed email shortcut/suggestions/timeline filters), `src/hooks/use-keyboard-shortcuts.ts`, `src/components/simple-agent-creator.tsx`, `src/components/voice-agents-page-client.tsx`, `src/app/(pages)/voice-agents/page.tsx`, `src/actions/leads.ts`, `src/actions/lead-communication.ts`, `src/types.ts`, `src/db/schema.ts`.
- Tests/commands run: None.
- Commit: `8e6572d` (Phase 0 cleanup: remove chat/email/phone/VAPI surfaces — partial), `phase-0: cleanup`
- Notes/blockers:
  - Call execution is currently stubbed (telephony deferred); `CALL_EXECUTION_ENABLED` must be `true` once execution is implemented.

---

## Phase 1 — Auth + Tenancy
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Replaced Clerk with Better Auth (server/client config, API handler, middleware guard) and added team bootstrap on sign-up/sign-in. Updated auth-related UI (sign-in/sign-up pages + forms), added user menu + auth hook, and rewired client components to new session flow. Added auth/tenancy tables (`users`, `teams`, `team_members`, `sessions`, `accounts`, `verifications`) plus `users.is_active` flag; admin actions now use DB users + sessions instead of Clerk. Updated admin/layout/auth checks to use Better Auth session helpers.
- Files changed:
  - Added: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/auth/session.ts`, `src/lib/auth/use-auth-user.ts`, `src/actions/teams.ts`, `src/components/auth/*`, `src/app/api/auth/[...all]/route.ts`, `src/app/sign-up/[[...sign-up]]/page.tsx`.
  - Updated: `src/middleware.ts`, `src/app/layout.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/admin/layout.tsx`, `src/components/sidebar-nav.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/components/dashboard-client.tsx`, `src/lib/calendar/components/calendar.tsx`, `src/lib/admin-check.ts`, `src/actions/admin-users.ts`, `src/actions/admin-voice-agents.ts`, auth-dependent actions to use `@/lib/auth/session`, `src/db/schema.ts`, `package.json`.
- Tests/commands run: None.
- Commit: `phase-1: auth + teams`
- Notes/blockers:
  - Added `users.is_active` for admin toggles and enforced in middleware/session; requires migration in Phase 2.

---

## Phase 2 — Schema + Data Layer
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Added team-scoped fields and v1 schema additions (team integrations, knowledge sources/files/chunks, call events, campaign runs, lead notes, audit logs) and extended core tables with `team_id` + attribution fields. Added `requireSession`/`requireTeam` helpers, team-scoping utility, and audit logging helper.
- Files changed:
  - Updated: `src/db/schema.ts`, `src/lib/auth/session.ts`.
  - Added: `src/lib/team-scope.ts`, `src/lib/audit-log.ts`.
- Tests/commands run: None.
- Commit: `phase-2: schema + data layer`
- Notes/blockers:
  - New columns/tables require migrations in Phase 2/next DB migration step.

---

## Phase 3 — Leads + Pipeline
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Rewrote lead actions to be team-scoped with Better Auth sessions, added Zod validation and audit logging, and implemented lead notes + status updates. Wired Leads page, Lead detail, and Pipeline board to new action names while keeping UI contracts unchanged.
- Files changed:
  - Updated: `src/actions/leads.ts`, `src/app/(pages)/leads/page.tsx`, `src/app/(pages)/leads/[id]/page.tsx`, `src/components/pipeline/pipeline-board.tsx`.
- Tests/commands run: None.
- Commit: `phase-3: leads + pipeline`
- Notes/blockers:

---

## Phase 4 — Voice Agents + Calls
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Added OpenAI Realtime session API endpoint and web call test UI. Voice agents and calls actions are now team-scoped with audit logging; calls list/detail use the new calls table only. Added a realtime WebRTC hook to start/stop sessions and persist call outcomes. Calls can now be created without a lead (schema tweak).
- Files changed:
  - Added: `src/app/api/voice/session/route.ts`, `src/hooks/use-realtime-voice-session.ts`, `src/components/voice-agent-test-call.tsx`.
  - Updated: `src/actions/voice-agents.ts`, `src/actions/calls.ts`, `src/components/voice-agents-page-client.tsx`, `src/db/schema.ts`.
- Tests/commands run: None.
- Commit: `phase-4: realtime voice agents + calls`
- Notes/blockers:

---

## Phase 5 — Campaigns + Call Queue
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Implemented team-scoped campaign core actions (CRUD, status changes, lead assignment, execution status) and updated campaign UI imports to use them. Added team-scoped CSV import pipeline adjustments and aligned call queue listing/cancellation to team scope. Campaign execution is stubbed to status updates only.
- Files changed:
  - Added: `src/actions/campaigns/core.ts`.
  - Updated: `src/actions/campaigns/index.ts`, `src/actions/campaigns/import.ts`, `src/components/enhanced-campaigns-table.tsx`, `src/actions/lead-communication.ts`.
- Tests/commands run: None.
- Commit: `phase-5: campaigns + call queue`
- Notes/blockers:

---

## Phase 6 — Knowledge Base
- Status: [ ] Not started [ ] In progress [x] Done
- Summary: Rebuilt knowledge base to use Cloudflare R2 + OpenAI Vector Store. Added R2 storage utilities + OpenAI vector store client helpers, rewrote knowledge base actions to be team-scoped with audit logging, implemented upload/index pipeline, vector store search, and manual status refresh. Updated knowledge base UI links, stats copy, and documents list to show status + refresh control. Simplified worker/file ingestion wrappers to use the new pipeline.
- Files changed:
  - Added: `src/lib/storage/*`, `src/lib/utils/retry.ts`, `src/lib/openai/*`
  - Updated: `src/actions/knowledge-base.ts`, `src/actions/knowledge-base-files.ts`, `src/actions/knowledge-base-worker.ts`, `src/components/knowledge-base/KnowledgeBaseDocumentsList.tsx`, `src/components/knowledge-base/KnowledgeBaseSourcesList.tsx`, `src/components/knowledge-base/KnowledgeBaseStats.tsx`, `next.config.ts`, `package.json`, `src/types.ts`
- Tests/commands run: None.
- Commit:
- Notes/blockers:

---

## Phase 7 — Appointments (Cal.com)
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 8 — Analytics + Admin
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:
