# Prune List (Remove Chat, Email, Phone Numbers)

These are the exact areas to delete or refactor in the rewrite.

---

## Chat Domain
**Remove files**
- `src/app/(pages)/chats/*`
- `src/components/chats-page-client.tsx`
- `src/components/chats-table.tsx`
- `src/actions/chats.ts`
- `src/db/schema.ts` → `chats`, `chat_messages`
- `src/app/admin/messages/page.tsx`
- `src/components/knowledge-base/StreamingRAGChat.tsx`

**Refactor**
- `src/app/(pages)/knowledge/page.tsx` → remove AI chat tab

---

## Email Domain
**Remove files**
- `src/app/(pages)/emails/*`
- `src/components/emails-page-client.tsx`
- `src/components/emails-table.tsx`
- `src/actions/emails.ts`
- `src/components/communication/email-dialog.tsx`
- `src/components/email-thread-modal.tsx`
- `src/db/schema.ts` → `emails`, `email_templates`

**Refactor**
- `src/actions/lead-communication.ts` → remove email workflows
- `src/app/(pages)/leads/[id]/page.tsx` → remove email history section
- `src/lib/ai-helpers.ts` → remove email response generator

---

## Phone Numbers
**Remove files**
- `src/app/(pages)/phone-numbers/*`
- `src/components/phone-numbers-page-client.tsx`
- `src/components/add-phone-number-dialog.tsx`

**Refactor**
- `src/components/simple-agent-creator.tsx` → remove phone number assignment step
- `src/components/voice-agents-page-client.tsx` → remove phone assignment UI

---

## VAPI Integration
**Remove or replace**
- `src/lib/vapi*.ts`
- `src/actions/voice-agents.ts` (full rewrite)
- `src/app/api/vapi/*`

---

## Cloudflare Deployment Artifacts
When moving to Vercel:
- `open-next.config.ts`
- `wrangler.jsonc`
- `cloudflare-env.d.ts` (if unused)
- `workers/*` (document ingestion worker)

