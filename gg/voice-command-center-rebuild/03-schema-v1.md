# V1 Schema Proposal (Team‑Scoped, Voice‑First)

This schema is designed to keep the **UI unchanged** while enabling a clean backend rewrite. All domain data is **team‑scoped** and user attribution is preserved.

> Conventions:
> - `id` = serial or cuid (choose one)
> - `team_id` always required
> - `created_by_user_id` + `updated_by_user_id` for attribution

---

## Auth + Tenancy (Better Auth)
### `users`
- `id` (string, Better Auth ID)
- `name` (string, nullable)
- `email` (string, unique)
- `email_verified` (boolean)
- `image` (string, nullable)
- `default_team_id` (fk → teams.id)
- `created_at`, `updated_at`

### `teams`
- `id`
- `name`
- `slug` (unique)
- `created_by_user_id`
- `created_at`, `updated_at`

### `team_members`
- `id`
- `team_id` (fk)
- `user_id` (fk)
- `role` (string: "owner" | "member", extend later)
- `created_at`

### `sessions`, `accounts`, `verifications`
- Better Auth standard tables (Drizzle adapter)

---

## Leads
### `leads`
- `id`
- `team_id`
- `name`
- `email` (nullable)
- `phone` (nullable)
- `status` (enum: new/contacted/qualified/converted/lost)
- `score` (int)
- `source` (string, nullable)
- `notes` (text, nullable)
- `created_by_user_id`
- `assigned_user_id` (nullable)
- `created_at`, `updated_at`

### `lead_notes`
- `id`
- `team_id`
- `lead_id`
- `body` (text)
- `created_by_user_id`
- `created_at`

---

## Appointments (Cal.com)
### `appointments`
- `id`
- `team_id`
- `lead_id` (nullable)
- `title`
- `description` (nullable)
- `start_time`, `end_time`
- `location` (nullable)
- `status` (scheduled/cancelled/completed)
- `cal_event_id` (nullable)
- `cal_booking_id` (nullable)
- `created_by_user_id`
- `created_at`, `updated_at`

### `team_integrations`
- `id`
- `team_id`
- `provider` ("calcom")
- `api_key` (encrypted)
- `settings` (json)
- `created_at`, `updated_at`

---

## Voice Agents
### `agents`
- `id`
- `team_id`
- `name`
- `description` (nullable)
- `status` (active/inactive)
- `language` (nullable)
- `system_prompt` (text)
- `first_message` (nullable)
- `model` (string)
- `temperature` (numeric)
- `voice_provider` (string)
- `voice_id` (string)
- `voice_model` (nullable)
- `tools_config` (json)
- `metadata` (json)
- `created_by_user_id`
- `created_at`, `updated_at`

### `agent_roles`
- `id`
- `name` (e.g., Sales, Support, Appointment Setter)
- `description`
- `default_prompt` (text)

### `voice_presets`
- `id`
- `name`
- `language`
- `provider`
- `voice_id`
- `model` (nullable)
- `sample_url` (nullable)
- `is_default` (boolean)

### `agent_knowledge`
- `id`
- `agent_id`
- `knowledge_source_id`

---

## Calls
### `calls`
- `id`
- `team_id`
- `lead_id` (nullable)
- `agent_id` (nullable)
- `campaign_id` (nullable)
- `direction` (incoming/outgoing)
- `status` (answered/voicemail/missed/failed/etc)
- `start_time`, `end_time`, `duration`
- `session_id` (OpenAI realtime session id)
- `summary` (text, nullable)
- `transcript` (text, nullable)
- `sentiment` (nullable)
- `recording_url` (nullable)
- `cost` (string, nullable)
- `metadata` (json)
- `created_at`, `updated_at`

### `call_events`
- `id`
- `call_id`
- `type` ("transcript"|"tool_call"|"tool_result"|"status")
- `payload` (json)
- `created_at`

---

## Campaigns
### `campaigns`
- `id`
- `team_id`
- `name`
- `description` (nullable)
- `status` (draft/scheduled/running/paused/completed/cancelled)
- `start_date`, `end_date`
- `agent_id` (nullable)
- `settings` (json) // includes call timing, retries, voice config
- `created_by_user_id`
- `created_at`, `updated_at`

### `campaign_leads`
- `id`
- `campaign_id`
- `lead_id`
- `status` (pending/attempted/completed/failed)
- `priority` (int)
- `assigned_at`
- `last_attempt_at` (nullable)
- `next_attempt_at` (nullable)
- `attempt_count`
- `max_attempts`
- `notes` (nullable)
- `completed_at` (nullable)

### `campaign_runs`
- `id`
- `campaign_id`
- `status` (running/completed/failed)
- `started_at`, `ended_at`
- `stats` (json)

---

## Call Queue
### `call_queue`
- `id`
- `team_id`
- `campaign_id` (nullable)
- `lead_id` (nullable)
- `agent_id` (nullable)
- `status` (pending/queued/calling/completed/failed/cancelled)
- `priority` (int)
- `scheduled_time` (nullable)
- `instructions` (nullable)
- `retry_count` (int)
- `max_retries` (int)
- `last_error` (nullable)
- `call_result` (json)
- `created_at`, `updated_at`

---

## Knowledge Base (OpenAI Vector Store + R2)
### `knowledge_sources`
- `id`
- `team_id`
- `name`
- `type` (enum)
- `uri` (string)
- `status` (active/inactive)
- `last_indexed_at` (nullable)
- `created_by_user_id`
- `created_at`, `updated_at`

### `knowledge_files`
- `id`
- `team_id`
- `source_id`
- `filename`
- `content_type`
- `size`
- `r2_key`
- `openai_file_id`
- `vector_store_id`
- `status` (processing/ready/failed)
- `extracted_text_preview` (nullable)
- `last_error` (nullable)
- `created_at`, `updated_at`

### Optional: `knowledge_chunks`
If we want to display chunk‑level details in the UI without calling OpenAI each time.

---

## Audit Logs
### `audit_logs`
- `id`
- `team_id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata` (json)
- `created_at`

---

## Indexing Suggestions
- `leads(team_id, status)`
- `calls(team_id, start_time)`
- `campaigns(team_id, status)`
- `campaign_leads(campaign_id, status)`
- `knowledge_files(team_id, status)`
- `appointments(team_id, start_time)`

