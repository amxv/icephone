# IcePhone

IcePhone is a Next.js application for running AI voice agents with built-in CRM workflows, campaign automation, call queue processing, appointment scheduling, and multi-provider telephony integrations.

This repository is open source under the Apache 2.0 license and is intended for self-hosted deployments. The package remains `private` because this repo is shipped as an application, not as an npm library.

## Overview

IcePhone is an AI voice operations app for teams that live on the phone. It combines configurable voice agents, calling workflows, CRM data, scheduling, and reporting into one self-hosted system so outbound and inbound phone operations can run from a single codebase.

At a high level, the app is built for organizations that need to automate high-volume phone communication without splitting voice operations, lead management, scheduling, and reporting across separate systems. It supports use cases such as cold outreach, lead qualification, appointment setting, support, onboarding, retention, and collections.

Rather than treating AI calling as a standalone demo or a thin wrapper around a voice model, IcePhone is structured like an operational system. Voice agents live alongside lead data, campaign controls, appointment workflows, phone number management, queue processing, and post-call analysis. That means the same application can be used to design an agent, test it in realtime, assign it to a campaign, place calls through a configured provider, review outcomes, update lead state, schedule follow-ups, and inspect transcripts and summaries afterward.

The project is also designed to be practical for self-hosted teams. It supports mock and real telephony modes, optional integrations instead of one mandatory vendor stack, explicit execution controls for protected processing routes, and a setup model where core app functionality can be brought up first and additional providers can be layered on as needed. For teams evaluating the codebase, the important point is that IcePhone is not just a UI shell around calling APIs; it is a broader application for managing the lifecycle of AI-driven phone operations.

Main feature areas:

- AI voice agents.
  Create multiple voice agents with configurable prompts, personalities, first messages, call behavior, business hours, voicemail handling, transfer logic, custom vocabulary, and model settings. Agents can be tailored for different business functions instead of forcing one generic assistant across every workflow. The app also includes role-oriented starting points for common scenarios like support, cold calling, collections, appointment setting, onboarding, and retention, which makes it easier to get to a working baseline before customizing prompts and behavior in detail.
- Realtime testing and conversation intelligence.
  Test agents directly in the browser with realtime voice sessions, live transcripts, listening/speaking state, and post-call summaries. Calls can capture transcripts, sentiment, tool usage, recordings, and other operational details for later review. This makes the app useful not only for deployment, but also for iteration: teams can quickly validate prompt changes, tool behavior, and conversation flow before turning an agent loose in real calling workflows.
- Campaign automation and queue processing.
  Run outbound campaigns with lifecycle states, scheduling, retry rules, business-hour enforcement, per-lead context, campaign-specific prompt tuning, and queue-based execution. Campaigns are more than a list of phone numbers: they carry their own operating constraints, context, and success definitions, which lets teams separate one outreach motion from another. The system also supports controlled call execution with explicit enablement and provider selection, so live outbound behavior is gated rather than happening implicitly.
- Built-in CRM and lead workflows.
  Manage leads, scores, stages, notes, assignments, communication history, and follow-up actions from one place. The app includes lead detail views, pipeline-style workflow management, bulk import paths, and CRM-oriented activity tracking tied directly to calling operations. Instead of pushing call outcomes into a separate system after the fact, IcePhone keeps the operational context and the customer record close together, which is important for workflows where calling, qualification, follow-up, and conversion all affect one another.
- Scheduling and appointment management.
  Create and manage appointments, attach them to leads, and integrate with Cal.com for booking, rescheduling, and cancellation workflows. Voice agents can also schedule appointments during live conversations when scheduling is configured. That makes the platform suitable for teams where the desired outcome of a call is not just a conversation, but a concrete next step such as a demo, consultation, or callback window.
- Telephony and phone number operations.
  Connect Twilio, Telnyx, or Vonage for live telephony, manage outbound numbers, track provider-specific call metadata, validate webhooks, and handle recordings. The codebase includes the provider plumbing needed for production-style call flows, while still allowing local work to proceed safely when no live provider is configured. In that case, the app can fall back to a mock telephony mode so contributors can explore the product without accidentally initiating real outbound activity.
- Knowledge, analytics, and extensibility.
  Agents can search a knowledge base during conversations, trigger webhook-backed functions, and work alongside integrations for AI providers, storage, email, and other supporting services. The broader platform also includes analytics and reporting surfaces for calls and campaigns, so the app can function as both an execution layer and an operations review layer. For teams extending the system, this matters because the architecture already expects external services, provider-specific behavior, and tool-enabled conversations rather than assuming every workflow is hard-coded into one narrow path.

Detailed feature breakdown: [docs/feature-capability-overview.md](docs/feature-capability-overview.md)

## What is included

- Better Auth based authentication and team-scoped access control
- Lead, campaign, and call queue management
- AI-assisted voice agent configuration and realtime voice sessions
- Optional integrations for OpenAI, Anthropic, Google, Voyage, Resend, Cal.com, Cloudflare R2, Twilio, Telnyx, and Vonage
- Safe mock telephony behavior when no live calling provider is configured

## Requirements

- Bun 1.2+
- Node.js 20+
- PostgreSQL

## Quick start

1. Install dependencies:

```bash
bun install
```

2. Copy the environment template and fill the required values:

```bash
cp .env.example .env
```

3. Set the minimum required environment variables:

- `APP_URL`, `APP_BASE_URL`, and `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`
- `DEV_DB_URL` and `PROD_DB_URL`

4. Run the app:

```bash
bun run dev
```

5. Run the read-only verification suite:

```bash
bun run check
```

6. Run the release verification suite before shipping changes:

