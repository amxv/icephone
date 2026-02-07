## Analysis: Agent Roles Fetch and Display in Voice Agent Creation Flow

### Overview

Agent roles are stored in the `agent_roles` PostgreSQL table and fetched via a server action (`getAgentRoles`) called from the `SimpleAgentCreator` dialog component. The roles are **not hardcoded** -- they must be **seeded into the database** by running `bun db:seed`. The production bug ("No agent roles are available yet") is almost certainly caused by the seed script never having been executed against the production database, resulting in an empty `agent_roles` table.

### Entry Points

- `/Users/ashray/code/amxv/icephone/src/components/simple-agent-creator.tsx:82` - `SimpleAgentCreator` component (the dialog wizard)
- `/Users/ashray/code/amxv/icephone/src/actions/agent-roles.ts:77` - `getAgentRoles()` server action
- `/Users/ashray/code/amxv/icephone/src/scripts/seed-voice-data.ts:624` - `seedVoiceData()` seed function

### Core Implementation

#### 1. UI Component: SimpleAgentCreator (`simple-agent-creator.tsx`)

**Step 1 of the wizard** ("Choose Your Agent's Role") is rendered at lines 339-447.

- The component maintains `agentRoles` state as an empty array initially (line 91):
  ```ts
  const [agentRoles, setAgentRoles] = useState<AgentRole[]>([])
  ```

- When the dialog opens (`open` becomes true), a `useEffect` at lines 100-126 calls `getAgentRoles()`:
  ```ts
  const rolesResult = await getAgentRoles()
  setAgentRoles(rolesResult)
  ```

- If `agentRoles.length === 0` after loading completes, the empty-state message is shown (lines 373-377):
  ```tsx
  <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
      No agent roles are available yet. Please try again in a moment.
  </div>
  ```

- The "Next" button is disabled while loading or when no role is selected (lines 266-269):
  ```ts
  const nextDisabled = currentStep === 1
      ? isLoadingRoles || !canProceedFromStep(currentStep)
      : !canProceedFromStep(currentStep)
  ```

- On error, a toast is shown (line 113): `toast.error("Failed to load agent roles")`

- On success with no errors but zero results, the empty-state message appears silently -- no toast, no error. The user simply sees "No agent roles are available yet."

#### 2. Server Action: getAgentRoles (`agent-roles.ts:77-89`)

```ts
export async function getAgentRoles(): Promise<AgentRole[]> {
    const roles = await db.query.agentRoles.findMany({
        where: eq(agentRoles.isActive, true),
        orderBy: [asc(agentRoles.sortOrder), asc(agentRoles.displayName)]
    })
    return roles as AgentRole[]
}
```

Key observations:
- Uses `db_ws` imported as `db` from `@/db` (line 3: `import { db_ws as db } from "@/db"`)
- Filters by `isActive = true` -- if roles exist but `is_active` is false, they would also be hidden
- No team scoping -- agent roles are global/shared across all teams
- On error, throws (line 87) which would be caught by the component's try/catch and show a toast error

#### 3. Database Connection (`src/db/index.ts`)

The `db_ws` connection used by agent-roles.ts is defined at lines 8-14:

```ts
const connectionString =
    process.env.NODE_ENV === "production"
        ? process.env.PROD_DB_URL
        : process.env.DEV_DB_URL
```

- In development (`NODE_ENV !== "production"`): uses `DEV_DB_URL`
- In production (`NODE_ENV === "production"`): uses `PROD_DB_URL`
- Both env vars are present in `.env.local` (confirmed: `DEV_DB_URL` and `PROD_DB_URL` exist)

**Critical distinction**: `src/db/index.ts` loads dotenv from `.env.local` (line 6: `config({ path: ".env.local" })`), while `src/db/db.ts` does NOT load dotenv and relies on the Next.js runtime to provide env vars.

The server action at `src/actions/agent-roles.ts` imports from `@/db` which maps to `src/db/index.ts`, so it uses `db_ws`.

#### 4. Database Schema: agent_roles table (`schema.ts:917-1003`)

```sql
agent_roles (
    id              serial PRIMARY KEY,
    role_name       varchar(100) NOT NULL UNIQUE,
    display_name    varchar(100) NOT NULL,
    description     text NOT NULL,
    icon            varchar(50) NOT NULL,
    system_prompt   text NOT NULL,
    conversation_style text NOT NULL,
    industry_focus  text,
    sample_conversation text,
    default_functions jsonb DEFAULT '[]',
    default_configuration jsonb DEFAULT '{}',
    first_message_template text,
    is_active       boolean DEFAULT true,
    sort_order      integer DEFAULT 0,
    created_at      timestamp DEFAULT now(),
    updated_at      timestamp DEFAULT now()
)
```

Notable: **No `team_id` column** -- agent roles are global, not per-team. This is intentional as they are system-wide templates.

#### 5. Seed Script (`src/scripts/seed-voice-data.ts`)

The seed script defines **3 agent roles** (lines 168-622):

| roleName | displayName | Icon | sortOrder |
|----------|-------------|------|-----------|
| `customer-service` | Customer Service | `headphones` | 1 |
| `sales` | Sales Representative | `trending-up` | 2 |
| `appointment-setting` | Appointment Setter | `calendar` | 3 |

