# Phase 23 Research: CRM Integrations (HubSpot, Salesforce, GoHighLevel, Pipedrive)

_Last updated: 2026-02-04_

## Goal
Design a practical integration plan so IcePhone can:
1. Import external CRM leads into campaigns.
2. Sync call outcomes/dispositions/notes back to external CRMs.
3. Keep implementation team-scoped and extensible.

## Selected CRMs (Top 4)
1. HubSpot
2. Salesforce
3. GoHighLevel
4. Pipedrive

These cover SMB/mid-market (HubSpot, GoHighLevel, Pipedrive) and enterprise (Salesforce).

## Core Integration Contract

### Inbound sync (CRM -> IcePhone)
- Source objects: contact/lead style records.
- Normalized target: `leads` table.
- Required fields: `name`, one contact method (`phone` or `email`).
- Optional fields: `source`, `notes`, `status`, `dealValue`, external owner/stage metadata.
- Deduping in IcePhone: prefer provider external ID, then email, then normalized phone.

### Outbound sync (IcePhone -> CRM)
- Trigger: call completion/update (status/disposition/summary/transcript/auto-note).
- Target objects:
  - CRM note/activity/call log
  - CRM deal/opportunity status fields (when mapped)
- Canonical payload:
  - `externalContactId`
  - `callTimestamp`
  - `durationSeconds`
  - `status`
  - `disposition` (`intent_to_pay`, `promise_to_pay`, `did_not_pick_up`, etc.)
  - `summary`
  - `transcript`
  - `autoNote`
  - `campaignContext` (campaign id/name, agent id/name)

## Provider Findings

### HubSpot
- Auth:
  - OAuth for multi-account apps; static token for single-account private installs.
  - OAuth tokens are Bearer tokens; refresh flow is required as tokens expire.
- Key APIs:
  - Contacts: `/crm/v3/objects/contacts` (create/list/search/batch/upsert).
  - Deals: `/crm/v3/objects/deals`.
  - Notes: `/crm/v3/objects/notes` (timeline writeback).
  - Associations: associate contacts/deals/notes.
- Limits:
  - Public OAuth apps: 110 req / 10 seconds per installed account.
  - Additional API-specific limits exist (notably search).
- Mapping:
  - IcePhone `lead` -> HubSpot Contact.
  - IcePhone call writeback -> HubSpot Note associated to Contact (and Deal when available).

### Salesforce
- Auth:
  - OAuth with external client app / connected app.
  - Spring ’26 guidance favors external client apps over creating new connected apps.
  - Client-credentials flow is recommended for server-to-server integration user setups.
- Key APIs:
  - sObject CRUD via REST resources.
  - SOQL query endpoint: `/services/data/vXX.X/query?q=...`.
  - Upsert by external ID via sObject rows by external ID resources.
  - Org limit introspection via `/services/data/vXX.X/limits`.
- Mapping:
  - IcePhone `lead` -> `Lead` or `Contact` (tenant config).
  - IcePhone campaign/opportunity context -> `Opportunity` mapping.
  - IcePhone call writeback -> `Task`/`Event`/`Note` pattern (tenant-configurable object strategy).

### GoHighLevel
- Auth:
  - OAuth 2.0 Authorization Code flow.
  - Token endpoint supports `authorization_code`, `refresh_token`, `client_credentials` grants.
  - Access tokens expire ~24h; refresh tokens rotate and must be persisted.
  - Location/Sub-Account token context is required for most CRM writes.
- Key APIs:
  - Contacts (including upsert endpoints).
  - Opportunities (`/opportunities/`).
  - Contact notes (`/contacts/:contactId/notes`).
- Mapping:
  - IcePhone `lead` -> GHL Contact.
  - IcePhone opportunity/campaign context -> GHL Opportunity.
  - IcePhone call writeback -> GHL Contact note + optional opportunity stage/status update.

### Pipedrive
- Auth:
  - OAuth 2.0 for marketplace/public integrations.
  - Token exchange via `POST https://oauth.pipedrive.com/oauth/token`.
  - Access tokens expire; refresh tokens expire if unused for 60 days (window extends on use).
- Key APIs:
  - Persons: `/api/v2/persons` (and search/list by filters).
  - Deals: `/api/v2/deals`.
  - Notes: `/v1/notes` (attach note to deal/person/org).
- Mapping:
  - IcePhone `lead` -> Pipedrive Person.
  - IcePhone campaign opportunity context -> Pipedrive Deal.
  - IcePhone call writeback -> Pipedrive Note attached to Person/Deal.

## Standardized Field Mapping

