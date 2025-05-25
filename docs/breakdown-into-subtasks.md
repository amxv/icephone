# Breaking Down IcePhone Feature Requests

Quick guide for transforming feature requests into actionable subtasks that align with IcePhone's architecture and business goals.

## 🎯 Before You Start

**1. Check the Master Plan**:

```bash
# Always start here
cat docs/MASTER_FEATURES_CHECKLIST.md
grep -i "{feature-keyword}" docs/MASTER_FEATURES_CHECKLIST.md
```

**2. Think about the following questions before you start**:

- [ ] Does this solve a real business owner pain point?
- [ ] Does it fit our CRM + Voice Agent platform vision?
- [ ] Is it already planned in the master checklist?
- [ ] What's the user value and success metric?

**3. Research & Context Gathering**

```
# Check official docs for relevant tech using Context7
<function_calls>
<invoke name="mcp_context7_get-library-docs">
<parameter name="context7CompatibleLibraryID">/vercel/next.js</parameter>
<parameter name="topic">relevant-feature-topic</parameter>
</invoke>
</function_calls>

# Search for current implementation patterns using web_search
<function_calls>
<invoke name="web_search">
<parameter name="search_term">CRM voice agent feature implementation 2024</parameter>
</invoke>
</function_calls>

# Study successful implementations using mcp-deepwiki_deepwiki_fetch
<function_calls>
<invoke name="mcp_mcp-deepwiki_deepwiki_fetch">
<parameter name="url">relevant-repo</parameter>
<parameter name="mode">aggregate</parameter>
</invoke>
</function_calls>
```

## 🚨 Critical Rule: Don't Duplicate Features

**If a feature already exists in the master checklist, DO NOT create subtasks for it.**

Instead:
- Reference it as a dependency: "Depends on feature #X-feature-name"
- Link to integration points only
- Focus on the unique parts of your request

Example: Don't create "add voice agent management" subtasks when feature #3-vapi-ai-integration already covers this.

## 📦 Core Implementation Layers

Break features into these IcePhone-specific layers:

### **1. Database Foundation**
- Schema changes in `src/db/schema.ts`
- User isolation with `userId` field
- Proper indexes and relationships

### **2. Server Actions**
- Authenticated operations with `currentUser()`
- Zod validation schemas
- Error handling and user isolation

### **3. UI Components**
- Server components for data loading
- Client components for interactivity
- Follow IcePhone design system (`rounded-3xl`, `bg-card/40 backdrop-blur-sm`)

### **4. Integration Points**
- VAPI voice features (if needed)
- External APIs and webhooks
- Real-time updates

## 🎯 Simple Subtask Template

```markdown
### [Component] - [Action]

**What**: Clear, specific goal
**Why**: Business value for users
**Files**: List exact files to modify
**Dependencies**: Reference existing features by number

**Core Tasks:**
- [ ] Database schema (if needed)
- [ ] Server actions with auth
- [ ] UI components
- [ ] Integration testing
- [ ] Mobile responsive check

**Definition of Done:**
- [ ] Works end-to-end
- [ ] `bun test` passes
- [ ] `bun run check` passes
- [ ] Follows design system
- [ ] User data isolated
```

## 🚀 Implementation Order

Always follow this sequence:

1. **Database** → Schema changes first
2. **Server** → Actions with authentication
3. **UI** → Components following design patterns
4. **Test** → Core functionality verification
5. **Polish** → Error states, loading, mobile

## 📋 Based on Existing Patterns

Looking at successful IcePhone features, focus on:

**Core Functionality First**
- Essential user actions only
- Basic CRUD operations
- Simple, clear interfaces

**Skip for Initial Implementation**
- Advanced analytics
- Bulk operations
- Complex integrations
- Intensive testing frameworks

**Keep Testing Simple**
- Manual verification
- Type checking (`bun run check`)
- Build verification (`bun run build`)
- Basic functionality testing

## ✅ Quality Checklist

Before finalizing subtasks:

**Business Alignment**
- [ ] Serves voice agent or CRM use case
- [ ] Doesn't duplicate existing features
- [ ] Clear user value proposition

**Technical Requirements**
- [ ] Authentication and user isolation planned
- [ ] Database changes with Drizzle
- [ ] Design system compliance
- [ ] Performance considerations for Cloudflare Workers

**Implementation Ready**
- [ ] Each subtask is 1-2 days of work
- [ ] Dependencies clearly identified
- [ ] File modifications specified
- [ ] Acceptance criteria are testable

## 🎪 Examples from Existing Features

**Phone Numbers Feature** (feature #2):
- Database schema with user isolation
- Server actions with authentication
- Simple CRUD interface with dialogs
- Basic status management
- Mobile responsive design

**Voice Agents Feature** (feature #3):
- Role-based presets system
- Voice selection interface
- VAPI integration
- Simple 3-step creation wizard
- Admin customization panel

Remember: IcePhone helps business owners automate customer interactions. Every feature should make this simpler and more effective.