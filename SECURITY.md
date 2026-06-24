# Security Policy

## Supported use

This repository is intended for self-hosted deployments. Operators are responsible for configuring their own secrets, providers, and infrastructure protections.

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected security vulnerability.

Instead, report the issue privately to the maintainers with:

- A clear description of the issue
- Affected files, routes, or features
- Reproduction steps or proof of concept
- Impact assessment and any suggested mitigation

If you do not yet have a private contact channel with the maintainers, establish one before sharing exploit details.

## Security-sensitive configuration

- `BETTER_AUTH_SECRET` is required and must be set to a strong random value in every environment.
- `CALL_QUEUE_PROCESSOR_SECRET` and `CAMPAIGN_PROCESSOR_SECRET` should be configured before exposing queue or campaign processor endpoints.
- `TELEPHONY_WEBHOOK_ALLOW_UNSIGNED` must remain `false` outside local development.
- Real telephony providers should not be enabled until credentials, outbound numbers, and webhook validation are configured correctly.
- Production email should set `EMAIL_FROM_ADDRESS` explicitly instead of relying on the development fallback.
