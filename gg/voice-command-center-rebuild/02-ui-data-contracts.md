# UI Data Contracts (What the UI Expects)

This document captures the **current UI data shapes** that the new backend must supply. These should be treated as contracts during the rewrite to keep the UI unchanged.

---

## Calls Page
### `CallItem` (from `src/components/calls-table.tsx`)
```ts
{
  id: string; // prefixed ID e.g. "call_123" or "session_456"
  leadId: number | null;
  leadName: string | null;
  type: "incoming" | "outgoing";
  duration: number | null; // seconds
  startTime: string; // ISO
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  status: string | null; // answered/voicemail/etc
  createdAt: string;
  updatedAt: string;
  source: string; // e.g., "calls", "realtime"
  campaignId: number | null;
  agentId: number | null;
  agentName: string | null;
  sessionId: string | null; // realtime session id
  cost: string | null;
  sentiment: string | null;
}
```

---

## Call Queue
### `CallQueueEntry` (from `src/components/call-queue-page-client.tsx`)
```ts
{
  id: number;
  status: "pending"|"queued"|"calling"|"completed"|"failed"|"cancelled"|null;
  priority: number | null; // 0-3
  scheduledTime: Date | null;
  instructions: string | null;
  phoneNumber: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  retryCount: number | null;
  maxRetries: number | null;
  lastError: string | null;
  callResult: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  lead: { id: number; name: string; phone: string | null; status: string | null; } | null;
  voiceAgent: { id: number; name: string; } | null;
}
```

---

## Campaigns List
### `EnhancedCampaignItem` (from `src/components/enhanced-campaigns-table.tsx`)
```ts
{
  id: number;
  name: string;
  status: string | null; // draft, scheduled, running, paused, completed, cancelled
  leadsCount: number;
  leadsConverted: number;
  leadsContacted?: number;
  callsCompleted?: number;
  conversionRate?: number; // 0-100
  avgCallDuration?: number; // seconds
  updatedAt: string;
  createdAt?: string;
  voiceAgentName?: string | null;
}
```

---

## Campaign Controls
### `CampaignInfo` (from `src/components/campaign-controls.tsx`)
```ts
{
  id: number;
  name: string;
  status: "draft"|"scheduled"|"running"|"paused"|"completed"|"cancelled"|"archived"|null;
  startDate: Date | null;
  endDate: Date | null;
}
```

---

## Campaign Leads Dashboard
### `CampaignLead`
```ts
{
  id: number;
  campaignId: number;
  leadId: number;
  status: "pending"|"attempted"|"completed"|"failed";
  priority: number;
  assignedAt: Date;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  notes: string | null;
  completedAt: Date | null;
  lead: {
    id: number;
    name: string;
    email: string | null; // keep optional for future
    phone: string | null;
    status: "new"|"contacted"|"qualified"|"converted"|"lost";
    score: number | null;
  };
}
```

---

## Knowledge Base
### `KnowledgeBaseSource`
```ts
{
  id: number;
  name: string;
  type: "website_url"|"pdf_upload"|"gdoc"|"txt_upload"|"image_upload"|"docx_upload";
  uri: string;
  lastIndexedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
```

### `KnowledgeBaseDocument` (currently chunk-based)
```ts
{
  id: number;
  sourceId: number | null;
  contentChunk: string; // can be a file preview or extracted snippet
  textEmbeddingModel: string; // model name
  metadata: Record<string, unknown>;
  createdAt: string | Date;
}
```
**Note:** With OpenAI Vector Store, we won’t store embeddings locally. We can map file‑level metadata into this shape to keep the UI unchanged.

---

## Calendar / Appointments
### `IEvent` (from `src/lib/calendar/interfaces.ts`)
```ts
{
  id: number;
  startDate: string; // ISO
  endDate: string; // ISO
  title: string;
  color: "blue"|"green"|"red"|"purple"|"orange";
  description?: string;
  location?: string;
  user: { id: string; name: string; picturePath: string | null; };
}
```

---

## Voice Agents
### `VoiceAgentWithPhoneNumber` (current UI uses these fields)
```ts
{
  id: number;
  name: string;
  description: string | null;
  prompt: string;
  voice: { provider?: string; voice_id?: string; model?: string; };
  language: string | null;
  status: "active"|"inactive"|"training"|"error"|null;
  firstMessage: string | null;
  configuration: Record<string, unknown> | null;
  phoneNumber: { id: number; number: string; friendlyName: string; type: string; status: string | null; } | null;
}
```
**Note:** Phone number assignment will be removed in Phase 1. UI may need a small tweak to avoid requiring phone numbers.

---

## Dashboard Analytics
From `src/actions/dashboard-analytics.ts`:
```ts
LeadFunnelData      = { name: string; value: number }
LeadAcquisitionData = { date: string; newLeads: number; qualifiedLeads: number }
CallActivityData    = { date: string; inbound: number; outbound: number }
LeadSourceData      = { name: string; value: number }
AgentPerformanceData= { name: string; calls: number; appointments: number; conversions: number }
```

