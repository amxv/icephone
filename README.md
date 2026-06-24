# IcePhone

IcePhone is a Next.js application for running AI voice agents with built-in CRM workflows, campaign automation, call queue processing, appointment scheduling, and multi-provider telephony integrations.

This repository is open source under the Apache 2.0 license and is intended for self-hosted deployments. The package remains `private` because this repo is shipped as an application, not as an npm library.

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
