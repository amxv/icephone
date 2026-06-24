# IcePhone Feature & Capability Overview

IcePhone is an AI voice operations platform for self-hosted teams that need to automate phone-heavy workflows without splitting work across multiple disconnected tools.

## Core platform areas

### AI voice agents

- Create and manage multiple voice agents with different roles, prompts, and behaviors
- Start realtime voice sessions for browser-based testing
- Configure call flow behavior such as turn-taking, interruptions, voicemail handling, and idle behavior
- Support role-driven use cases such as sales outreach, appointment setting, support, collections, onboarding, and retention

### Campaign automation

- Build outbound campaigns with lifecycle states, lead assignment, and scheduling controls
- Run queue-based execution with retry rules, daily limits, priority handling, and business hours enforcement
- Gate real call execution behind explicit provider configuration and processor secrets
- Track campaign performance and health from in-product dashboards

### CRM and lead workflows

- Store leads, statuses, notes, source data, scores, and deal stage progress
- View pipeline state in a visual board
- Track call history, communication logs, and follow-up actions per lead
- Support bulk lead import and CRM sync workflows

### Telephony and phone number management

- Integrate with Twilio, Telnyx, or Vonage for real outbound and inbound telephony
- Manage phone numbers, webhook handling, call lifecycle data, and provider metadata
- Fall back to a mock provider when no live telephony provider is configured
- Support transfer, recording, callback, and provider-specific webhook processing paths

### Scheduling and appointments

- Create and manage appointments tied to leads
- Integrate with Cal.com for booking flows and event type configuration
- Let voice agents schedule appointments during live interactions when scheduling is enabled

### Knowledge base and AI-assisted workflows

- Connect model providers including OpenAI, Anthropic, Google, and Voyage where needed
- Use knowledge-base-backed retrieval flows to ground voice agent answers
- Support AI-generated summaries, sentiment tagging, and other assistance around call data

### Storage, email, and integrations

- Send outbound email through Resend
- Store assets and documents in Cloudflare R2
- Extend workflows through webhook-based integrations and provider-specific setup

## Deployment model

- Next.js application intended for self-hosted deployment
- Apache 2.0 licensed repository
- OSS-safe defaults for auth, queue execution, webhook verification, and provider setup

## Setup references

- Root setup and environment guide: [../README.md](../README.md)
- Contribution guidance: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Security guidance: [../SECURITY.md](../SECURITY.md)
