# IcePhone: Comprehensive Feature & Capability Overview

## What Is IcePhone?

IcePhone is an AI-powered voice agent command center that transforms how businesses handle phone-based communication at scale. It is a full-featured platform for deploying, managing, and analyzing AI voice agents that can autonomously make and receive phone calls -- handling everything from cold outreach and lead qualification to appointment scheduling, customer support, loan repayment collections, and more.

The platform combines intelligent AI voice agents with a built-in CRM, campaign automation engine, knowledge base, analytics dashboard, and deep integrations with industry-standard telephony and CRM providers. It is designed for businesses that need to automate high-volume phone communication without sacrificing personalization or conversational quality.

---

## Core Platform Capabilities

### 1. AI Voice Agents

At the heart of IcePhone are fully customizable AI voice agents that conduct natural, human-like phone conversations. Each agent is powered by OpenAI's real-time voice models and can be configured to handle specific business scenarios.

**Agent Creation and Management**
- Create multiple voice agents, each with its own name, personality, and purpose
- Assign agents to specific business roles using pre-built role templates or fully custom configurations
- Activate, deactivate, or put agents into training mode
- Each agent maintains its own conversation history, performance metrics, and configuration

**Pre-Built Agent Role Templates**
IcePhone ships with professionally designed role templates that provide optimized system prompts, conversation styles, and default behaviors for common use cases:

- **Support Command Center** -- Resolves customer issues, answers policy questions, and guides users with empathetic, solution-focused communication
- **Outbound Cold Calling** -- Runs discovery-first outreach calls to qualify leads and book next steps, with confident and business-focused delivery
- **Loan Repayment Collections** -- Handles repayment follow-ups with compliance-minded language, structured outcomes, and labels like "intent-to-pay," "promise-to-pay," or "did-not-pick-up"
- **Appointment Setting** -- Books demos, consultations, and meetings efficiently using calendar-aware scheduling
- **Customer Onboarding** -- Guides new customers through setup, activation, and first-value milestones with patient, step-by-step instructions
- **Renewal and Retention** -- Re-engages customers approaching renewal with value reminders, outcome reviews, and objection handling

Each template includes a default personality, script direction, system prompt, and first message that can be further customized.

**Voice Customization**
- Choose from a curated library of voice presets with different genders, personalities, and speaking styles
- Voice presets support 10 languages: English, Spanish, French, German, Italian, Portuguese, Chinese, Hindi, Arabic, and Japanese
- Each preset includes audio samples for preview before selection
- Voices are categorized by gender (male, female, neutral) and language
- Fine-tune voice characteristics for each agent

**Conversation Intelligence**
- Real-time speech-to-text transcription during calls
- AI-generated call summaries after each conversation
- Sentiment analysis (positive, negative, neutral) for every call
- Full transcript storage and retrieval
- Tool call tracking -- see exactly what actions the AI took during each call

**Agent Tools and Function Calling**
Voice agents can perform real-time actions during conversations through configurable function calls:

- **Appointment Scheduling** -- The agent can schedule appointments directly on Cal.com during a call, providing available time slots and confirming bookings in real time
- **Knowledge Base Search** -- The agent can search the company's knowledge base mid-conversation to ground answers in factual information, citing specific sources with reference labels
- **Custom Webhook Functions** -- Define custom functions that agents can trigger during calls, each with configurable parameters, webhook URLs, HTTP methods, headers, timeout settings, and response handling modes
- Functions can execute during the call or after call completion
- Each function supports detailed parameter definitions with types and required/optional flags