```bash
bun run check:release
```

## Environment guide

`.env.example` is the source of truth for supported environment variables. The values break down into these groups:

### Required for local development

- `APP_URL`
- `APP_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `DEV_DB_URL`
- `PROD_DB_URL`

If `BETTER_AUTH_SECRET` is missing, the app now fails fast instead of starting with an empty signing secret.

### Optional but commonly used

- `APP_NAME`
- `RESEND_API_KEY`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `OPENAI_API_KEY`
- `OPENAI_REALTIME_VOICE`

If email is enabled without `EMAIL_FROM_ADDRESS`, outbound mail falls back to Resend's onboarding sender address so the repo does not leak an internal default domain.

### Optional AI providers

- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `VOYAGE_API_KEY`

### Optional scheduling

- `CALCOM_API_BASE_URL`
- `CALCOM_API_KEY`
- `CALCOM_EVENT_TYPE_ID`
- `CALCOM_EVENT_TYPE_SLUG`
- `CALCOM_TEAM_SLUG`
- `CALCOM_USERNAME`
- `CALCOM_ORGANIZATION_SLUG`
- `CALCOM_DEFAULT_TIMEZONE`

### Optional storage

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### Optional queue and campaign processing

- `CALL_QUEUE_PROCESSOR_SECRET`
- `CAMPAIGN_PROCESSOR_SECRET`
- `CALL_EXECUTION_ENABLED`
- `CALL_EXECUTION_PROVIDER`

These secrets are only required if you enable the protected queue and campaign processing endpoints. Keep `CALL_EXECUTION_ENABLED=false` until a real outbound provider is configured and tested.

### Optional telephony providers

Twilio:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_OUTBOUND_TWIML_URL`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_RECORD_CALLS`

Telnyx:

- `TELNYX_API_KEY`
- `TELNYX_CONNECTION_ID`
- `TELNYX_FROM_NUMBER`
- `TELNYX_WEBHOOK_URL`
- `TELNYX_PUBLIC_KEY`
- `TELNYX_API_PUBLIC_KEY`

Vonage:

- `VONAGE_APPLICATION_ID`
- `VONAGE_PRIVATE_KEY`
- `VONAGE_FROM_NUMBER`
- `VONAGE_ANSWER_URL`
- `VONAGE_EVENT_URL`
- `VONAGE_WEBHOOK_SIGNATURE_SECRET`
- `VONAGE_SIGNATURE_SECRET`
- `VONAGE_API_SIGNATURE_SECRET`
- `VONAGE_APPLICATION_SECRET`

When no supported live provider is configured, the telephony layer falls back to the mock provider. That is intentional and safe for local exploration, but it will not place real calls.

### Deployment-provided URLs

- `VERCEL_URL`
- `VERCEL_BRANCH_URL`

These are optional convenience values used to trust branch and preview deployment origins.

## Auth and URL precedence

IcePhone uses a single shared base URL strategy across auth, queue processing, and webhook generation:

1. `APP_BASE_URL`
2. `APP_URL`
3. `NEXT_PUBLIC_APP_URL`
4. `BETTER_AUTH_URL`
5. `NEXT_PUBLIC_BETTER_AUTH_URL`
6. `http://localhost:3000` as the local fallback

Recommended values:

- Local development: set all app/auth URL vars to `http://localhost:3000`
- Production: set them all to your public HTTPS origin
- Preview deployments: keep production defaults and allow `VERCEL_URL` / `VERCEL_BRANCH_URL` to populate trusted auth origins

## Telephony security toggles

- `CALL_QUEUE_PROCESSOR_SECRET` protects the call queue processing endpoint.
- `CAMPAIGN_PROCESSOR_SECRET` protects the campaign processing endpoint.
- `CALL_EXECUTION_ENABLED` must stay `false` until you intentionally enable real outbound execution.
- `CALL_EXECUTION_PROVIDER` should be set to the provider you configured and validated.
- `TELEPHONY_WEBHOOK_ALLOW_UNSIGNED` is a development-only escape hatch. Keep it `false` in any shared or production environment because it bypasses webhook signature enforcement.

## Database and Drizzle

Application runtime no longer loads `.env.local` implicitly. Next.js runtime env resolution is left to the framework.

Drizzle commands read `.env` by default. To use another file, set `ICEPHONE_ENV_FILE` explicitly:

```bash
ICEPHONE_ENV_FILE=.env.local bun run db:dev:generate
ICEPHONE_ENV_FILE=.env.local bun run db:dev:migrate
```

## Scripts

- `bun run dev` starts local development
- `bun run build` creates a production build
- `bun run lint` runs ESLint across the app, root config files, scripts, and the `video/` package
- `bun run typecheck` runs TypeScript without emitting output
- `bun run check` runs typecheck, Biome in read-only mode, and lint
- `bun run check:release` runs the full read-only verification suite plus `next build`

## Clean install verification

The intended reproducible verification path is:

```bash
bun install
bun run check
bun run build
```

GitHub Actions runs the same flow on every push and pull request.

## Provider setup notes

- OpenAI realtime voice features require `OPENAI_API_KEY` and a valid `OPENAI_REALTIME_VOICE`.
- Resend email support requires `RESEND_API_KEY`; production deployments should also set `EMAIL_FROM_ADDRESS`.
- Cal.com scheduling features require a configured API key plus at least one event type identifier or slug.
- R2-backed file storage requires all four R2 variables.
- Twilio, Telnyx, and Vonage integrations each require their own credentials and a provisioned outbound number before real calling works.

## Contributing and security

- Contribution guidance: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- License terms: [LICENSE](LICENSE)
