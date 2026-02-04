# Large File Refactor Tracker (Phase 54)

## Goal
Refactor all files over 500 LOC into smaller modules while preserving behavior and keeping typecheck/lint green.

## Discovery Snapshot
- Date: 2026-02-04
- Scan scope: repository files (excluding `node_modules`, `.git`, `.next`, binaries)
- Result: many large files in `src/` plus large research/planning markdown files.

## Completed In Phase 54
- `src/types.ts` (579 LOC) -> split into:
  - `src/types/knowledge-base.ts`
  - `src/types/crm-core.ts`
  - `src/types/rag.ts`
  - `src/types/voice-agents.ts`
  - `src/types.ts` now a compact barrel export file
- `src/lib/crm/integration-service.ts` (508 LOC) -> extracted lead-import persistence logic into:
  - `src/lib/crm/imported-leads.ts`
- `src/hooks/use-realtime-voice-session.ts` (571 LOC) -> extracted tool execution logic into:
  - `src/hooks/realtime-voice-session/tools.ts`

## Remaining >500 LOC Source Files
- `src/db/schema.ts`
- `src/actions/admin-voice-agents.ts`
- `src/actions/call-analytics.ts`
- `src/actions/campaigns/execution.ts`
- `src/components/campaign-creation-dialog.tsx`
- `src/components/voice-agent-settings.tsx`
- `src/components/leads-table.tsx`
- `src/components/enhanced-campaigns-table.tsx`
- `src/app/admin/voice-agents/AdminVoiceAgentsClient.tsx`
- `src/app/(pages)/leads/[id]/page.tsx`
- `src/components/campaign-analytics-dashboard.tsx`
- `src/actions/knowledge-base.ts`
- `src/components/campaign-voice-configuration.tsx`
- `src/components/calls-table.tsx`
- `src/components/admin/AgentCustomizationDialog.tsx`
- `src/actions/campaigns/core.ts`
- `src/actions/campaigns/basic.ts`
- `src/actions/campaigns/monitoring.ts`
- `src/app/api/call-queue/process/route.ts`
- `src/actions/knowledge-base-enhanced-rag.ts`
- `src/components/campaign-details-page-client.tsx`
- `src/components/call-queue-page-client.tsx`
- `src/components/campaigns-table.tsx`
- `src/scripts/seed-voice-data.ts`
- `src/components/calls-page-client.tsx`
- `src/actions/lead-communication.ts`
- `src/components/simple-agent-creator.tsx`
- `src/actions/admin-users.ts`
- `src/components/add-leads-modal.tsx`
- `src/components/phone-numbers-page-client.tsx`
- `src/components/voice-agents-page-client.tsx`
- `src/components/dashboard-client.tsx`
- `src/components/knowledge-base/AdvancedKnowledgeBaseSearch.tsx`
- `src/components/essential-settings.tsx`
- `src/actions/admin.ts`
- `src/actions/appointmentActions.ts`
- `src/actions/calls.ts`
- `src/app/(pages)/analytics/components/AnalyticsDashboard.tsx`

## Notes
- Research docs in `gg/agent-outputs/**` and long planning docs are intentionally large and currently treated as documentation artifacts, not runtime code targets.
