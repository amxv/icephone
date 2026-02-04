# Services Architecture (Voice‑First)

This describes how the new backend should integrate with external services while keeping UI intact.

---

## 1) Auth: Better Auth + Drizzle
**Goal:** Replace Clerk entirely.

**Core files to implement**
- `src/lib/auth.ts` — Better Auth server config
- `src/lib/auth-client.ts` — client SDK
- `src/app/api/auth/[...all]/route.ts` — Next.js handler
- `src/middleware.ts` — protect routes using Better Auth (no Clerk)

**Auth Flow**
- Email/password only for now
- Sessions stored in DB
- `team_id` assigned on signup

**Environment Variables**
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

---

## 2) Voice: OpenAI Realtime (Web Only)
**Goal:** Real-time web calls with tool support and transcripts.

**Core API Route**
- `POST /api/voice/session`
  - Creates an ephemeral session using OpenAI Realtime API
  - Uses agent config to build instructions, voice, tools

**Client Flow**
1. UI requests session token
2. Creates `RTCPeerConnection`
3. Sends/receives audio
4. Data channel carries events + transcripts
5. Store transcript + summary in `calls`

**Data Flow**
- Create call row when session starts
- Update call with transcript + summary on end
- Store tool events in `call_events`

**Environment**
- `OPENAI_API_KEY`

---

## 3) Knowledge Base: OpenAI Vector Store + R2
**Goal:** Upload files to R2, index in OpenAI Vector Store, query from UI.

**Pipeline**
1. Upload file to R2
2. Upload file to OpenAI Files API
3. Add file to Vector Store (per team)
4. Persist metadata in `knowledge_files`

**Key Tables**
- `teams.vector_store_id`
- `knowledge_sources`
- `knowledge_files`

**API Surface**
- `uploadKnowledgeFile(sourceId, file)`
- `checkKnowledgeFileStatus(fileId)`
- `queryKnowledge(query, sourceId?)`

**Environment**
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `OPENAI_API_KEY`

---

## 4) Scheduling: Cal.com API
**Goal:** Calendar UI backed by Cal.com bookings.

**Integration Strategy**
- Store Cal.com API key in `team_integrations`
- Map Cal.com booking → `appointments` row

**API Surface**
- `listAppointments()` → fetch from DB
- `createAppointment()` → create Cal.com booking + store locally
- `updateAppointment()` → update Cal.com booking + update local row
- `cancelAppointment()` → cancel Cal.com booking

**Environment**
- `CALCOM_API_KEY`

---

## 5) Resend (Auth/System Email Only)
**Goal:** only system/auth emails (password reset, invites later).

**Integration**
- Simple singleton client in `src/lib/resend.ts`
- Used only inside Better Auth email flows

**Environment**
- `RESEND_API_KEY`

---

## 6) Background Jobs (Deferred)
We avoid a full job system in Phase 1. If needed later:
- Add `jobs` table
- Use Vercel Cron + queue table
- Start with manual “check status” for knowledge indexing

