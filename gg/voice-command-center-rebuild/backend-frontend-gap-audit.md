# Backend vs Frontend Gap Audit - Voice Command Center Rebuild

Date: 2026-02-04  
Branch/PR audited: `codex/voice-command-center-rewrite` / PR #1

## What I reviewed
- PR #1 full description and commit one-line summaries.
- All files in `gg/voice-command-center-rebuild/`.
- Current frontend routes/components and backend actions/endpoints for calls, queue, campaigns, telephony, Cal.com, and CRM.

## Requested checks (quick status)

- **Call queue UI accessibility**: **Mostly wired**. `Calls` has a direct `Call Queue` button (`src/components/calls-page-client.tsx:79-84`). No direct sidebar item for queue (`src/components/sidebar-nav.tsx:57-70`).
- **Cal.com API key connect flow**: **Missing/incomplete**. Backend expects team integration or env key (`src/actions/appointmentActions.ts:98-109`, `src/actions/appointmentActions.ts:160-162`, `src/actions/appointmentActions.ts:228-231`), but Settings has no integrations tab (`src/app/(pages)/settings/page.tsx:76-97`).
- **Campaign scheduling infrastructure wiring**: **Partial/missing**. Backend scheduling exists (`src/actions/campaigns/execution.ts:1158-1345`), UI only exposes start/pause/resume/stop (`src/components/campaign-controls.tsx:3-9`, `src/components/campaign-controls.tsx:99-115`).
- **Voice templates (loan repayment/support/etc.)**: **Wired**. Template catalog includes support, outbound, loan repayment, appointment setting, customer onboarding, renewal retention (`src/lib/voice-agent-command-center.ts:6-113`), selectable in UI (`src/components/voice-agent-customization-dialog.tsx:304-340`), and applied in runtime instructions (`src/app/api/voice/session/route.ts:118-136`).
- **Appointment setting / customer onboarding templates**: **Configured** in template system (same references as above).
- **Telephony provider onboarding ease**: **Missing/incomplete**. Runtime adapters require env credentials (`src/lib/telephony/providers/twilio.ts:25-45`, `src/lib/telephony/providers/telnyx.ts:22-38`, `src/lib/telephony/providers/vonage.ts:58-77`). UI only supports manual phone-number inventory entry (`src/components/phone-numbers-page-client.tsx:296-301`).
- **CRM connectors (HubSpot/Salesforce/GoHighLevel)**: **Backend present, frontend mostly missing**. Connect/disconnect/list actions exist (`src/actions/crm-integrations.ts:35-152`) but current UI only exposes import in campaign modal (`src/components/add-leads-modal.tsx:519-603`).

## Backend-complete but frontend missing/incomplete

## 1) Cal.com integration management UI is missing
- **Backend exists**: team-scoped Cal.com integration lookup + API key handling.
- **Frontend gap**: no place to enter/edit Cal.com API key + event type/team settings.
- **Impact**: appointment creation fails with "Cal.com API key not configured" unless env is manually set.

## 2) CRM connection management UI is missing (only import UI exists)
- **Backend exists**: list/save/disconnect CRM integrations + lead import + call outcome sync.
- **Frontend gap**: no connect/disconnect/config screen for provider credentials/tokens.
- **Impact**: HubSpot/Salesforce/GoHighLevel/Pipedrive imports depend on out-of-band setup.

## 3) Campaign scheduling controls are not exposed in product UI
- **Backend exists**: `scheduleCampaign`, `processScheduledCampaigns`, `triggerCampaignProcessing`.
- **Frontend gap**: campaign controls only do start/pause/resume/stop.
- **Impact**: users cannot schedule future campaign starts or manually trigger processing from UI.

## 4) Campaign voice configuration save flow is currently blocked
- **Backend exists**: `configureCampaignVoiceAgent` only needs `campaignId` + config.
- **Frontend gap**: save button is disabled when `voiceAgentId` prop is missing (`src/components/campaign-voice-configuration.tsx:237-240`), and parent does not pass it (`src/components/campaign-details-page-client.tsx:686-692`).
- **Impact**: campaign voice settings page appears present but is effectively non-functional.

## 5) Telephony provider account onboarding is missing
- **Backend exists**: Twilio/Telnyx/Vonage execution adapters, webhook ingestion, queue processing.
- **Frontend gap**: no UI to connect provider credentials/webhook secrets; number management is manual inventory only.
- **Impact**: "connect your account" experience is not self-serve.

## 6) Call queue operations are UI-limited vs backend capabilities
- **Backend exists**: queue processor endpoint and retry/processing lifecycle.
- **Frontend gap**: queue page is read/refresh/cancel focused; no process-now/retry/bulk controls.
- **Impact**: ops workflows depend on cron/API/manual backend triggering.

## 7) Campaign settings edit surface is incomplete after creation
- **Backend exists**: `updateCampaign` supports partial updates.
- **Frontend gap**: no obvious UI for editing timing/retry/goals after initial create flow.
- **Impact**: users must recreate campaigns or rely on backend/admin intervention for many scheduling changes.

## Suggested implementation order
1. Fix campaign voice-config save blocking issue (highest immediate UX break).
2. Add Integrations UI for Cal.com + CRM (credentials/tokens + validation).
3. Add campaign scheduling controls (schedule start + process-now).
4. Add telephony connection wizard (provider creds + webhook check + number sync).
5. Expand call queue ops controls (manual process/retry/bulk actions).
