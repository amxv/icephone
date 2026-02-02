# IcePhone Master Features Checklist 2.0

Status: 🟠 Proposal – ready for prioritisation

---

## Overview
A forward-looking roadmap that fuses seven user-selected upgrades with ten new integrative features.  Together they connect calls, campaigns, knowledge, analytics and mobile usage into a single, intelligent growth engine.

---

### 1-agent-skill-rating-and-auto-upskilling
Tracks every agent's win-rate, sentiment score and objection-handling to generate a "skill GPA".  Nightly cron jobs fine-tune under-performers on high-converting transcripts, then hot-swap the new model through the existing Vapi assistant pipeline.  Leaderboards and a "retrain now" button live inside **/voice-agents**.  Data flows to the Analytics page for ROI correlation.

### 2-smart-lead-segmentation-and-persona-matching
A vector-clustering job groups leads by intent, budget and engagement history drawn from calls, emails and site chat.  Each segment is auto-paired with the persona & script most likely to convert, updating campaign queues in real time.  Segment explanations appear in the **Leads** page sidebar, letting owners override or lock mappings.

### 3-inbound-call-intent-router
During the first 5 seconds of an inbound call the STT service streams text to a small intent model.  The router looks up routing rules in **db.intentRoutes** and transfers the session to the best persona or human via Vapi's switchEndpoint API.  Performance feedback loops back into routing weights, visible on the **Calls** dashboard.

### 4-gamified-sales-team-dashboard
Adds a new **/analytics/gamification** sub-page showing points, badges and streaks for human reps who review AI drafts or close deals.  Events are published by existing server actions to a `sales_events` table, then rendered via real-time Hono APIs & shadcn charts.  Weekly Slack leaderboard export incentivises healthy competition.

### 5-micro-copy-and-script-marketplace
Creates a community marketplace under **/scripts** where users upload proven cold-call or email templates.  Each listing stores metadata (industry, tone, language) and revenue attribution tags.  One-click import injects the script into the Campaign wizard and voice-agent prompt chain.  Stripe Connect handles payouts to creators.

### 6-react-native-field-companion-app
A React Native repo (monorepo package) shares TypeScript types with the Next.js codebase.  Offline-first lead lists sync via Supabase Realtime, allow voice memo uploads and push notifications for hot inbound calls.  Fastlane automates iOS/Android builds; deep links open corresponding web pages for full context.

### 7-self-service-onboarding-with-gpt-copilot
A conversational wizard at **/onboarding** collects business info, imports docs, suggests agent personas and provisions first phone number using the existing admin actions.  GPT streams real-time previews (email draft, sample call script) using Vercel AI SDK functions.  Progress is tracked in `onboarding_steps` to send reminder nudges until complete.

---

## New Integrative Features

### 8-unified-lead-timeline-and-search
Merges calls, emails, texts, appointments and chat into a single chronological timeline component on each **leads/[id]** page.  Powered by a generic `communication_logs` table and Elastic hybrid search, it offers global fuzzy search and filters, replacing scattered channel pages with one zoomable view.

### 9-cross-channel-automation-workflows
Drag-and-drop builder under **/workflows** lets owners trigger actions (call, email, SMS, task) based on events (tag added, stage changed).  Uses a durable-object worker to execute jobs and pause between steps; integrates with Campaigns, Pipelines and Calendar so journeys stay in sync.

### 10-knowledge-driven-dynamic-scripting
When a lead enters a call or chat, the agent runtime queries the business knowledge base plus recent CRM notes to auto-assemble a personalised script or email draft.  Scripts are stored in `dynamic_scripts` and surfaced in real time to the agent or human rep for approval.

### 11-real-time-performance-co-pilot
A whisper-channel overlay (WebRTC data track) feeds live objection responses, pricing data and KPI reminders to human reps during calls.  Latency <300 ms is achieved via edge-deployed inference functions.  Post-call feedback loop grades adherence and feeds the Skill Rating engine.

### 12-revenue-attribution-and-ltv-analytics
Extends existing Analytics to attribute closed revenue back to channel, script and persona.  Pulls transaction data from Stripe/Shopify connectors, joins with communication logs, and projects Lead Lifetime Value.  Visual dashboards help owners double-down on what pays.

### 13-smart-notification-hub
Centralised in-app, email and mobile push notifications managed via a `notifications` table and worker.  AI prioritises alerts (hot lead answered, agent under-performs) and batches low-priority items.  Users can mute or snooze channels per feature.

### 14-third-party-integration-hub
Zapier-style interface for connecting CRMs, ad platforms and ticketing tools.  Uses OAuth + Hono proxy routes; events emitted via webhooks conform to our internal event schema so existing workflows and analytics instantly gain external context.

### 15-human-handoff-and-barge-in-controls
Supervisors can listen, whisper or take over live calls from the Calls page.  A `supervisor_sessions` table stores permissions and events; UI re-uses React Native audio widgets for web.  Sessions are recorded for quality audits and tie into the Compliance Vault.

### 16-adaptive-knowledge-loop
Nightly cron parses new transcripts, emails and chat logs, summarises key facts with GPT and proposes additions to the Knowledge Base.  Owners approve with one click, keeping RAG answers ever-fresh without manual uploads.  Accepted items trigger re-embedding via the existing ingestion worker.

### 17-ai-super-assistant-action-engine
A ChatGPT-style AI living in **/assistant** can query the database, call server actions and execute workflow steps under scoped Clerk permissions.  Tool calls are logged and reversible.  Users can ask "Schedule a follow-up call with all warm leads next week" and watch the assistant create calendar events, update pipeline stages and queue calls—closing the loop on every feature above.