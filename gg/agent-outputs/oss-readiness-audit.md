# OSS Readiness Audit

Recommendation: **not ready** for a public open-source release yet.

Scope note: this is a static audit of code and repository hygiene. I also attempted a clean typecheck, but this workspace does not have installed dependencies, so runtime validation was not reproducible here.

## Blockers

- **No root license file is present.** I did not find `LICENSE`, `COPYING`, or `NOTICE` at the repo root. Without a license, public redistribution terms are undefined and the repository should not be published as OSS yet.

- **The environment contract is incomplete, stale, and misleading.** `/.env.example` only documents `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DEV_DB_URL`, and `PROD_DB_URL`, but the codebase uses a much larger env surface. It is also stale because the app uses Better Auth, not Clerk. Missing vars include at least:
  - Auth / app origin: `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_NON_PAYMENT_DISABLED`
  - AI: `OPENAI_API_KEY`, `OPENAI_REALTIME_VOICE`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `VOYAGE_API_KEY`
  - Email / storage: `RESEND_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
  - Scheduling / cron: `CALCOM_API_BASE_URL`, `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID`, `CALCOM_EVENT_TYPE_SLUG`, `CALCOM_TEAM_SLUG`, `CALCOM_USERNAME`, `CALCOM_ORGANIZATION_SLUG`, `CALCOM_DEFAULT_TIMEZONE`, `CALL_QUEUE_PROCESSOR_SECRET`, `CAMPAIGN_PROCESSOR_SECRET`, `CALL_EXECUTION_ENABLED`, `CALL_EXECUTION_PROVIDER`
  - Telephony: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_OUTBOUND_TWIML_URL`, `TWILIO_STATUS_CALLBACK_URL`, `TWILIO_RECORD_CALLS`, `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_FROM_NUMBER`, `TELNYX_WEBHOOK_URL`, `TELNYX_PUBLIC_KEY` or `TELNYX_API_PUBLIC_KEY`, `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY`, `VONAGE_FROM_NUMBER`, `VONAGE_ANSWER_URL`, `VONAGE_EVENT_URL`, `VONAGE_WEBHOOK_SIGNATURE_SECRET` or `VONAGE_SIGNATURE_SECRET` or `VONAGE_API_SIGNATURE_SECRET` or `VONAGE_APPLICATION_SECRET`, `TELEPHONY_WEBHOOK_ALLOW_UNSIGNED`
  - Platform-specific but referenced: `VERCEL_URL`, `VERCEL_BRANCH_URL`
  - These vars need to be grouped by core vs optional feature, because the current template gives no guidance on what a new OSS user must configure first.