**Advanced Agent Configuration**
- **Conversation Flow Controls** -- Configure whether the user or agent speaks first, interruption handling (allow/deny, keep interrupted message), response delay timing, and auto-fill responses for conversation gaps
- **Call Termination Rules** -- Set conditions for when and how the agent should end a call, with customizable termination instructions and messages
- **Voicemail Handling** -- Configure behavior when voicemail is detected: hang up, leave a message, or continue on voice activity detection
- **Inactivity Handling** -- Define idle timeout durations and messages for when callers go silent
- **Call Transfer** -- Configure phone numbers and instructions for transferring calls to human agents, with support for multiple transfer destinations
- **DTMF Dial Support** -- Enable touch-tone dialing capabilities during calls
- **Session Timeouts** -- Set maximum call duration and maximum idle time with customizable timeout messages
- **Privacy Controls** -- Opt-out of data collection, do-not-call detection
- **Custom Vocabulary** -- Define domain-specific keywords for improved speech recognition
- **LLM Configuration** -- Choose the underlying language model, adjust temperature for creativity vs. consistency, and configure conversation history limits
- **Speech-to-Text Configuration** -- Configure transcription provider (Deepgram), enable multilingual mode, and select specific transcription models
- **Call Recording** -- Toggle call recording per agent
- **Timezone Awareness** -- Set the agent's operating timezone for time-sensitive conversations
- **Business Hours Configuration** -- Define business hours with timezone support and after-hours messaging

**Voice Agent Command Center**
A unified interface for configuring and operating voice agents with a template-driven workflow. Select a template (Support, Cold Calling, Collections, Appointment Setting, Onboarding, or Retention), customize the personality, script direction, and first message, then deploy.

**Test Calls**
Test any voice agent directly from the browser using real-time web calls. The test call interface shows connection status, real-time transcription, mute controls, and live status indicators for listening and speaking states -- all without needing to connect a phone line.

---

### 2. Campaign Automation Engine

IcePhone's campaign system enables automated, large-scale outbound calling operations with sophisticated controls and monitoring.

**Campaign Lifecycle Management**
- Create campaigns with names, descriptions, start dates, and end dates
- Full lifecycle status tracking: Draft, Scheduled, Running, Paused, Completed, Cancelled, and Archived
- Start, pause, resume, and stop campaigns with one-click controls
- Schedule campaigns to begin at a specific future date and time

**Lead Assignment and Management**
- Add leads to campaigns individually, via CSV bulk upload, or by importing directly from connected CRMs
- Each campaign-lead assignment tracks: status (pending, attempted, completed, failed, excluded), priority level, attempt count, maximum attempts allowed, and timestamps for last and next attempts
- Set per-lead notes and campaign-specific context
- Exclude leads with reasons, or re-include them
- Campaign-level metadata for custom fields and success metrics

**Calling Automation Settings**
- **Business Hours Enforcement** -- Define per-day calling schedules with timezone awareness so calls only go out during appropriate hours
- **Max Calls Per Day** -- Cap the number of calls made each day
- **Call Interval** -- Set minimum minutes between calls
- **Retry Logic** -- Configure maximum retry attempts, intervals between retries (in hours), and which call outcomes trigger retries
- **Success Criteria** -- Define which lead statuses count as "converted" and which count as "qualified"
- **Campaign Goals** -- Set targets for total leads reached, conversions achieved, and calls per day
- **Automation Rules** -- Enable auto-progression of lead statuses, auto-scheduling of follow-ups, and auto-updating of lead scores based on call outcomes

**Campaign Voice Configuration**
Each campaign can override or extend its assigned voice agent's behavior with campaign-specific settings:

- **Campaign-Specific Prompts** -- Add context about the campaign's purpose that the agent uses during calls
- **Lead Personalization Rules** -- Toggle whether to include the lead's name, score, previous interaction history, source, and notes in the agent's context
- **Call Flow Customization** -- Define opening scripts, objection handling strategies, closing scripts, appointment scheduling behavior, and follow-up instructions
- **Context Variables** -- Set the campaign goal, target audience description, value proposition, urgency level, and call-to-action
- **Behavior Tuning** -- Adjust aggressiveness, professionalism, persistence, and empathy levels on a 1-10 scale
- **Outbound Phone Number Selection** -- Choose which team phone number to use as the caller ID

