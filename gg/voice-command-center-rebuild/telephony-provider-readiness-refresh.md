# Telephony Readiness Refresh (Phase 31)

## Scope
- Re-validate Twilio, Telnyx, and Vonage implementation assumptions against official docs.
- Capture callback/signature/recording differences that impact backend adapter and webhook design.

## Provider Capability Snapshot

### Twilio
- Outbound call creation: `POST /2010-04-01/Accounts/{AccountSid}/Calls.json`
- Streaming: TwiML `<Start><Stream>` (uni) and `<Connect><Stream>` (bi-directional)
- Recording: Voice Recording API and status callbacks (`recordingStatusCallback`)
- Webhook auth: `X-Twilio-Signature` HMAC verification
- Notes:
  - Supports CPS queueing on outbound API.
  - Media Streams payload format is well-documented for websocket bridge implementations.

### Telnyx
- Outbound call creation: `POST /v2/calls`
- Streaming/Control: call control actions (`/v2/calls/{call_control_id}/actions/*`)
- Recording: `record_start`/`record_pause`/`record_resume`/`record_stop` actions + retrieval endpoints
- Webhook auth: `telnyx-signature-ed25519` + `telnyx-timestamp` over `timestamp|payload`
- Notes:
  - Delivery can be duplicate/out-of-order; idempotent event ingestion is required.
  - `call.recording.saved` callback includes recording URL metadata.

### Vonage
- Outbound call creation: `POST /v1/calls`
- Call flow model: NCCO (`answer_url`, `event_url`) orchestration
- Recording: NCCO `record` action (sync/async modes, split-channel options)
- Webhook auth: signed JWT in `Authorization` header (HS256 + payload hash claim)
- Notes:
  - Operational model differs from Twilio/Telnyx due NCCO flow and event semantics.
  - Hosted recording retention defaults may require first-party archival policy.

## Integration-Critical Constraints
- Use provider abstraction for:
  - outbound dispatch
  - webhook signature verification
  - event normalization
  - recording lifecycle mapping
- Persist append-only event log with dedupe keys before mutating call state.
- Normalize call statuses into a shared internal enum (`queued`, `ringing`, `in_progress`, `completed`, `failed`, etc.).
- Keep recording handling provider-agnostic: persist metadata + URL now, first-party object archival in rollout stage.

## References (Official)
- Twilio Voice Media Streams: https://www.twilio.com/docs/voice/media-streams
- Twilio TwiML Stream: https://www.twilio.com/docs/voice/twiml/stream
- Twilio Webhook Security: https://www.twilio.com/docs/usage/webhooks/webhooks-security
- Twilio Recording API: https://www.twilio.com/docs/voice/api/recording
- Telnyx Programmable Voice: https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-commands-and-resources
- Telnyx Webhooks: https://developers.telnyx.com/docs/voice/programmable-voice/receiving-webhooks
- Telnyx Recording Callback: https://developers.telnyx.com/api-reference/callbacks/call-recording-saved
- Vonage Voice API: https://developer.vonage.com/en/api/voice
- Vonage Voice Recording Concept: https://developer.vonage.com/en/voice/voice-api/concepts/recording
- Vonage Webhooks Concept: https://developer.vonage.com/en/getting-started/concepts/webhooks