- **Auth falls back to unsafe defaults if secrets are missing.** In [src/lib/auth.ts](/Users/ashray/code/amxv/icephone/src/lib/auth.ts#L8-L11), `baseURL` falls back to `http://localhost:3000`. More importantly, `secret` falls back to `""` at [src/lib/auth.ts](/Users/ashray/code/amxv/icephone/src/lib/auth.ts#L106-L115). A public install should fail fast when `BETTER_AUTH_SECRET` is absent, not start with an empty signing secret.

- **Outbound email is hard-coded to an internal/company-branded sender.** [src/lib/email.ts](/Users/ashray/code/amxv/icephone/src/lib/email.ts#L24-L33) defaults the sender to `IcePhone CRM <noreply@icephone.com>`. That leaks an internal domain and should be moved to configuration before publishing.

## Important Fixes

- **Add real setup and community docs at the repo root.** I did not find a root `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, or `.github/` workflow directory. Public users need a clear install/run/deploy path, and maintainers need at least basic contribution and security guidance.

- **Replace starter-template naming and stale Clerk residue.** `package.json` is still named `clerk-nextjs-app-quickstart` and `/.env.example` still advertises Clerk env vars. If this repo is being released as IcePhone, the package name and example env file should be renamed to match the actual product, and the Clerk placeholders should be removed.

- **Fix the validation scripts so they are safe and actually cover the repo.** In [package.json](/Users/ashray/code/amxv/icephone/package.json#L12-L13), `lint` only targets `src/**/*.{jsx,tsx}`, so `.ts` files, scripts, and the `video/` app are not linted. The `check` script also runs `biome check --write --unsafe .`, which mutates files during a supposedly read-only verification command. For OSS users, that is surprising and easy to misuse.

- **Make environment loading deterministic.** [src/db/index.ts](/Users/ashray/code/amxv/icephone/src/db/index.ts#L1-L12) unconditionally loads `.env.local` inside application code, and the Drizzle configs do the same before falling back to `.env`. That is convenient locally, but it hides missing env vars and makes runtime behavior depend on local filesystem state. Move this bootstrap logic to scripts or document it very explicitly.

- **Document the security toggles and background processor secrets.** The call queue and campaign endpoints require `CALL_QUEUE_PROCESSOR_SECRET` and `CAMPAIGN_PROCESSOR_SECRET`, and call execution is gated by `CALL_EXECUTION_ENABLED` / `CALL_EXECUTION_PROVIDER`. The telephony webhook route also has an override, `TELEPHONY_WEBHOOK_ALLOW_UNSIGNED`, that can bypass signature verification. Those controls are acceptable for internal ops, but a public repo needs explicit docs about when they are safe to enable and what the default behavior is.

- **Document provider setup and the safe fallback behavior.** The telephony provider resolver defaults to `mock` when no real provider is configured, which is safe but can be confusing for new installs because the app may appear functional without placing real calls. The docs should explain how to activate Twilio, Telnyx, or Vonage, what credentials each one needs, and what happens when no outbound phone number exists.

- **Add a reproducible clean-install verification path.** I was unable to validate `bun run typecheck` in this workspace because dependencies were not installed. That is an environment limitation, not a code defect, but the repo should ship with a documented clean-install verification flow and CI that proves `bun install`, `bun run build`, and typecheck succeed from scratch.

## Minor / Preferred Fixes

- **Parameterize remaining branded strings if the project should be white-label friendly.** [src/lib/email-templates.ts](/Users/ashray/code/amxv/icephone/src/lib/email-templates.ts) hard-codes `IcePhone CRM` in the subject and signature text. [src/lib/crm/providers/shared.ts](/Users/ashray/code/amxv/icephone/src/lib/crm/providers/shared.ts) also embeds `IcePhone call sync (...)` into CRM notes. These are fine if the public project is intentionally branded as IcePhone, but they should be configurable if neutrality or white-label use is a goal.

- **Escape user-controlled values in email HTML.** [src/lib/email-templates.ts](/Users/ashray/code/amxv/icephone/src/lib/email-templates.ts#L1-L69) interpolates `leadName` and `content` directly into HTML. If those values can come from user input or model output, they should be escaped or sanitized before rendering into outbound email.

- **Make the auth/base URL story explicit in setup docs.** The code supports `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, and Vercel-derived origins in [src/lib/auth.ts](/Users/ashray/code/amxv/icephone/src/lib/auth.ts#L8-L115) and [src/lib/auth-client.ts](/Users/ashray/code/amxv/icephone/src/lib/auth-client.ts). That is workable, but new users need a simple “local dev / production / branch deploy” matrix so they do not guess at which URL variable wins.

- **Decide whether the package should remain private.** `package.json` is set to `private: true`, which is fine for a GitHub-only OSS app but blocks npm publishing. If npm distribution is part of the release plan, this needs to be changed and documented.

- **Reduce release-time ambiguity around optional integrations.** The repo supports OpenAI, Anthropic, Google, Cal.com, Resend, R2, Twilio, Telnyx, and Vonage, but the current top-level template does not separate required env vars from optional provider-specific ones. A small setup matrix would prevent a lot of first-run confusion.

## Summary

The main release blockers are legal/compliance completeness, an incomplete and stale env contract, and unsafe auth/email defaults. The rest of the work is mostly release hygiene and onboarding clarity: add root docs, publish a real env matrix, make scripts non-surprising, and document the optional provider story clearly.