**Campaign Queue Processing**
- Automated queue management with priority-based ordering
- Queue entries track: scheduled time, start time, completion time, retry count, call results (call ID, duration, outcome, next action, reschedule details), and associated metadata
- Automatic rescheduling on busy, no-answer, or voicemail outcomes
- Cron-based queue processing for continuous campaign execution

**Campaign Analytics Dashboard**
Each campaign has a dedicated analytics view with:

- Campaign health monitoring
- Performance alerts and anomaly detection
- Call volume and outcome visualization
- Report generation and export capabilities
- Success rate tracking against defined goals

**Campaign Statistics Dashboard**
Overview metrics for active campaigns showing lead progress, call completion rates, and outcome distributions.

---

### 3. Built-In CRM (Lead Management)

IcePhone includes a full-featured mini CRM for managing contacts, deals, and communication history.

**Lead Management**
- Create, edit, and delete leads with comprehensive contact information (name, email, phone)
- Lead scoring on a 0-100 scale with visual color-coded badges
- Lead status tracking through a defined lifecycle: New, Contacted, Qualified, Converted, Lost
- Deal stage tracking: Prospect, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- Deal value tracking with expected close dates
- Lead source tracking to understand where leads originate
- Lead assignment to specific team members
- Rich notes system with timestamped entries
- Searchable and filterable lead list

**Lead Detail Page**
A comprehensive, dedicated view for each lead showing:

- Full contact profile with avatar, status badges, score badges, and source tags
- Editable notes section
- Communication timeline showing all interactions in chronological order
- Appointment history (upcoming and past) with status indicators
- Call history with duration, type (inbound/outbound), and AI-generated summaries
- Text message history
- Follow-up suggestions based on lead status, score, and last activity
- Quick action buttons for calling, texting, scheduling, and editing
- Keyboard shortcuts for rapid communication actions
- Floating action button for mobile-friendly quick access

**Pipeline View (Kanban Board)**
A visual, drag-and-drop pipeline board for managing leads through deal stages:

- Columns for Contacted, Qualified, Converted, and Lost stages
- Drag leads between stages to update their status instantly
- Each lead card shows key information at a glance
- Keyboard-accessible for full navigation without a mouse
- Responsive design that works on desktop and mobile

**Communication Hub**
From any lead's detail page, users can:

- **Schedule AI-Powered Calls** -- Select a voice agent, set priority, add special instructions, choose a scheduled time, and pick the outbound phone number
- **Send Text Messages** -- Compose and send text messages directly to leads
- **Book Appointments** -- Schedule appointments with Cal.com integration, including title, description, time, and location
- **Edit Lead Information** -- Update any lead field inline

**Bulk Operations**
- CSV import with automatic field mapping for bulk lead creation
- CRM import from HubSpot, Salesforce, GoHighLevel, or Pipedrive with configurable query filters and limits
- Auto-assign imported leads to campaigns
- Deduplication during import to prevent duplicate records

---

### 4. Phone Number Management

Manage the phone numbers your AI agents use for inbound and outbound calls.

- Register and manage phone numbers from Twilio, Telnyx, or Vonage
- Track phone number status: Provisioning, Active, Inactive, Released
- Label phone numbers for easy identification
- Set a default outbound number for the team
- Assign specific phone numbers to specific voice agents
- Track capabilities per number: voice, SMS, MMS
- Store provider-specific metadata per number

---

### 5. Call Management and History

A centralized view of all call activity across the platform.

**Call Log**
- View all calls with filtering by type (incoming/outgoing), status, date range, agent, and campaign
- Each call record includes: lead name, direction, duration, start/end time, status, sentiment, cost, and associated agent
- Sortable and paginated call tables with configurable density and rows per page

**Call Detail View**
- Full transcript display for any call
- AI-generated call summary
- Call recording playback (when recording is enabled)
- Associated lead and campaign information
- Sentiment analysis results
- Cost tracking per call
- Call metadata and technical details

