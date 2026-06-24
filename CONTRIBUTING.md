# Contributing

## Development workflow

1. Install dependencies with `bun install`.
2. Copy `.env.example` to `.env` and configure the minimum required values.
3. Make focused changes with tests or verification steps that match the scope of the change.
4. Run `bun run check` before opening a pull request.
5. Run `bun run check:release` for changes that affect build output, env handling, or release infrastructure.

## Pull request expectations

- Keep changes scoped and explain user-facing impact clearly.
- Update docs when behavior, setup, or environment requirements change.
- Do not commit secrets, production credentials, or private key material.
- Preserve safe defaults for auth, webhook verification, and queue processing.

## Environment and integration changes

- Add any new environment variable to `.env.example` and `README.md`.
- Treat Twilio, Telnyx, Vonage, Resend, Cal.com, R2, and AI provider setup as optional unless the feature cannot work without them.
- Do not introduce internal domains, sender addresses, or company-only defaults into OSS-facing codepaths.

## Release checks

The standard release verification flow is:

```bash
bun install
bun run check
bun run build
```
