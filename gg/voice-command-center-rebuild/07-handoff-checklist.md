# Handoff Checklist for Implementation Agent

Use this checklist to start executing the rewrite.

## 1. Start State
- Branch created: `codex/voice-command-center-rewrite`
- Repo builds with UI intact after removing chat/email/phone numbers

## 2. Core Decisions (Do Not Re‑litigate)
- Web‑only voice using OpenAI Realtime
- Better Auth (email/password)
- Team‑scoped schema
- OpenAI Vector Store + R2
- Cal.com for scheduling
- Resend only for auth/system email

## 3. Execution Order
1. Run Phase 0 cleanup
2. Implement Better Auth + middleware
3. Create v1 schema + migrations
4. Rebuild Leads + Pipeline server actions
5. Implement Agents + Calls + OpenAI Realtime
6. Implement Campaigns + Call Queue
7. Implement Knowledge + R2 + Vector Store
8. Implement Cal.com appointments
9. Implement Analytics + Admin

## 4. Required Documentation
- `01-feature-contract-map.md`
- `02-ui-data-contracts.md`
- `03-schema-v1.md`
- `04-services-architecture.md`