**Call Queue**
- Manual call queue for scheduling individual calls to specific leads
- Queue entries include: lead, voice agent assignment, priority, scheduled time, special instructions, phone number override, retry settings, and call result details
- Queue status tracking: Pending, Queued, Calling, Completed, Failed, Cancelled
- Automatic retry with configurable intervals and maximum attempts
- Call queue processing API with cron support for automated execution

**Telephony Call Tracking**
- Detailed provider-level call metadata for every PSTN call
- Status tracking through the full call lifecycle: Queued, Ringing, In Progress, Completed, Failed, Busy, No Answer, Canceled
- Provider-specific call IDs and session IDs for debugging
- Webhook event ingestion with deduplication and signature validation
- Recording lifecycle management: Processing, Ready, Failed

---

### 6. Appointment and Calendar Management

A full interactive calendar system integrated with Cal.com for scheduling and managing appointments.

**Appointment Management**
- Create, update, and cancel appointments linked to specific leads
- Appointments include: title, description, start/end time, location, and status (Scheduled, Cancelled, Completed)
- Interactive calendar view with multiple display modes
- Color-coded events by type and status
- Automatic Cal.com booking creation, rescheduling, and cancellation when integration is connected
- Attendee management with name, email, timezone, and phone number
- Appointment completion tracking

**Cal.com Integration**
- Connect your Cal.com account with an API key
- Configure event type ID, event type slug, team slug, username, organization slug, and default timezone
- Bookings created through IcePhone automatically appear in Cal.com and vice versa
- Voice agents can schedule appointments in real time during phone conversations

---

### 7. Knowledge Base

A sophisticated document management and retrieval system that gives your AI voice agents access to company-specific information during calls.

**Document Sources**
Upload and manage knowledge from multiple source types:

- **Website URLs** -- Index content from web pages
- **PDF Uploads** -- Extract and index content from PDF documents
- **Google Docs** -- Connect and index Google Docs
- **Text File Uploads** -- Index plain text files
- **Image Uploads** -- Process and index visual content
- **DOCX Uploads** -- Extract and index Word documents

**Advanced RAG (Retrieval-Augmented Generation) Pipeline**
The knowledge base uses a state-of-the-art multi-strategy retrieval system:

- **Text Embeddings** -- Voyage 3.5 embeddings for high-quality semantic search
- **Multimodal Embeddings** -- Voyage Multimodal 3 embeddings for documents containing images, charts, tables, and diagrams
- **HyDE (Hypothetical Document Embeddings)** -- Generates hypothetical answers to improve retrieval quality for complex queries
- **Adaptive Chunking** -- Intelligent document splitting that preserves context across chunks
- **Layout-Aware Processing** -- Respects document structure including headers, tables, and visual elements
- **Visual Element Extraction** -- Detects and describes images, tables, charts, and diagrams within documents
- **Bounding Box Tracking** -- Tracks the physical location of content within pages
- **Confidence Scoring** -- Each retrieved chunk includes a relevance confidence score
- **Re-ranking** -- Results are re-ranked for optimal relevance
- **Source Citations** -- Retrieved information is labeled with source IDs for transparent citation during calls

**Vector Store Integration**
- OpenAI Vector Store integration for file storage and retrieval
- Cloudflare R2 storage for document file management
- Per-team vector stores for data isolation
- File status tracking: Processing, Ready, Failed
- Extracted text preview for quick document review

**Agent-Knowledge Linking**
- Assign specific knowledge sources to specific voice agents
- Agents can only search within their assigned knowledge sources during calls
- Multiple agents can share the same knowledge sources
- Knowledge source IDs are included in agent instructions for scoped retrieval

---

### 8. Analytics and Reporting

Comprehensive analytics dashboards that provide deep visibility into call performance, agent effectiveness, and business outcomes.

**Main Analytics Dashboard**
- **Time Range Selection** -- View analytics for 7-day, 30-day, or 90-day windows
- **Lead Funnel Visualization** -- See how leads progress through New, Contacted, Qualified, Converted, and Lost stages
- **Lead Acquisition Trends** -- Track new and qualified lead generation over time
- **Call Activity Charts** -- Visualize inbound vs. outbound call volume by day
- **Lead Source Distribution** -- Understand which sources generate the most leads
- **Agent Performance Comparison** -- Compare agents by calls made, appointments booked, and conversions generated

