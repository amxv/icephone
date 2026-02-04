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

### Phase 19 — UX/Performance Hardening
- [x] Replace full-page reload flows in voice-agent management with in-place data refresh
- [x] Keep list state synchronized after create/update actions
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-19: ux hardening`

### Phase 20 — Analytics Deep Dive + Call Dispositions
- [x] Audit analytics coverage for user/team/campaign level (calls, outcomes, productivity, quality)
- [x] Add explicit disposition tracking for collections/support outcomes (`intent_to_pay`, `promise_to_pay`, `did_not_pick_up`)
- [x] Add automatic call categorization + auto-notes scaffolding from call outcomes/transcripts
- [x] Expand analytics dashboard sections for disposition and follow-up metrics
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-20: analytics deep dive`

### Phase 21 — Realtime KB Tooling
- [x] Add knowledge-base lookup tools for OpenAI Realtime agent (parallel to scheduling tools)
- [x] Wire tool execution so agent can query KB and answer with grounded context/citations
- [x] Validate support workflows where agent answers from KB
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-21: realtime kb tools`

### Phase 22 — Voice Agent Command Center Modes + Templates
- [x] Add configurable operating modes for `support`, `outbound cold calling`, and `loan repayment collections`
- [x] Add at least 3 additional templates/use-cases as quick starts
- [x] Ensure templates drive prompt/personality/script defaults and remain user-customizable
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-22: command center templates`

### Phase 23 — CRM Integrations Research + Design
- [x] Pick 4 high-priority CRMs (`HubSpot`, `Salesforce`, `GoHighLevel`, `Pipedrive`) and document API/auth/data-mapping strategy
- [x] Define lead import, campaign switcher sync, and call outcome/disposition/notes sync contracts
- [x] Document rollout plan and risk constraints
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-23: crm research`

### Phase 24 — CRM Integrations Implementation
- [x] Implement integrations for selected CRMs (team-scoped credentials + sync jobs/actions)
- [x] Implement lead import into campaign switcher
- [x] Implement call data + notes + disposition sync back to CRM records
- [x] Validate support/outbound/loan-collections command-center workflows with CRM sync paths
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-24: crm integrations`

### Phase 25 — Telephony + Recording Research
- [x] Research telephony provider options and integration patterns for future call execution
- [x] Research OpenAI Realtime capabilities/limits for recordings/voice artifacts
- [x] Produce findings in markdown (`gg/voice-command-center-rebuild/telephony-recording-research.md`)
- [x] Add recommended backend architecture path for rollout
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-25: telephony research`

### Phase 26 — Sidebar Feature Gap Pass (CRM Product Completeness)
- [x] Review Leads, Pipelines, Campaigns, Calls, Appointments, Knowledge Base, Analytics for product gaps
- [x] Add/close high-impact gaps for support, outbound sales, and loan repayment collections
- [x] Document new follow-up phases as needed
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-26: sidebar product gaps`

### Phase 27 — Backend Optimization Pass II
- [x] Profile and optimize campaign queue + CRM sync throughput
- [x] Optimize analytics aggregation bottlenecks identified during CRM rollout
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-27: backend optimization`

### Phase 28 — Voice Agent Performance Data Completeness
- [x] Replace remaining voice-agent card performance placeholder with real per-agent call totals
- [x] Add backend aggregation for per-agent call totals in `getVoiceAgents`
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-28: agent performance data`

### Phase 29 — Final Validation + PR Sync II
- [x] Run `bun run typecheck` and `bun run lint`
- [x] Update planning docs after Phase 28
- [x] Commit: `phase-29: validation sync`

### Phase 30 — Advanced Settings Gap Closure (Knowledge Base Scope)
- [x] Replace disabled “knowledge base coming soon” section in advanced agent settings with working source-scoping UI
- [x] Load team KB sources and persist `knowledge_base.sourceIds` from advanced settings
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-30: advanced kb settings`

### Phase 31 — Telephony Readiness Research Refresh (Twilio/Vonage/Telnyx)
- [x] Re-read `gg/voice-command-center-rebuild/telephony-recording-research.md` and align implementation assumptions
- [x] Validate latest official API docs (Twilio, Vonage, Telnyx) via `webctx` and capture integration-critical endpoints/events
- [x] Record concrete provider capability matrix and rollout constraints in planning docs
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-31: telephony refresh`

### Phase 32 — Telephony Domain + Provider Adapters Foundation
- [x] Add backend telephony domain scaffolding (provider abstraction, execution contracts, normalized call-event shape)
- [x] Add first-class provider adapters for Twilio/Vonage/Telnyx (config + request/signature helper surfaces)
- [x] Wire call-queue processor to provider abstraction while preserving mock fallback mode
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-32: telephony foundation`

### Phase 33 — Recording Infrastructure (Backend + UI Readiness)
- [x] Add recording persistence model and APIs (recording metadata + provider links + storage pointers)
- [x] Add recording lifecycle plumbing from telephony execution/webhooks into call records
- [x] Expose recording data in UI call details/analytics surfaces
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-33: recording readiness`

### Phase 34 — Telephony Webhook Ingestion + Security
- [x] Implement provider webhook endpoints for Twilio/Vonage/Telnyx
- [x] Add signature verification + normalized event ingestion + idempotency guards
- [x] Persist webhook events for audit/debug replay
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-34: webhook ingestion`

### Phase 35 — Backend Rewrite Gap Audit II
- [x] Deep-scan backend for stale/legacy code paths that conflict with rewrite vision
- [x] Remove or rewrite incomplete/duplicate implementations surfaced during telephony integration prep
- [x] Document newly discovered product/tech debt as follow-up phases if needed
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-35: backend gap audit`

### Phase 36 — End-to-End Validation + PR Final Sync
- [x] Run `bun install`, `bun run typecheck`, `bun run lint`
- [x] Ensure planning docs reflect completion state for phases 31-35
- [x] Update PR title/body/checklist for telephony + recording readiness scope
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-36: final sync`

### Phase 37 — Phone Numbers UI Integration
- [x] Add team-scoped phone numbers domain (schema + CRUD actions + default outbound assignment)
- [x] Build `/phone-numbers` page with provider-aware UI and onboarding content for telephony setup
- [x] Add sidebar navigation entry for phone numbers management
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-37: phone numbers ui integration`

### Phase 38 — Outbound Caller ID Routing Integration
- [x] Resolve outbound caller ID from team phone numbers by provider + optional assigned agent
- [x] Pass resolved caller ID through telephony execution contracts and provider adapters
- [x] Persist selected outbound number into call/telephony metadata for audit and debugging
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-38: outbound caller id routing`

### Phase 39 — Auto Provider Routing From Team Numbers
- [x] Auto-select execution provider from active team phone numbers when env provider is not forced
- [x] Preserve `CALL_EXECUTION_PROVIDER` as explicit override path for controlled rollouts
- [x] Keep agent-assigned/default-number fallback ordering deterministic
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-39: auto provider routing`

### Phase 40 — Scheduled Caller ID Selection
- [x] Add caller ID selection in call scheduling UI using active team phone numbers
- [x] Persist selected outbound number/provider metadata in queue + communication logs
- [x] Respect explicit queued caller ID during queue processing before fallback routing
- [x] Update `PROGRESS.md`
- [x] Commit: `phase-40: scheduled caller id selection`