Each role includes:
- A full system prompt with instructions
- Default functions (webhook-based tool calls)
- Default configuration (flow, LLM, timeout settings)
- A first message template
- `isActive: true`

The seed is run via `bun db:seed` (package.json line 16):
```json
"db:seed": "bun run src/scripts/seed-voice-data.ts"
```

The seed script uses **upsert-like logic** -- it checks if a role exists by `roleName` before inserting (lines 650-663):
```ts
const existing = await db.query.agentRoles.findFirst({
    where: (roles, { eq }) => eq(roles.roleName, role.roleName)
})
if (!existing) {
    await db.insert(agentRoles).values(role)
}
```

**The seed uses `db_ws`** from `@/db`, which picks the database based on `NODE_ENV`. Since the seed is a standalone script run with `bun`, `NODE_ENV` is likely **not** set to `"production"`, meaning `bun db:seed` would seed the **DEV** database by default.

### Data Flow

1. User clicks "Create Voice Agent" button -> `SimpleAgentCreator` dialog opens
2. `useEffect` fires (line 100) -> calls `getAgentRoles()` server action
3. `getAgentRoles()` (line 77) -> queries `agent_roles` table via `db_ws` where `is_active = true`
4. Database connection selects `PROD_DB_URL` or `DEV_DB_URL` based on `NODE_ENV`
5. Results returned to component -> stored in `agentRoles` state
6. If results are empty -> "No agent roles are available yet" message shown
7. If results exist -> role cards rendered in a 3-column grid

### Root Cause Analysis: Why Production Shows No Roles

**Most Likely Cause: The seed script was never run against the production database.**

Evidence:
1. The `db:seed` script at `package.json:16` runs `bun run src/scripts/seed-voice-data.ts`
2. The seed script imports `db_ws` from `@/db` (`src/db/index.ts`)
3. `src/db/index.ts:8-11` selects the database URL based on `NODE_ENV`:
   - Without `NODE_ENV=production`, it uses `DEV_DB_URL`
   - Only when `NODE_ENV=production` does it use `PROD_DB_URL`
4. Running `bun db:seed` locally **without** setting `NODE_ENV=production` seeds only the dev database
5. There is **no build step, migration hook, or deployment script** that runs the seed automatically
6. The `agent_roles` table has no `team_id` so there's no per-user data -- either the global seed data exists or it doesn't

**To fix**: Run the seed against production:
```bash
NODE_ENV=production bun db:seed
```

**Alternative Possible Causes** (less likely):
1. The schema migration was not pushed to production (`db:prod:push` or `db:prod:migrate` never ran), so the `agent_roles` table doesn't exist. But this would likely cause the server action to throw an error, which would show a toast error, not the empty-state message.
2. `PROD_DB_URL` is not correctly set in the production environment variables (Vercel), causing the connection to fail silently or connect to the wrong database.
3. The roles exist in production but all have `is_active = false`.

### Configuration and Environment Variables

| Variable | Purpose | Used By |
|----------|---------|---------|
| `DEV_DB_URL` | Neon PostgreSQL connection string for development | `src/db/index.ts`, `src/db/db.ts`, `drizzle.config.dev.ts` |
| `PROD_DB_URL` | Neon PostgreSQL connection string for production | `src/db/index.ts`, `src/db/db.ts`, `drizzle.config.prod.ts` |
| `NODE_ENV` | Determines which database URL to use | `src/db/index.ts:9`, `src/db/db.ts:10` |

The `.env.local` file contains both `DEV_DB_URL` and `PROD_DB_URL`. In production (Vercel), `NODE_ENV` is automatically set to `"production"`.

### Key Files

| File | Purpose |
|------|---------|
| `/Users/ashray/code/amxv/icephone/src/components/simple-agent-creator.tsx` | UI component - the 3-step voice agent creation wizard |
| `/Users/ashray/code/amxv/icephone/src/actions/agent-roles.ts` | Server actions for fetching agent roles from DB |
| `/Users/ashray/code/amxv/icephone/src/scripts/seed-voice-data.ts` | Seed script that populates `agent_roles` and `voice_presets` tables |
| `/Users/ashray/code/amxv/icephone/src/db/schema.ts` (lines 917-1003) | Database schema for `agent_roles` table |
| `/Users/ashray/code/amxv/icephone/src/db/index.ts` | Database connection (`db_ws`) with env-based URL selection |
| `/Users/ashray/code/amxv/icephone/src/actions/voice-presets.ts` | Voice presets server actions (same pattern, same potential issue) |
| `/Users/ashray/code/amxv/icephone/package.json` (line 16) | `db:seed` script definition |

### Note on Voice Presets

The same seed script also seeds the `voice_presets` table (11 presets across 4 languages). If the seed hasn't been run against production, **Step 2 of the wizard** (voice selection) would also show no voices. The `getVoicePresets()` server action at `/Users/ashray/code/amxv/icephone/src/actions/voice-presets.ts:65-86` follows the exact same pattern -- querying from the database with no fallback data.