**Call Analytics Dashboard**
Detailed call-level analytics including:

- **Volume Metrics** -- Total calls, total duration, average duration, pickup rate
- **Cost Analysis** -- Total cost, average cost per call, cost per minute, cost share by agent, cost breakdown by direction (inbound/outbound)
- **Success Metrics** -- Success rate, outcome breakdown (answered, voicemail, missed, busy, failed)
- **Sentiment Analysis** -- Positive, negative, and neutral sentiment distribution across all calls
- **Collection Signals** -- Specialized metrics for collections use cases: intent-to-pay rate, promise-to-pay rate, did-not-pick-up rate, and connected rate
- **Recording Coverage** -- Track what percentage of calls have recordings, broken down by provider
- **Top Performing Agents** -- Ranked by call count, average duration, and success rate
- **Daily Call Volume Trends** -- Calls, duration, and cost by day
- **Hourly Call Distribution** -- Identify peak calling hours
- **Agent-Level Metrics** -- Per-agent breakdown of total calls, success/failure, duration, cost, sentiment distribution, leads generated, and conversion rate

**Performance Trends**
- Weekly trend analysis showing total calls, success rate, average duration, total cost, and positive sentiment percentage
- Growth rate calculations for calls, cost, and duration week-over-week
- Overall period summaries for benchmarking

**Campaign-Level Analytics**
- Dedicated analytics per campaign with health scoring
- Performance alert system that flags anomalies
- Report generation with export capabilities
- Call volume and outcome tracking specific to each campaign

**Data Export**
- Export analytics data for external reporting
- Downloadable reports from the analytics dashboard

---

### 9. Integrations

IcePhone connects to the tools businesses already use through a comprehensive integration layer.

**Telephony Providers (SIP/PSTN)**
Connect to real phone lines for making and receiving actual phone calls:

- **Twilio** -- Configure with Account SID, Auth Token, From Number, outbound TwiML URL, status callback URL, and call recording toggle
- **Telnyx** -- Configure with API Key, Connection ID, From Number, and Webhook URL
- **Vonage** -- Configure with Private Key, Application ID, From Number, Answer URL, and Event URL

Each provider supports:
- Outbound call execution via the campaign queue or manual call scheduling
- Inbound call handling with webhook event ingestion
- Call status webhooks with signature validation and deduplication
- Call recording capture and storage
- Provider-specific metadata tracking

**CRM Integrations**
Bi-directional sync with major CRM platforms:

- **HubSpot** -- Private app token for contact import and call notes sync
- **Salesforce** -- Access token and instance URL for lead/contact sync, with configurable import object (Lead or Contact) and API version
- **GoHighLevel** -- Access token and location ID for contact import and notes
- **Pipedrive** -- API token and domain for person sync

CRM integration capabilities:
- Import leads from any connected CRM with search/filter options
- Auto-assign imported leads to campaigns
- Sync call outcomes back to the CRM
- Bidirectional record linkage via external record mapping (prevents duplicates)
- Track linked lead counts per provider
- Cursor-based pagination for large CRM datasets

**Calendar Integration**
- **Cal.com** -- Full integration for appointment scheduling with API key, event type configuration, team/organization settings, and timezone defaults

**AI and Voice Providers**
- **OpenAI Realtime API** -- Powers the voice conversation engine with real-time speech-to-speech capabilities
- **OpenAI Whisper** -- Provides speech-to-text transcription
- **Deepgram** -- Alternative speech-to-text provider with multilingual support
- **OpenAI Vector Store** -- Powers the knowledge base semantic search
- **Voyage AI** -- Provides text and multimodal embeddings for the RAG pipeline
- **Cloudflare R2** -- Object storage for knowledge base documents and call recordings

---

### 10. Team and User Management

IcePhone supports multi-user, multi-team environments with role-based access.

