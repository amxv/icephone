# QA Observations (Ongoing)

Date: 2026-02-04
Tester: Codex + dev-browser skill
Environment: local dev server on `http://localhost:3000`, user `a@zue.ai`

## Evidence Snapshot Paths

- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa4-mobile-voice-before-menu.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa4-mobile-voice-menu-open.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa3-desktop-voice-agent-create-modal.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa-after-seed-voice-modal-step1.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa-role-selected-next-enabled.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa3-desktop-campaign-create-modal.png`
- `/Users/ashray/.gg/codex/skills/dev-browser/tmp/qa-check-appointments-15s.png`

## Findings So Far

### 1) Mobile layout is collapsed/off-canvas for `(pages)` routes (High)

- **Observed behavior:** on mobile viewport (`390x844`), page content is pushed almost entirely offscreen to the right, leaving mostly the background + hamburger icon visible.
- **Routes confirmed:** `/voice-agents`, `/campaigns`, `/leads` (same collapse pattern).
- **Measured DOM evidence:** main rounded container rect is effectively collapsed (`x≈376`, `w≈2`) while viewport width is 390.
- **File reference:** `src/app/(pages)/layout.tsx:5-10`
  - Current wrapper uses `className="flex h-screen w-full overflow-hidden"` with `SidebarNav` and content panel as horizontal siblings.
  - On mobile, `SidebarNav` renders a full-width top bar (`src/components/ui/sidebar.tsx:114-118`) and the content sibling gets squeezed.
- **Likely root cause:** mobile still uses row flex structure; sidebar top bar consumes width as a sibling instead of stacking above content.

### 2) Create Voice Agent modal appears blank with disabled Next during async data load (High UX issue)

- **Observed behavior:** modal opens on step 1, but role cards are absent initially; user sees only title/description and disabled `Next` button.
- **Repro evidence:** blank modal screenshots while data pending.
- **Technical evidence:** repeated `POST /voice-agents` server actions return role/preset data, but UI shows no loading skeleton/placeholder in step-1 role grid.
- **File reference:** `src/components/simple-agent-creator.tsx:315-377`
  - Role list is rendered directly from `agentRoles.map(...)`.
  - When `agentRoles` is still empty, grid is empty with no fallback state.
- **File reference:** `src/components/simple-agent-creator.tsx:603-606`
  - `Next` is disabled until role is selected, which is impossible during the blank period.
- **Important clarification:** once roles finish loading, selecting a role correctly enables `Next` (confirmed in `qa-role-selected-next-enabled.png`).

### 2b) Step 1 modal content can exceed viewport and appears vertically clipped (Medium)

- **Observed behavior:** after roles load, cards are tall and bottom portions/buttons can be below visible area in a 1280x720 viewport.
- **Measured evidence:** dialog `clientHeight` ~646px while content `scrollHeight` grows to ~1007px after roles render.
- **File references:**
  - `src/components/simple-agent-creator.tsx:259` (`DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"`)
  - `src/components/simple-agent-creator.tsx:299` (`min-h-[400px]` for step container)
  - `src/components/simple-agent-creator.tsx:315` (3-column role grid with dense card content)
- **Impact:** users can interpret this as a layout defect / hidden content when data appears after initial blank state.

### 3) Campaign creation modal has horizontal clipping in template mode (Medium)

- **Observed behavior:** `Start from Scratch` / `Use Template` segmented controls are visually clipped/right-truncated in modal.
- **Measured evidence:** tablist extends beyond dialog bounds in runtime inspection.
- **File reference:** `src/components/campaign-creation-dialog.tsx:564-579`
  - `TabsList` + `TabsTrigger` sizing/padding appears to overflow available width in `max-w-2xl` dialog.

### 4) Admin routes produce server-side "Admin access required" errors in logs for current test user (Medium)

- **Observed behavior:** navigating admin routes results in redirect to `/` for this user, while logs show repeated admin access errors from server actions.
- **Log evidence:** `/private/tmp/claude-501/-Users-ashray-code-amxv-icephone/tasks/b33b9e4.output` contains many `Error: Admin access required` entries.
- **File reference:** `src/app/admin/layout.tsx:19-22` (explicit redirect to `/` when `user.id !== OWNER_USER_ID`).
- **Related action references from logs:** `src/actions/admin.ts:67`, `src/actions/admin-users.ts:22`, `src/actions/admin-voice-agents.ts:27`.

### 5) Dialog accessibility warnings in console (Low)

- **Observed behavior:** console warns: `Missing Description or aria-describedby={undefined} for {DialogContent}`.
- **Likely impacted areas:** dialog components lacking `DialogDescription`.
- **Concrete file example:** `src/components/simple-agent-creator.tsx:259-264` (has `DialogTitle`, no `DialogDescription`).

### 6) Appointments page initial loading looked stuck, but eventually resolves (Informational)

- **Observed behavior:** one earlier screenshot captured a spinner-like partial render.
- **Follow-up verification:** after waiting longer, appointments page rendered correctly with calendar controls and empty state message.
- **Evidence:** `qa-check-appointments-15s.png`.

### 7) Create Voice Agent end-to-end flow works, but can feel inconsistent during load (Informational UX)

- Verified full flow:
  1. Step 1 load roles -> select role -> `Next` enabled
  2. Step 2 voice selection (skeleton first, then presets)
  3. Step 3 submit -> success toast appears
  4. New card appears after refresh window
- **Evidence:**
  - `qa-step1-loaded.png`
  - `qa-step2-voice.png`
  - `qa-step3-complete-setup.png`
  - `qa-step3-name-entered.png`
  - `qa-create-flow-after-wait.png`
  - `qa-voice-agents-with-created-data.png`
- **DB verification:** created records exist (e.g. `QA Agent 1770220677698`, `QA Agent Flow 1770220791506`).
- **Interpretation:** the "Next disabled" report is valid symptomatically, but root issue appears to be missing loading-state UX and delayed role rendering, not a permanently broken validator.

### 8) Mobile menu opens correctly, but base mobile page layout is still broken (High)

- **Observed behavior:** hamburger opens full-screen nav correctly, but closing it returns to mostly blank/off-canvas content.
- **Evidence:** `qa4-mobile-voice-menu-open.png` (menu good) vs `qa4-mobile-voice-before-menu.png` (page collapsed).
- **Measured evidence across all app routes in `(pages)`:**
  - container `x≈376`, `width≈2` at viewport width 390 on `/`, `/leads`, `/pipelines`, `/appointments`, `/calls`, `/phone-numbers`, `/voice-agents`, `/campaigns`, `/knowledge`, `/analytics`, `/settings`.
- **File references:**
  - `src/app/(pages)/layout.tsx:5-10`
  - `src/components/ui/sidebar.tsx:106-153`

---

## Notes About Env/Seed During QA

- Ran seed successfully: `bun run db:seed` (`src/scripts/seed-voice-data.ts`).
- Database now contains:
  - Agent roles: 3 (`Customer Service`, `Sales Representative`, `Appointment Setter`)
  - Voice presets: 11
- This confirms the blank Step-1 modal issue is not just "missing seed data"; it still has a visible loading-gap UX problem.
