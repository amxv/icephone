# Feature Contract Map (Voice‑First)

This map defines the contract between UI pages and the new backend. Each feature lists required data, server actions, tables, and external services.

## Legend
- **Actions** = new server actions (must be rewritten)
- **Tables** = v1 schema tables (team‑scoped)
- **Integrations** = external APIs/services

---

## Dashboard
**UI Needs**
- Lead funnel, lead acquisition trends
- Call activity trends
- Agent performance summary
- Upcoming appointments

**Actions**
- `getDashboardSummary(timeRange)`
- `getLeadFunnel(timeRange)`
- `getLeadAcquisition(timeRange)`
- `getCallActivity(timeRange)`
- `getAgentPerformance(timeRange)`

**Tables**
- `leads`, `calls`, `agents`, `appointments`, `audit_logs`

**Integrations**
- Cal.com (for upcoming appointments)

---

## Leads
**UI Needs**
- List + filters (name, status, score, source)
- Lead detail (notes, calls, appointments)

**Actions**
- `listLeads(filters)`
- `getLead(leadId)`
- `createLead(data)`
- `updateLead(leadId, data)`
- `updateLeadStatus(leadId, status)`
- `createLeadNote(leadId, note)`

**Tables**
- `leads`, `lead_notes`, `calls`, `appointments`

---

## Pipeline (Kanban)
**UI Needs**
- Drag/drop lead status updates

**Actions**
- `listLeads(filters)`
- `updateLeadStatus(leadId, status)`

**Tables**
- `leads`

---

## Appointments (Calendar)
**UI Needs**
- Calendar events (create/edit/delete)
- Must match `IEvent` shape

**Actions**
- `listAppointments()`
- `createAppointment(data)`
- `updateAppointment(id, data)`
- `cancelAppointment(id)`

**Tables**
- `appointments`

**Integrations**
- Cal.com (create/update/cancel bookings)

---

## Calls
**UI Needs**
- Calls list + filters
- Call details panel (summary, transcript, recording, sentiment)

**Actions**
- `listCalls(filters)`
- `getCall(id)`
- `attachCallToLead(callId, leadId)`
- `updateCallOutcome(callId, data)`

**Tables**
- `calls`, `call_events`

**Integrations**
- OpenAI Realtime (web calls)

---

## Call Queue
**UI Needs**
- Queue list
- Cancel queued call

**Actions**
- `listCallQueue()`
- `cancelQueuedCall(queueId)`

**Tables**
- `call_queue`

---

## Voice Agents
**UI Needs**
- Agent list + status
- Create/edit agent
- Voice presets + roles
- Test web call

**Actions**
- `listAgents()`
- `createAgent(data)`
- `updateAgent(id, data)`
- `archiveAgent(id)`
- `getAgentRoles()`
- `getVoicePresets(language)`
- `createRealtimeSession(agentId)`

**Tables**
- `agents`, `agent_roles`, `voice_presets`, `agent_knowledge`

**Integrations**
- OpenAI Realtime (session creation)

---

## Campaigns
**UI Needs**
- Campaign list + metrics
- Campaign detail: stats, leads, voice config, controls
- Start/pause/resume/stop

**Actions**
- `listCampaigns(filters)`
- `getCampaign(id)`
- `createCampaign(data)`
- `updateCampaign(id, data)`
- `addLeadsToCampaign(id, leadIds)`
- `removeLeadFromCampaign(id, leadId)`
- `startCampaign(id)`
- `pauseCampaign(id)`
- `resumeCampaign(id)`
- `stopCampaign(id)`
- `getCampaignExecutionStatus(id)`

**Tables**
- `campaigns`, `campaign_leads`, `campaign_runs`, `call_queue`

**Integrations**
- None in Phase 1 (scheduler deferred)

---

## Knowledge
**UI Needs**
- Sources list + stats
- Upload source
- Document list for a source
- Search across sources

**Actions**
- `listKnowledgeSources()`
- `createKnowledgeSource(data)`
- `deleteKnowledgeSource(id)`
- `uploadKnowledgeFile(sourceId, file)`
- `listKnowledgeFiles(sourceId)`
- `queryKnowledge(query, sourceId?)`
- `getKnowledgeStats()`
- `checkKnowledgeFileStatus(fileId)`

**Tables**
- `knowledge_sources`, `knowledge_files`, `knowledge_chunks` (optional), `teams.vector_store_id`

**Integrations**
- OpenAI Vector Store + Files API
- Cloudflare R2

---

## Analytics
**UI Needs**
- Call analytics, trends, cost, agent performance

**Actions**
- `getCallAnalytics(timeRange)`
- `getAgentPerformanceMetrics(agentId?)`
- `getPerformanceTrends(timeRange)`
- `getCostAnalytics(timeRange)`

**Tables**
- `calls`, `campaign_runs`, `agents`

---

## Settings
**UI Needs**
- Team info, user profile

**Actions**
- `getSettings()`
- `updateSettings(data)`

**Tables**
- `teams`, `users`, `team_members`

---

## Admin
**UI Needs**
- Admin stats, audit logs

**Actions**
- `getAdminStats()`
- `getAuditLogs(filters)`

**Tables**
- `audit_logs`, `users`, `teams`, `calls`, `campaigns`, `knowledge_files`