**Team Structure**
- Create teams with unique names and slugs
- Each team has isolated data: leads, agents, campaigns, knowledge bases, phone numbers, and integrations
- Users can belong to multiple teams with a default team setting
- Team members have defined roles: Owner or Member

**User Authentication**
- Email and password authentication via Better Auth
- Email verification
- OAuth support with access and refresh token management
- Session management with IP address and user agent tracking
- Secure sign-out

**Audit Logging**
- Every significant action across the platform is tracked in audit logs
- Logs capture: team, actor, action type, entity type, entity ID, and metadata
- Admin activity logs with detailed change tracking (before/after values)
- Session-level tracking with IP address, user agent, browser, OS, and device information

---

### 11. Settings and Configuration

A centralized settings hub for managing all platform preferences and integrations.

**Display Settings**
- Configure table rows per page (5, 10, 20, 50, or 100)
- Toggle dense mode for compact table displays
- Settings apply globally across all tables in the application

**Account Settings**
- View account profile (name and email)
- Session management and sign-out

**Notification Preferences**
- Toggle email notifications for summaries and alerts
- Toggle in-app notifications for operational updates
- Toggle weekly digest emails for calls, outcomes, and trends

**Integration Management**
- Single page for managing all integrations: Cal.com, CRM providers (HubSpot, Salesforce, GoHighLevel, Pipedrive), and telephony providers (Twilio, Telnyx, Vonage)
- Connection status indicators (Connected/Not Connected) for each integration
- Connect, update, and disconnect integrations
- Last-updated timestamps for each integration

---

### 12. Dashboard (Home)

The main dashboard provides an at-a-glance overview of the entire operation:

- Lead funnel visualization showing progression through stages
- Lead acquisition trends over time
- Call activity charts (inbound vs. outbound)
- Lead source distribution
- Agent performance overview
- Configurable time range (7 days, 30 days, 90 days)

---

## Use Cases

IcePhone is purpose-built for the following business scenarios:

- **Sales Outreach and Cold Calling** -- Deploy AI agents to make high-volume outbound calls, qualify leads, and book meetings with prospects
- **Lead Generation and Qualification** -- Automatically engage inbound leads, score them, and route qualified prospects to human sales teams
- **Appointment Setting** -- Let AI agents handle the back-and-forth of scheduling demos, consultations, and meetings using live calendar availability
- **Inbound Customer Support** -- Route incoming calls to AI agents that can answer questions using the knowledge base, resolve issues, and escalate when needed
- **Loan Repayment and Debt Collections** -- Conduct compliant repayment follow-up calls with structured outcomes and intent tracking
- **Customer Onboarding** -- Guide new customers through product setup and activation with patient, step-by-step voice assistance
- **Renewal and Retention** -- Proactively reach out to customers approaching renewal to review value, address concerns, and secure renewals

---

## Multi-Language Support

IcePhone supports 10 languages with dedicated voice presets for each:

- English
- Spanish
- French
- German
- Italian
- Portuguese
- Chinese
- Hindi
- Arabic
- Japanese

---

## Platform Architecture Highlights

- **Real-Time Voice Communication** -- Powered by OpenAI's Realtime API for natural, low-latency voice conversations
- **Multi-Tenant Architecture** -- Team-based data isolation ensures complete separation between organizations
- **Webhook-Driven Telephony** -- Event-driven architecture with provider webhook ingestion, signature validation, and idempotent event processing
- **Advanced RAG Pipeline** -- Multi-strategy retrieval with text, multimodal, and HyDE embeddings for highly accurate knowledge retrieval
- **Vector Search** -- HNSW-indexed vector similarity search for fast, relevant document retrieval
- **Responsive Design** -- Mobile-optimized interface with adaptive layouts, floating action buttons, and touch-friendly interactions
- **Audit Trail** -- Comprehensive logging of all platform actions for security, compliance, and debugging
- **Configurable Automation** -- Campaign queue processing with cron-based scheduling, retry logic, and business hours enforcement
