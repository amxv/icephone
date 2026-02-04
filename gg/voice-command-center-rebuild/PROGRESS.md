# Progress Log

This file must be updated after **every phase**. Keep notes concise but specific.

---

## Phase 0 — Cleanup
- Status: [ ] Not started [x] In progress [ ] Done
- Summary: Began Phase 0 cleanup. Removed chat/email/phone-number UI routes and components, removed VAPI API routes/libs, removed AI chat tab in Knowledge page, and pruned email/chat types + schema tables. Updated sidebar/admin nav and lead detail UI to remove email/chat surfaces. Voice agent UI adjusted to remove phone assignment/test call in customer view. Admin stats/cards and database overview updated to drop phone/email/chat counts.
- Files removed/changed:
  - Removed: `src/app/(pages)/chats/*`, `src/app/(pages)/emails/*`, `src/app/(pages)/phone-numbers/*`, `src/app/admin/messages/*`, `src/app/admin/emails/*`, `src/app/admin/phone-numbers/*`, `src/app/admin/test-vapi/*`, VAPI API routes under `src/app/api/vapi/*`, chat/email/phone components and actions, VAPI libs/hooks, `src/components/knowledge-base/StreamingRAGChat.tsx`, `src/components/voice-call-widget.tsx`.
  - Updated: `src/components/sidebar-nav.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/components/admin/AdminQuickActions.tsx`, `src/components/admin/AdminStatsCards.tsx`, `src/app/admin/database/AdminDatabaseClient.tsx`, `src/actions/admin.ts`, `src/app/(pages)/knowledge/page.tsx`, `src/app/(pages)/leads/[id]/page.tsx`, `src/components/communication/*` (removed email shortcut/suggestions/timeline filters), `src/hooks/use-keyboard-shortcuts.ts`, `src/components/simple-agent-creator.tsx`, `src/components/voice-agents-page-client.tsx`, `src/app/(pages)/voice-agents/page.tsx`, `src/actions/leads.ts`, `src/actions/lead-communication.ts`, `src/types.ts`, `src/db/schema.ts`.
- Tests/commands run: None.
- Commit: Pending (see notes).
- Notes/blockers:
  - Remaining cleanup: remove phone/VAPI references in `src/actions/voice-agents.ts`, `src/actions/admin-voice-agents.ts`, `src/actions/admin-users.ts`, `src/app/admin/voice-agents/AdminVoiceAgentsClient.tsx`, `src/app/admin/users/AdminUsersClient.tsx`, `src/components/campaign-creation-dialog.tsx`, `src/components/edit-voice-agent-dialog.tsx`, `src/components/create-voice-agent-dialog.tsx`, `src/components/assign-agent-dialog.tsx`, analytics pages referencing phone numbers, and any lingering `phoneNumbers`/`vapi` imports.
  - Remove Cloudflare artifacts still pending: `open-next.config.ts`, `wrangler.jsonc`, `cloudflare-env.d.ts`, `workers/*` (verify usage before delete).
  - Build may fail until remaining phone/VAPI references are cleaned.

---

## Phase 1 — Auth + Tenancy
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 2 — Schema + Data Layer
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 3 — Leads + Pipeline
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 4 — Voice Agents + Calls
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 5 — Campaigns + Call Queue
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
- Commit:
- Notes/blockers:

---

## Phase 6 — Knowledge Base
- Status: [ ] Not started [ ] In progress [ ] Done
- Summary:
- Files changed:
- Tests/commands run:
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
