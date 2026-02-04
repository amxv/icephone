# Telephony + Recording Research (Phase 25)

## Purpose
Define a production-ready path for adding PSTN telephony and compliant call recording to the OpenAI Realtime-powered voice agent stack.

## Scope
- Evaluate telephony providers for outbound/inbound call execution.
- Clarify OpenAI Realtime recording/voice artifact capabilities and limits.
- Recommend backend architecture for future rollout.

## OpenAI Realtime Findings (Current)

### 1) Session + Call Control
- WebRTC call creation uses `POST /v1/realtime/calls`.
- Sideband server control is supported by connecting to the same call via `call_id` over WebSocket.
- Native SIP support exists in Realtime with incoming-call events and server-side accept/reject/hangup style controls.

### 2) Tooling + Event Model
- GA event naming uses `response.output_*`-style events for output streams.
- Function/tool calling is first-class and can be orchestrated from the sideband server path.

### 3) Recording / Audio Artifact Reality
- Realtime can expose audio content through event streams (`response.output_audio.delta`) and conversation item retrieval.
- There is no single “download full call recording artifact” primitive in the currently documented Realtime API surface.
- Practical architecture should treat recording as an app responsibility: persist telephony media and/or streamed assistant/user audio frames into first-party storage.

## Telephony Provider Comparison

## Twilio
- Strong programmable voice surface and mature recording APIs.
- Media Streams supports real-time audio streaming (unidirectional and bidirectional patterns).
- High ecosystem maturity, rich callbacks, broad operational tooling.
- Tradeoff: cost at scale can be higher; implementation detail complexity around stream topology and queueing.

## Telnyx
- Full programmable voice API (dial, answer, streaming, recording, transcription, webhooks).
- Recording APIs and retrieval are explicit and straightforward.
- Good fit for direct call-control heavy systems.
- Tradeoff: smaller ecosystem than Twilio; team familiarity may vary.

## Vonage
- Voice API with NCCO-based control, recording support, and WebSocket audio endpoint pattern.
- Viable if call flows map well to NCCO orchestration.
- Tradeoff: hosted recording retention constraints and different operational model than Twilio/Telnyx.

## Plivo
- Programmable voice + call recording + callback flow, with documented OpenAI Realtime integration path.
- Useful if we want a provider with explicit AI voice-agent examples.
- Tradeoff: ecosystem and integrations can be narrower than Twilio.

## Recommendation
- **Primary launch candidate:** Twilio (maturity + ecosystem + proven media stream patterns).
- **Secondary/backup candidate:** Telnyx (strong API surface and good recording primitives).
- Keep provider abstraction from day one to avoid lock-in.

## Recommended Backend Architecture

## Core Services
1. `telephony-provider-adapter`
- Provider-agnostic interface:
  - `createOutboundCall`
  - `hangupCall`
  - `pause/resume recording` (where supported)
  - `resolveWebhookSignature`
  - `normalizeProviderEvent`

2. `media-bridge`
- Bridges provider audio stream <-> OpenAI Realtime call session.
- Owns stream state, reconnect handling, and backpressure management.
- Emits unified events to internal bus (`call.started`, `call.ringing`, `call.answered`, `call.ended`, `recording.ready`).

3. `realtime-orchestrator`
- Creates Realtime calls/sessions, applies model + instructions + tools.
- Maintains sideband control channel for tool execution and policy enforcement.

4. `recording-pipeline`
- Ingests provider recording callbacks and/or locally assembled media streams.
- Stores immutable audio blobs in object storage (R2).
- Generates normalized metadata records and retention lifecycle jobs.

5. `analytics + outcomes processor`
- Aggregates pickup/connect rates, disposition outcomes, and campaign-level stats.
- Calculates business signals: `intent_to_pay`, `promise_to_pay`, `did_not_pick_up`, etc.

## Data/Storage Model (Minimum)
- `call_recordings`
  - `id`, `team_id`, `call_id`, `provider`, `provider_recording_id`, `storage_key`, `duration_seconds`, `channels`, `created_at`
- `telephony_calls`
  - provider identifiers, leg IDs, status timeline, dial attempts, failure reason
- `telephony_events`
  - append-only normalized webhook/event log for auditing + replay

## Compliance & Security Baseline
- Encrypt at rest for recording objects and metadata.
- Team-scoped access controls and signed URL delivery.
- Recording consent + jurisdiction policy hooks before capture.
- Configurable retention policies and deletion workflow.
- PII redaction pass for transcripts/notes where required.

## Rollout Plan

## Stage 1 — Provider Abstraction + Event Normalization
- Build adapter interface and one concrete provider implementation.
- Ingest webhooks and persist normalized call/event timeline.

## Stage 2 — Media Bridge + Realtime Sideband
- Establish provider stream <-> Realtime media loop.
- Persist structured call events and failure diagnostics.

## Stage 3 — Recording Pipeline
- Capture/store recordings in R2.
- Add retrieval endpoints with team-scoped auth + signed URLs.

## Stage 4 — Analytics + Ops
- Add telephony-specific dashboards (ASR, ACD, drop/failure rates, retries).
- Add operational tooling (replay, dead-letter recovery, provider failover strategy).

## Suggested Decision for Next Implementation Phase
- Implement Twilio first behind provider abstraction.
- Define schema for `telephony_calls`, `telephony_events`, `call_recordings`.
- Build webhook signature verification and normalized event ingestion before live media bridging.