| IcePhone | HubSpot | Salesforce | GoHighLevel | Pipedrive |
| --- | --- | --- | --- | --- |
| `lead.name` | `firstname`/`lastname` split or `name` custom | `Lead.Name` / `Contact.Name` | `contact.name` | `person.name` |
| `lead.email` | `email` | `Lead.Email` / `Contact.Email` | contact email field | person emails |
| `lead.phone` | `phone` | `Lead.Phone` / `Contact.Phone` | contact phone field | person phones |
| `lead.source` | contact property (custom if needed) | `Lead.LeadSource` | source/custom field | custom field |
| `call.disposition` | Note body + optional custom contact/deal property | Task/Note custom field | note text + optional opportunity custom field | note content + optional deal custom field |
| `call.summary` | Note `hs_note_body` | Task/Note body | note body | note content |
| `call.transcript` | Note (truncated/summarized) or attachment link | Note/attachment link | note body/link | note content/link |

## Sync Direction Rules

1. IcePhone is source-of-truth for runtime call events.
2. CRM is source-of-truth for imported lead metadata unless explicitly overridden.
3. Outbound sync writes must be idempotent:
   - use deterministic dedupe key `call:{callId}:{provider}` in provider metadata/custom fields when possible.
4. Conflicts:
   - lead contact fields: latest remote value wins only during explicit import/sync runs.
   - call notes: append-only writeback from IcePhone.

## Team-Scoped Credential Model

Use `team_integrations` with:
- `provider` = `hubspot | salesforce | gohighlevel | pipedrive`
- `apiKey` optional (for static/private token modes)
- `settings` JSON for:
  - OAuth client configuration
  - encrypted access/refresh tokens
  - token expiry timestamps
  - object mapping preferences (`Lead` vs `Contact`, note target, pipeline IDs)

## Lead Import Contract for Campaign Switcher

Input:
- `provider`
- optional filters (`updatedSince`, pipeline/stage filters, owner)
- pagination controls (`limit`, cursor/page)

Output:
- normalized lead list + `externalId` + `provider`
- import stats (`created`, `updated`, `skipped`, `duplicates`)
- campaign assignment result (`assignedLeadIds`)

## Call Outcome/Notes Writeback Contract

Input:
- `callId`
- `provider`
- resolved `externalContactId` (+ optional external deal/opportunity id)

Behavior:
1. Build normalized call summary payload.
2. Provider adapter writes note/activity.
3. Optional status/stage updates using disposition mapping:
   - `intent_to_pay` -> follow-up stage
   - `promise_to_pay` -> committed-to-pay stage
   - `did_not_pick_up` -> retry/no-answer stage
4. Store sync result and error envelope for retries.

## Rollout Plan

1. Read-only import first (all 4 providers): fetch + normalize + preview.
2. Enable lead import persistence with campaign assignment.
3. Enable writeback for call notes/dispositions.
4. Add provider-specific stage/status mappings per team.
5. Add scheduled sync jobs and webhook-driven updates where available.

## Risks & Mitigations

- Token expiry/rotation errors:
  - Central token refresh utility per provider with proactive refresh buffer.
- Rate limits (especially HubSpot/Salesforce org budgets):
  - adapter-level throttling + exponential backoff + jitter.
- Field schema drift in customer CRMs:
  - configurable mapping layer and validation at sync time.
- Duplicate lead creation:
  - external ID first, then email/phone fallback, then manual review queue.

## Sources
- HubSpot authentication overview: https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview
- HubSpot usage limits: https://developers.hubspot.com/docs/api/usage-details
- HubSpot Contacts API: https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/guide
- HubSpot Deals API: https://developers.hubspot.com/docs/api-reference/crm-deals-v3/guide
- HubSpot Notes API: https://developers.hubspot.com/docs/api-reference/crm-notes-v3/guide
- Salesforce OAuth + connected/external client apps: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm
- Salesforce query resource: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm
- Salesforce org limits resource: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_limits.htm
- Salesforce sObject external ID upsert resource: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_sobject_upsert.htm
- Salesforce integration user best-practice blog: https://developer.salesforce.com/blogs/2024/02/invoke-rest-apis-with-the-salesforce-integration-user-and-oauth-client-credentials
- GoHighLevel OAuth 2.0: https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0
- GoHighLevel token endpoint: https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token/index.html
- GoHighLevel Contacts docs index: https://marketplace.gohighlevel.com/docs/ghl/contacts/contacts/index.html
- GoHighLevel Create Opportunity: https://marketplace.gohighlevel.com/docs/ghl/opportunities/create-opportunity/index.html
- GoHighLevel Create Contact Note: https://marketplace.gohighlevel.com/docs/ghl/contacts/create-note/index.html
- Pipedrive OAuth authorization: https://pipedrive.readme.io/docs/marketplace-oauth-authorization
- Pipedrive OAuth overview: https://pipedrive.readme.io/docs/marketplace-oauth-api
- Pipedrive Persons API: https://developers.pipedrive.com/docs/api/v1/Persons
- Pipedrive Deals API: https://developers.pipedrive.com/docs/api/v1/Deals
- Pipedrive Notes API: https://developers.pipedrive.com/docs/api/v1/Notes
