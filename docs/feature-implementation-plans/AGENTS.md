# Instructions

## Project Context

IcePhone is an AI-powered CRM and Voice Agent Platform that allows business owners to set up custom Voice Agents to respond to inbound calls, perform outbound cold calls and follow-ups fully autonomously. It also provides standard CRM features for lead tracking, qualification, analytics, etc.

## About You

- You are an experienced and skilled full-stack web developer.
- You have a high level of proficiency with React 19, Next.js 15 (App Router), and Tailwind CSS.
- You are also an excellent designer with a taste for beautiful user interfaces and web applications using shadcn/ui.
- You are an expert at using Drizzle ORM and PostgresSQL to manage your data across the application.
- You are an skilled at using Clerk for authentication.

## Design and Styling

- Always try to use UI components from shadcn/ui. It is already installed, but not all components are added. You can run the commands like `bunx shadcn@latest add button card` etc to add specific components. Run a search in the components folder before you run the install command to understand which ones you can skip.
- Always use Tailwind CSS for styling. It is already installed.
- Always use icons from lucide-react. It is already installed.
- Try to create clean, sleek, modern, and minimal design that is responsive on both mobile and desktop browsers.
- Follow the design patterns, conventions, and styling applied in the project to remain consistent.
- Always use rounded corners (2xl or 3xl).
- Prefer the 'outline' variant for most buttons.

## Tech Stack

- Next.js v15 (App Router)
- React v19
- Tailwind CSS
- Drizzle ORM
- Neon Database (PostgresSQL)
- Shadcn/ui for components
- Clerk for authentication
- Lucide-react for icons
- Vercel for deployment

## Performance

- My highest priority is User Experience.
- I want this Next.js website to load fast on any browser and in all network conditions.
- Try to use React Server Components whenever possible so that we can render pages on the server for faster initial page loads.
- However, if some components need high interactivity then you can use client components for a good user experience.
- It should react to user input quickly without any lag and feel "snappy" to use.
- I might give you some images to add to the site - always run a zsh command to convert it to an optimized format like webp before adding it so that they load fast.

# React Compiler Best Practices Guide

*For React 19 with Next.js 15.3.2*

## Philosophy Change

**Before:** Manual `memo()`, `useMemo()`, `useCallback()` everywhere
**Now:** Write clean code, let compiler optimize automatically

## Core Principles

### 1. Write Simple, Pure Components

```jsx
// ✅ Let compiler handle optimization
function ProductList({ products, searchTerm }) {
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClick = (id) => {
    onProductSelect(id);
  };

  return (
    <div>
      {filteredProducts.map(product =>
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => handleClick(product.id)}
        />
      )}
    </div>
  );
}
```

### 2. Stop Manual Memoization (Usually)

```jsx
// ❌ Old approach
const Component = memo(({ data }) => {
  const processed = useMemo(() => data.map(transform), [data]);
  const handleClick = useCallback((id) => onClick(id), [onClick]);
  return <div>{/* render */}</div>;
});

// ✅ New approach
function Component({ data }) {
  const processed = data.map(transform);
  const handleClick = (id) => onClick(id);
  return <div>{/* render */}</div>;
}
```

## When to Still Use Manual Memoization

### Keep `useMemo` for Expensive Operations

```jsx
const processedData = useMemo(() => {
  return rawData
    .filter(/* complex filtering */)
    .map(/* expensive transformation */)
    .sort(/* complex sorting */);
}, [rawData]);
```

### Keep `useCallback` for External Libraries

```jsx
const handleMapClick = useCallback((coords) => {
  externalMapLibrary.setCenter(coords);
}, []);
```

## Next.js Configuration

```js
// next.config.js
const nextConfig = {
  experimental: {
    reactCompiler: true
  }
};
```

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "plugin:react-hooks/recommended"],
  "plugins": ["react-compiler"],
  "rules": {
    "react-compiler/react-compiler": "error"
  }
}
```

## Avoid These Patterns

```jsx
// ❌ Side effects in render
function Bad({ items }) {
  localStorage.setItem('count', items.length); // Don't do this
  return <div>{items.length}</div>;
}

// ❌ Mutating props
function Bad({ user }) {
  user.lastSeen = Date.now(); // Don't mutate
  return <div>{user.name}</div>;
}

// ❌ Mixing old and new patterns
const Bad = memo(({ data }) => {
  const result = useMemo(() => process(data), [data]); // Redundant
  return <div>{result}</div>;
});
```

## Migration Strategy

1. **New components:** Use compiler patterns from the start
2. **Existing components:** Remove manual memoization gradually
3. **Performance:** Measure with React DevTools, add manual optimization only when needed
4. **Trust the compiler:** Focus on code clarity over optimization

## Key Takeaway

Write readable, pure React components. Let the compiler handle performance optimization. Only add manual memoization when you measure a specific performance need.

# Next.js 15.3.2 Best Practices Guide

*For Cloudflare Workers deployment with OpenNext.js*

## Philosophy Change

**Before:** Build for traditional Node.js hosting environments
**Now:** Optimize for the edge runtime and Cloudflare Workers constraints

## Core Principles

### 1. Embrace Server Components by Default

```jsx
// ✅ Server Component - runs on Cloudflare's edge
async function ProductList({ category }) {
  const products = await fetch(`https://api.example.com/products/${category}`, {
    next: { revalidate: 3600 } // Cache for 1 hour
  });

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// ✅ Client Component only when needed
'use client';
function AddToCartButton({ productId }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    setIsLoading(true);
    await addToCart(productId);
    setIsLoading(false);
  };

  return (
    <button onClick={handleAdd} disabled={isLoading}>
      {isLoading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
}
```

### 2. Stop Overusing useEffect for Data Fetching

```jsx
// ❌ Old approach - causes unnecessary client-side work
'use client';
function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  return <div>{product.name}</div>;
}

// ✅ New approach - server-side data fetching
async function ProductPage({ params }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`, {
    next: { revalidate: 60 }
  });

  return <div>{product.name}</div>;
}
```

## Cloudflare Workers Configuration

### Essential next.config.ts

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic optimizations
  experimental: {
    reactCompiler: true,
    // Enable after() for background tasks
    after: true,
    // Use Turbopack for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },

  // Image optimization for Cloudflare
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ],
    // Use Cloudflare Images for optimization
    loader: 'custom',
    loaderFile: './cloudflare-image-loader.js'
  },

  // Bundle optimization for Workers
  serverExternalPackages: ['@prisma/client'],
  bundlePagesRouterDependencies: true,

  // Enable compression
  compress: true,

  // Output for standalone deployment
  output: 'standalone'
};

export default nextConfig;
```

### OpenNext Configuration

```typescript
// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  incrementalCache: 'cloudflare-r2'
});
```

### Wrangler Configuration

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "your-app-name",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": [
    "nodejs_compat",
    "global_fetch_strictly_public"
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "r2_buckets": [
    {
      "binding": "NEXT_CACHE_BUCKET",
      "bucket_name": "your-cache-bucket"
    }
  ]
}
```

## Performance Optimization Patterns

### 1. Smart Data Fetching with Parallel Requests

```jsx
// ✅ Parallel data fetching in Server Components
async function DashboardPage() {
  const [user, analytics, notifications] = await Promise.all([
    getUser(),
    getAnalytics(),
    getNotifications()
  ]);

  return (
    <div>
      <UserProfile user={user} />
      <Analytics data={analytics} />
      <NotificationPanel notifications={notifications} />
    </div>
  );
}
```

### 2. Optimize Images for Cloudflare

```jsx
// cloudflare-image-loader.js
export default function cloudflareLoader({ src, width, quality }) {
  const params = [`width=${width}`, `quality=${quality || 75}`];
  return `https://your-domain.com/cdn-cgi/image/${params.join(',')}/${src}`;
}

// Component usage
import Image from 'next/image';

function ProductImage({ product }) {
  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      width={600}
      height={400}
      sizes="(max-width: 768px) 100vw, 50vw"
      priority={product.featured}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    />
  );
}
```

### 3. Implement Streaming with Suspense

```jsx
import { Suspense } from 'react';

function ProductPage({ params }) {
  return (
    <div>
      <ProductHeader id={params.id} />

      <Suspense fallback={<ProductDetailsSkeleton />}>
        <ProductDetails id={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews id={params.id} />
      </Suspense>
    </div>
  );
}

async function ProductDetails({ id }) {
  const product = await getProduct(id);
  return <div>{product.description}</div>;
}
```

## Cloudflare-Specific Patterns

### 1. Use Environment Variables Correctly

```typescript
// .dev.vars (for local development)
NEXTJS_ENV=development
DATABASE_URL=postgresql://...
API_KEY=your-api-key

// In your code
export async function getServerSideProps() {
  const apiKey = process.env.API_KEY;
  // Use environment variables
}
```

### 2. Background Tasks with after()

```jsx
import { unstable_after as after } from 'next/server';

export async function POST(request) {
  const data = await request.json();

  // Primary response
  const result = await processOrder(data);

  // Background tasks (non-blocking)
  after(async () => {
    await sendConfirmationEmail(result.orderId);
    await updateAnalytics(result);
    await syncToWarehouse(result);
  });

  return Response.json({ success: true, orderId: result.orderId });
}
```

### 3. Edge-Compatible Database Patterns

```typescript
// Use connection pooling for better performance
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getProducts() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM products LIMIT 20');
    return result.rows;
  } finally {
    client.release();
  }
}
```

## Bundle Size Optimization

### 1. Dynamic Imports for Heavy Components

```jsx
import dynamic from 'next/dynamic';

const ChartComponent = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Don't server-render heavy charts
});

const MarkdownEditor = dynamic(() => import('./MarkdownEditor'), {
  loading: () => <div>Loading editor...</div>
});
```

### 2. Tree Shaking and External Packages

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'lodash',
      'date-fns',
      'lucide-react'
    ]
  }
};
```

## Development vs Production

### Development Commands

```bash
# Local development with Turbopack
bun dev --turbo

# Preview with Cloudflare runtime
bun preview

# Type checking
bun check
```

### Production Deployment

```bash
# Build and deploy to Cloudflare
bun run deploy

# Upload new version without immediate deployment
bun run upload
```

## Monitoring and Analytics

### Built-in Performance Monitoring

```jsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

## Common Pitfalls to Avoid

### Don't Use Edge Runtime Unless Necessary

```jsx
// ❌ Avoid unless you specifically need it
export const runtime = 'edge';

// ✅ Default Node.js runtime works better with OpenNext
// (No runtime export needed)
```

### Avoid Large Bundle Sizes

```jsx
// ❌ Importing entire libraries
import _ from 'lodash';
import * as dateFns from 'date-fns';

// ✅ Import only what you need
import { debounce } from 'lodash';
import { format } from 'date-fns';
```

## Testing Your Performance

```bash
# Lighthouse CI for performance testing
npx @lhci/cli autorun

# Bundle analyzer
npx @next/bundle-analyzer

# Check bundle size limits
bun run build && ls -la .open-next/
```

## Key Takeaways

1. **Server Components First**: Use client components sparingly
2. **Edge-Optimized**: Configure properly for Cloudflare Workers
3. **Cache Strategically**: Leverage ISR and R2 for caching
4. **Stream Content**: Use Suspense for better perceived performance
5. **Monitor Bundle Size**: Keep under Cloudflare's 10MB limit
6. **Test Locally**: Use `bun preview` to test in Workers runtime

Remember: Cloudflare Workers have specific constraints (10MB bundle limit, edge runtime differences). Always test your deployments with `bun preview` before going to production.

# Key Takeaways

1. **Server Components First**: Use client components sparingly
2. **Edge-Optimized**: Configure properly for Cloudflare Workers
3. **Cache Strategically**: Leverage ISR and R2 for caching
4. **Stream Content**: Use Suspense for better perceived performance
5. **Monitor Bundle Size**: Keep under Cloudflare's 10MB limit
6. **Test Locally**: Use `bun preview` to test in Workers runtime

Remember: Cloudflare Workers have specific constraints (10MB bundle limit, edge runtime differences). Always test your deployments with `bun preview` before going to production.

# From Feature Request to Implementation

*A Complete Guide for IcePhone CRM and Voice Agent Platform*

## Overview

This guide shows you how to take a feature request (even just a single sentence) and systematically break it down into a complete, tested implementation that integrates seamlessly with IcePhone's architecture.

## The Process: Feature Request → Working Feature

### Example Feature Request

*"Users should be able to see analytics for their voice agents"*

Let's walk through the complete process of turning this into a working feature.

## Phase 1: Feature Request Analysis & Design

### Step 1.1: Expand the Feature Request

**Start with questions to clarify the scope:**

```bash
# Create a feature analysis document
mkdir -p docs/features/voice-agent-analytics
touch docs/features/voice-agent-analytics/requirements.md
```

**Questions to ask:**

- What specific analytics? (call duration, success rates, sentiment?)
- What time periods? (daily, weekly, monthly, custom ranges?)
- How should data be displayed? (charts, tables, dashboards?)
- Who can access what data? (user isolation, team sharing?)
- Performance requirements? (real-time vs batch updates?)

**Expanded Feature Definition:**

```markdown
# Voice Agent Analytics Dashboard

## User Stories
- As a business owner, I want to see call metrics for each voice agent
- As a user, I want to filter analytics by date range
- As a user, I want to export analytics data
- As an admin, I want to see aggregate analytics across all users

## Success Metrics
- Page loads in under 2 seconds
- Real-time updates within 30 seconds
- Mobile responsive design
- 99.9% uptime for analytics API
```

### Step 1.2: Design the Data Model

**Think about relationships and constraints:**

```sql
-- New tables needed
CREATE TABLE voice_agent_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  voice_agent_id UUID REFERENCES voice_agents(id),

  -- Metrics
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER,
  avg_sentiment_score REAL CHECK (avg_sentiment_score BETWEEN -1 AND 1),

  -- Time period
  period_type VARCHAR(20) CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  UNIQUE(user_id, voice_agent_id, period_type, period_start)
);

CREATE INDEX idx_analytics_user_period ON voice_agent_analytics(user_id, period_start DESC);
CREATE INDEX idx_analytics_agent_period ON voice_agent_analytics(voice_agent_id, period_start DESC);
```

### Step 1.3: Plan the API Surface

**Define what endpoints/actions you need:**

```typescript
// src/actions/analytics.ts - Server Actions Planning
export async function getVoiceAgentAnalytics(filters: AnalyticsFilters): Promise<AnalyticsData>
export async function exportAnalyticsData(filters: AnalyticsFilters): Promise<string> // CSV data
export async function refreshAnalytics(voiceAgentId: string): Promise<void>

// Types needed
interface AnalyticsFilters {
  voiceAgentIds?: string[];
  dateRange: { start: Date; end: Date };
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

interface AnalyticsData {
  summary: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
  };
  trends: Array<{
    period: string;
    calls: number;
    successRate: number;
    avgDuration: number;
  }>;
}
```

### Step 1.4: Design the UI Flow

**Map out the user journey:**

```
/analytics
├── Header with filters (date picker, agent selector)
├── Summary Cards (total calls, success rate, avg duration)
├── Charts Section
│   ├── Calls Over Time (line chart)
│   ├── Success Rate Trend (area chart)
│   └── Duration Distribution (histogram)
├── Data Table (paginated results)
└── Export Button (download CSV)

Mobile Responsive:
- Stack cards vertically
- Horizontal scroll for charts
- Collapsible filters
```

## Phase 2: Implementation with Automated Testing

### Step 2.1: Create Feature Branch & Setup

```bash
# Create feature branch
git checkout -b feature/voice-agent-analytics

# Set up feature directory structure
mkdir -p src/app/\(pages\)/analytics/components
mkdir -p src/actions
mkdir -p docs/features/voice-agent-analytics
mkdir -p tests/features/voice-agent-analytics

# Initialize testing setup
touch tests/features/voice-agent-analytics/analytics.test.ts
touch tests/features/voice-agent-analytics/integration.test.ts
```

### Step 2.2: Database Schema Implementation

**Create the schema changes:**

```typescript
// src/db/schema.ts additions
export const voiceAgentAnalytics = pgTable('voice_agent_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  voiceAgentId: uuid('voice_agent_id').references(() => voiceAgents.id),

  // Metrics
  totalCalls: integer('total_calls').default(0),
  successfulCalls: integer('successful_calls').default(0),
  avgDurationSeconds: integer('avg_duration_seconds'),
  avgSentimentScore: real('avg_sentiment_score'),

  // Time period
  periodType: varchar('period_type', { length: 20 }),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Indexes for performance
export const analyticsUserPeriodIdx = index('idx_analytics_user_period')
  .on(voiceAgentAnalytics.userId, voiceAgentAnalytics.periodStart.desc());

export const analyticsAgentPeriodIdx = index('idx_analytics_agent_period')
  .on(voiceAgentAnalytics.voiceAgentId, voiceAgentAnalytics.periodStart.desc());
```

**Test the schema with CLI:**

```bash
# Generate migration
bun db:generate --name "add-voice-agent-analytics"

# Apply to development database
bun db:dev:push

# Test schema with sample data using Neon MCP
# (This will be demonstrated in the terminal)
```

**Automated Schema Testing:**

```typescript
// tests/features/voice-agent-analytics/schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@/db';
import { voiceAgentAnalytics } from '@/db/schema';

describe('Voice Agent Analytics Schema', () => {
  it('should create analytics record with required fields', async () => {
    const testRecord = await db.insert(voiceAgentAnalytics).values({
      userId: 'test-user-id',
      voiceAgentId: 'test-agent-id',
      totalCalls: 10,
      successfulCalls: 8,
      periodType: 'daily',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-02')
    }).returning();

    expect(testRecord[0]).toBeDefined();
    expect(testRecord[0].totalCalls).toBe(10);
    expect(testRecord[0].successfulCalls).toBe(8);
  });

  it('should enforce unique constraint on user/agent/period', async () => {
    // Test duplicate constraint
    expect(async () => {
      await db.insert(voiceAgentAnalytics).values([
        {
          userId: 'test-user',
          voiceAgentId: 'test-agent',
          periodType: 'daily',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-02')
        },
        {
          userId: 'test-user',
          voiceAgentId: 'test-agent',
          periodType: 'daily',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-02')
        }
      ]);
    }).toThrow();
  });
});

// Run with: bun test tests/features/voice-agent-analytics/schema.test.ts
```

### Step 2.3: Server Actions with Test-Driven Development

**Create types first:**

```typescript
// src/types.ts additions
export interface AnalyticsFilters {
  voiceAgentIds?: string[];
  dateRange: { start: Date; end: Date };
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface AnalyticsData {
  summary: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
  };
  trends: Array<{
    period: string;
    calls: number;
    successRate: number;
    avgDuration: number;
  }>;
}
```

**Write tests first (TDD approach):**

```typescript
// tests/features/voice-agent-analytics/analytics.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { getVoiceAgentAnalytics, exportAnalyticsData } from '@/actions/analytics';

describe('Analytics Server Actions', () => {
  beforeEach(() => {
    // Mock current user
    vi.mock('@clerk/nextjs/server', () => ({
      currentUser: vi.fn().mockResolvedValue({ id: 'test-user-id' })
    }));
  });

  it('should return analytics data for authenticated user', async () => {
    const filters = {
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      periodType: 'daily' as const
    };

    const result = await getVoiceAgentAnalytics(filters);

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.trends).toBeInstanceOf(Array);
  });

  it('should throw error for unauthenticated requests', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);

    expect(async () => {
      await getVoiceAgentAnalytics({
        dateRange: { start: new Date(), end: new Date() },
        periodType: 'daily'
      });
    }).toThrow('Unauthorized');
  });

  it('should export CSV data', async () => {
    const filters = {
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      periodType: 'daily' as const
    };

    const csvData = await exportAnalyticsData(filters);

    expect(csvData).toContain('Period,Calls,Success Rate,Avg Duration');
    expect(typeof csvData).toBe('string');
  });
});

// Run tests: bun test tests/features/voice-agent-analytics/analytics.test.ts
```

**Implement server actions:**

```typescript
// src/actions/analytics.ts
'use server';

import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { voiceAgentAnalytics } from '@/db/schema';
import { and, eq, between, desc } from 'drizzle-orm';
import { AnalyticsFilters, AnalyticsData } from '@/types';

export async function getVoiceAgentAnalytics(filters: AnalyticsFilters): Promise<AnalyticsData> {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  // Build query conditions
  const conditions = [
    eq(voiceAgentAnalytics.userId, user.id),
    between(voiceAgentAnalytics.periodStart, filters.dateRange.start, filters.dateRange.end)
  ];

  if (filters.voiceAgentIds?.length) {
    conditions.push(inArray(voiceAgentAnalytics.voiceAgentId, filters.voiceAgentIds));
  }

  // Get analytics data
  const analyticsData = await db
    .select()
    .from(voiceAgentAnalytics)
    .where(and(...conditions))
    .orderBy(desc(voiceAgentAnalytics.periodStart));

  // Calculate summary
  const summary = {
    totalCalls: analyticsData.reduce((sum, record) => sum + (record.totalCalls || 0), 0),
    successRate: analyticsData.length > 0
      ? analyticsData.reduce((sum, record) => sum + ((record.successfulCalls || 0) / (record.totalCalls || 1)), 0) / analyticsData.length
      : 0,
    avgDuration: analyticsData.length > 0
      ? analyticsData.reduce((sum, record) => sum + (record.avgDurationSeconds || 0), 0) / analyticsData.length
      : 0
  };

  // Format trends data
  const trends = analyticsData.map(record => ({
    period: record.periodStart.toISOString().split('T')[0],
    calls: record.totalCalls || 0,
    successRate: (record.successfulCalls || 0) / (record.totalCalls || 1),
    avgDuration: record.avgDurationSeconds || 0
  }));

  return { summary, trends };
}

export async function exportAnalyticsData(filters: AnalyticsFilters): Promise<string> {
  const data = await getVoiceAgentAnalytics(filters);

  const csvHeader = 'Period,Calls,Success Rate,Avg Duration\n';
  const csvRows = data.trends
    .map(row => `${row.period},${row.calls},${row.successRate.toFixed(2)},${row.avgDuration}`)
    .join('\n');

  return csvHeader + csvRows;
}

export async function refreshAnalytics(voiceAgentId: string): Promise<void> {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  // Background job to recalculate analytics
  // This would typically trigger a background job
  console.log(`Refreshing analytics for agent ${voiceAgentId}`);
}
```

**Test server actions:**

```bash
# Run unit tests
bun test tests/features/voice-agent-analytics/analytics.test.ts

# Test with watch mode during development
bun test tests/features/voice-agent-analytics/analytics.test.ts --watch
```

### Step 2.4: UI Components with Component Testing

**Create the page structure:**

```bash
# Create analytics page and components
mkdir -p src/app/\(pages\)/analytics/components
touch src/app/\(pages\)/analytics/page.tsx
touch src/app/\(pages\)/analytics/components/AnalyticsDashboard.tsx
touch src/app/\(pages\)/analytics/components/MetricsCards.tsx
touch src/app/\(pages\)/analytics/components/TrendsChart.tsx
touch src/app/\(pages\)/analytics/components/FilterPanel.tsx
touch src/app/\(pages\)/analytics/components/ExportButton.tsx

# Create component tests
touch tests/features/voice-agent-analytics/components.test.tsx
```

**Server Component (Page):**

```jsx
// src/app/(pages)/analytics/page.tsx
import { Suspense } from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { getVoiceAgentAnalytics } from '@/actions/analytics';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import MetricsCards from './components/MetricsCards';

interface SearchParams {
  start?: string;
  end?: string;
  agents?: string;
}

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  // Parse search params with defaults
  const filters = {
    dateRange: {
      start: searchParams.start ? new Date(searchParams.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: searchParams.end ? new Date(searchParams.end) : new Date()
    },
    voiceAgentIds: searchParams.agents?.split(',').filter(Boolean),
    periodType: 'daily' as const
  };

  const initialData = await getVoiceAgentAnalytics(filters);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Voice Agent Analytics</h1>
        <p className="text-muted-foreground">Monitor and analyze your voice agent performance</p>
      </div>

      <Suspense fallback={<MetricsCardsSkeleton />}>
        <MetricsCards data={initialData.summary} />
      </Suspense>

      <AnalyticsDashboard initialData={initialData} initialFilters={filters} />
    </div>
  );
}
```

**Client Component with State Management:**

```jsx
// src/app/(pages)/analytics/components/AnalyticsDashboard.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnalyticsData, AnalyticsFilters } from '@/types';
import FilterPanel from './FilterPanel';
import TrendsChart from './TrendsChart';
import ExportButton from './ExportButton';

interface Props {
  initialData: AnalyticsData;
  initialFilters: AnalyticsFilters;
}

export default function AnalyticsDashboard({ initialData, initialFilters }: Props) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState(initialFilters);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);

    // Update URL search params
    const params = new URLSearchParams();
    params.set('start', newFilters.dateRange.start.toISOString().split('T')[0]);
    params.set('end', newFilters.dateRange.end.toISOString().split('T')[0]);
    if (newFilters.voiceAgentIds?.length) {
      params.set('agents', newFilters.voiceAgentIds.join(','));
    }

    startTransition(() => {
      router.push(`/analytics?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-6">
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        disabled={isPending}
      />

      <div className="grid gap-6">
        <TrendsChart data={data.trends} loading={isPending} />
        <ExportButton filters={filters} />
      </div>
    </div>
  );
}
```

**Component Testing with React Testing Library:**

```jsx
// tests/features/voice-agent-analytics/components.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'bun:test';
import AnalyticsDashboard from '@/app/(pages)/analytics/components/AnalyticsDashboard';

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams())
}));

const mockAnalyticsData = {
  summary: {
    totalCalls: 150,
    successRate: 0.85,
    avgDuration: 180
  },
  trends: [
    { period: '2024-01-01', calls: 25, successRate: 0.8, avgDuration: 170 },
    { period: '2024-01-02', calls: 30, successRate: 0.9, avgDuration: 190 }
  ]
};

const mockFilters = {
  dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
  periodType: 'daily' as const
};

describe('AnalyticsDashboard Component', () => {
  it('renders analytics data correctly', () => {
    render(
      <AnalyticsDashboard
        initialData={mockAnalyticsData}
        initialFilters={mockFilters}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument(); // Total calls
    expect(screen.getByText('85%')).toBeInTheDocument(); // Success rate
  });

  it('updates filters when date range changes', async () => {
    const mockRouterPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush });

    render(
      <AnalyticsDashboard
        initialData={mockAnalyticsData}
        initialFilters={mockFilters}
      />
    );

    // Simulate date picker change
    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining('start=2024-02-01')
      );
    });
  });

  it('shows loading state during filter updates', () => {
    render(
      <AnalyticsDashboard
        initialData={mockAnalyticsData}
        initialFilters={mockFilters}
      />
    );

    // Filter inputs should be disabled during pending state
    // This would be tested based on the actual implementation
  });
});

// Run component tests: bun test tests/features/voice-agent-analytics/components.test.tsx
```

## Phase 3: Comprehensive Testing Strategy

### Step 3.1: End-to-End Testing with Playwright

**Install and setup E2E testing:**

```bash
# Install Playwright
bun add -D @playwright/test

# Initialize Playwright
bunx playwright install

# Create E2E test structure
mkdir -p tests/e2e/features/voice-agent-analytics
touch tests/e2e/features/voice-agent-analytics/analytics-flow.spec.ts
touch playwright.config.ts
```

**Configure Playwright:**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Write E2E tests:**

```typescript
// tests/e2e/features/voice-agent-analytics/analytics-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Voice Agent Analytics', () => {
  test.beforeEach(async ({ page }) => {
    // Login flow (mock or real auth)
    await page.goto('/sign-in');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');
    await page.waitForURL('/');
  });

  test('should display analytics dashboard with data', async ({ page }) => {
    await page.goto('/analytics');

    // Wait for analytics to load
    await page.waitForSelector('[data-testid="analytics-summary"]');

    // Check summary cards are visible
    await expect(page.locator('[data-testid="total-calls"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-duration"]')).toBeVisible();

    // Check charts are rendered
    await expect(page.locator('[data-testid="trends-chart"]')).toBeVisible();
  });

  test('should filter analytics by date range', async ({ page }) => {
    await page.goto('/analytics');

    // Open date filter
    await page.click('[data-testid="date-filter-trigger"]');

    // Select last 7 days
    await page.click('[data-testid="last-7-days"]');

    // Wait for URL to update
    await page.waitForURL('**/analytics?start=*&end=*');

    // Verify data updated
    await expect(page.locator('[data-testid="analytics-summary"]')).toBeVisible();
  });

  test('should export analytics data', async ({ page }) => {
    await page.goto('/analytics');

    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('analytics');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});

// Run E2E tests: bunx playwright test tests/e2e/features/voice-agent-analytics/
```

### Step 3.2: Performance Testing

**Create performance test script:**

```typescript
// tests/performance/analytics-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Analytics Performance', () => {
  test('should load analytics page within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/analytics');
    await page.waitForSelector('[data-testid="analytics-summary"]');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // 2 seconds
  });

  test('should handle large datasets efficiently', async ({ page, context }) => {
    // Mock large dataset API response
    await context.route('**/api/analytics*', route => {
      const largeDataset = {
        summary: { totalCalls: 10000, successRate: 0.85, avgDuration: 180 },
        trends: Array.from({ length: 365 }, (_, i) => ({
          period: `2024-01-${String(i + 1).padStart(2, '0')}`,
          calls: Math.floor(Math.random() * 100),
          successRate: Math.random(),
          avgDuration: Math.floor(Math.random() * 300)
        }))
      };
      route.fulfill({ json: largeDataset });
    });

    const startTime = Date.now();
    await page.goto('/analytics');
    await page.waitForSelector('[data-testid="trends-chart"]');

    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(3000); // 3 seconds for large datasets
  });
});

// Run performance tests: bunx playwright test tests/performance/
```

### Step 3.3: Integration Testing with Database

**Test with real database using development branch:**

```bash
# Create integration test that uses real database
mkdir -p tests/integration/features/voice-agent-analytics
touch tests/integration/features/voice-agent-analytics/database-integration.test.ts
```

```typescript
// tests/integration/features/voice-agent-analytics/database-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@/db';
import { voiceAgentAnalytics } from '@/db/schema';
import { getVoiceAgentAnalytics } from '@/actions/analytics';

// This test runs against the development database
describe('Analytics Integration Tests', () => {
  let testUserId: string;
  let testAgentId: string;

  beforeAll(async () => {
    // Create test data
    testUserId = 'test-user-integration';
    testAgentId = 'test-agent-integration';

    await db.insert(voiceAgentAnalytics).values({
      userId: testUserId,
      voiceAgentId: testAgentId,
      totalCalls: 50,
      successfulCalls: 42,
      avgDurationSeconds: 180,
      periodType: 'daily',
      periodStart: new Date('2024-01-15'),
      periodEnd: new Date('2024-01-16')
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(voiceAgentAnalytics)
      .where(eq(voiceAgentAnalytics.userId, testUserId));
  });

  it('should retrieve analytics data from database', async () => {
    // Mock current user
    vi.mock('@clerk/nextjs/server', () => ({
      currentUser: vi.fn().mockResolvedValue({ id: testUserId })
    }));

    const filters = {
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      },
      periodType: 'daily' as const
    };

    const result = await getVoiceAgentAnalytics(filters);

    expect(result.summary.totalCalls).toBe(50);
    expect(result.summary.successRate).toBeCloseTo(0.84);
    expect(result.trends).toHaveLength(1);
  });
});

// Run integration tests: bun test tests/integration/ --timeout 10000
```

## Phase 4: CLI Automation & Development Tools

### Step 4.1: Feature Development CLI Scripts

**Create development automation scripts:**

```bash
# Create scripts directory
mkdir -p scripts/features
touch scripts/features/create-feature.sh
touch scripts/features/test-feature.sh
touch scripts/features/deploy-feature.sh
chmod +x scripts/features/*.sh
```

**Feature creation script:**

```bash
#!/bin/bash
# scripts/features/create-feature.sh

set -e

FEATURE_NAME=$1
if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./scripts/features/create-feature.sh <feature-name>"
  exit 1
fi

echo "🚀 Creating feature: $FEATURE_NAME"

# Create feature branch
git checkout -b "feature/$FEATURE_NAME"

# Create directory structure
mkdir -p "src/app/(pages)/$FEATURE_NAME/components"
mkdir -p "src/actions"
mkdir -p "tests/features/$FEATURE_NAME"
mkdir -p "tests/e2e/features/$FEATURE_NAME"
mkdir -p "docs/features/$FEATURE_NAME"

# Create initial files
touch "src/app/(pages)/$FEATURE_NAME/page.tsx"
touch "src/actions/$FEATURE_NAME.ts"
touch "tests/features/$FEATURE_NAME/unit.test.ts"
touch "tests/features/$FEATURE_NAME/integration.test.ts"
touch "tests/e2e/features/$FEATURE_NAME/e2e.spec.ts"
touch "docs/features/$FEATURE_NAME/requirements.md"

echo "✅ Feature structure created for: $FEATURE_NAME"
echo "📁 Next steps:"
echo "   1. Edit docs/features/$FEATURE_NAME/requirements.md"
echo "   2. Define database schema changes"
echo "   3. Write tests first (TDD)"
echo "   4. Implement server actions"
echo "   5. Build UI components"

# Usage: ./scripts/features/create-feature.sh voice-agent-analytics
```

**Feature testing script:**

```bash
#!/bin/bash
# scripts/features/test-feature.sh

set -e

FEATURE_NAME=$1
if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./scripts/features/test-feature.sh <feature-name>"
  exit 1
fi

echo "🧪 Testing feature: $FEATURE_NAME"

# Type checking
echo "📋 Type checking..."
bun run check

# Unit tests
echo "🔬 Running unit tests..."
bun test "tests/features/$FEATURE_NAME" --reporter=verbose

# Integration tests
echo "🔗 Running integration tests..."
bun test "tests/integration/features/$FEATURE_NAME" --timeout 10000

# Component tests
echo "⚛️ Running component tests..."
bun test "tests/features/$FEATURE_NAME" --grep "Component"

# Build verification
echo "🏗️ Build verification..."
bun run build

# E2E tests (optional - comment out for faster feedback)
# echo "🌐 Running E2E tests..."
# bunx playwright test "tests/e2e/features/$FEATURE_NAME"

echo "✅ All tests passed for: $FEATURE_NAME"

# Usage: ./scripts/features/test-feature.sh voice-agent-analytics
```

### Step 4.2: Database Testing CLI

**Database testing and validation script:**

```bash
#!/bin/bash
# scripts/db/test-schema.sh

set -e

echo "🗄️ Testing database schema..."

# Generate migration (dry run)
echo "📋 Generating migration..."
bun db:generate --name "test-migration"

# Apply to development database
echo "🔄 Applying to development database..."
bun db:dev:push

# Test schema with sample data
echo "🧪 Testing schema with sample data..."
cat << 'EOF' | bun run scripts/db/test-queries.ts
-- Test script that runs sample queries
-- This would be a TypeScript file that imports MCP Neon tools

import { mcp_Neon_run_sql } from '@/tools/neon';

// Test data insertion
await mcp_Neon_run_sql({
  projectId: 'square-unit-96831934',
  branchId: 'br-blue-frog-a6npin6j',
  sql: `
    INSERT INTO voice_agent_analytics (
      user_id, voice_agent_id, total_calls, successful_calls,
      period_type, period_start, period_end
    ) VALUES (
      'test-user', 'test-agent', 10, 8,
      'daily', '2024-01-01', '2024-01-02'
    )
    RETURNING *;
  `
});

// Test query performance
await mcp_Neon_run_sql({
  projectId: 'square-unit-96831934',
  branchId: 'br-blue-frog-a6npin6j',
  sql: `
    EXPLAIN ANALYZE
    SELECT * FROM voice_agent_analytics
    WHERE user_id = 'test-user'
    AND period_start >= '2024-01-01'
    ORDER BY period_start DESC;
  `
});
EOF

echo "✅ Database schema tests completed"

# Usage: ./scripts/db/test-schema.sh
```

### Step 4.3: Automated Quality Checks

**Pre-commit quality script:**

```bash
#!/bin/bash
# scripts/quality/pre-commit.sh

set -e

echo "🔍 Running quality checks..."

# Linting
echo "📋 Linting code..."
bun run lint --fix

# Type checking
echo "🔤 Type checking..."
bun run check

# Unit tests
echo "🧪 Running unit tests..."
bun test --run

# Security audit
echo "🔒 Security audit..."
bun audit

# Bundle size check
echo "📦 Checking bundle size..."
bun run build
BUNDLE_SIZE=$(du -sh .next | cut -f1)
echo "Bundle size: $BUNDLE_SIZE"

# Performance budget check (example)
if [[ "$BUNDLE_SIZE" > "10M" ]]; then
  echo "⚠️ Warning: Bundle size exceeds 10MB limit for Cloudflare Workers"
  exit 1
fi

echo "✅ All quality checks passed"

# Setup as git hook:
# ln -sf ../../scripts/quality/pre-commit.sh .git/hooks/pre-commit
```

## Phase 5: Deployment & Monitoring

### Step 5.1: Staging Deployment

```bash
#!/bin/bash
# scripts/deploy/staging.sh

set -e

echo "🚀 Deploying to staging..."

# Run all tests first
./scripts/features/test-feature.sh $1

# Build for production
bun run build

# Deploy to Cloudflare Workers (staging)
bunx wrangler deploy --env staging

# Run smoke tests against staging
echo "💨 Running smoke tests..."
STAGING_URL="https://staging.icephone.com" bunx playwright test tests/e2e/smoke/

# Migration to staging database (if needed)
if [ -n "$2" ] && [ "$2" = "--migrate" ]; then
  echo "🗄️ Running database migrations on staging..."
  bun db:staging:push
fi

echo "✅ Staging deployment completed"
echo "🌐 Staging URL: https://staging.icephone.com"

# Usage: ./scripts/deploy/staging.sh voice-agent-analytics --migrate
```

### Step 5.2: Production Deployment

```bash
#!/bin/bash
# scripts/deploy/production.sh

set -e

echo "🚀 Deploying to production..."

# Verify staging tests pass
echo "🧪 Verifying staging tests..."
STAGING_URL="https://staging.icephone.com" bunx playwright test tests/e2e/critical/

# Database migration (production)
echo "🗄️ Running production database migrations..."
bun db:prod:push

# Deploy to production
echo "📦 Deploying to production..."
bunx wrangler deploy --env production

# Post-deployment verification
echo "✅ Running post-deployment verification..."
PROD_URL="https://icephone.com" bunx playwright test tests/e2e/smoke/

# Performance monitoring
echo "📊 Starting performance monitoring..."
bunx lighthouse https://icephone.com/analytics --output json --output-path reports/lighthouse-$(date +%Y%m%d).json

echo "✅ Production deployment completed"
echo "🌐 Production URL: https://icephone.com"

# Usage: ./scripts/deploy/production.sh
```

## Complete CLI Workflow Example

### Real-World Feature Implementation

Here's how to use all these tools together to implement the Voice Agent Analytics feature:

```bash
# 1. Create the feature structure
./scripts/features/create-feature.sh voice-agent-analytics

# 2. Edit requirements (manual step)
code docs/features/voice-agent-analytics/requirements.md

# 3. Test database schema
./scripts/db/test-schema.sh

# 4. Run comprehensive testing
./scripts/features/test-feature.sh voice-agent-analytics

# 5. Quality checks before commit
./scripts/quality/pre-commit.sh

# 6. Deploy to staging
./scripts/deploy/staging.sh voice-agent-analytics --migrate

# 7. Deploy to production (after testing)
./scripts/deploy/production.sh
```

### Continuous Integration Setup

**GitHub Actions workflow:**

```yaml
# .github/workflows/feature-pipeline.yml
name: Feature Pipeline

on:
  push:
    branches: [ feature/* ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Type checking
        run: bun run check

      - name: Unit tests
        run: bun test --coverage

      - name: Build verification
        run: bun run build

      - name: E2E tests
        run: |
          bunx playwright install
          bunx playwright test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Deploy to staging
        run: ./scripts/deploy/staging.sh
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Quick Reference Commands

### Daily Development Commands

```bash
# Start development with testing
bun dev & bun test --watch

# Quick feature test
./scripts/features/test-feature.sh <feature-name>

# Database testing
./scripts/db/test-schema.sh

# Quality check before commit
./scripts/quality/pre-commit.sh

# Check build size
bun run build && du -sh .next

# Performance testing
bunx lighthouse http://localhost:3000 --output json
```

### Database Operations

```bash
# Apply schema changes to development
bun db:dev:push

# Generate new migration
bun db:generate --name "feature-name"

# Reset development database
bun db:dev:reset

# Test with MCP Neon tools (interactive)
bun run scripts/db/interactive-test.ts
```

### Testing Commands

```bash
# Run all tests for a feature
bun test tests/features/feature-name/

# Run E2E tests only
bunx playwright test tests/e2e/features/feature-name/

# Run integration tests
bun test tests/integration/ --timeout 10000

# Performance tests
bunx playwright test tests/performance/

# Coverage report
bun test --coverage --coverage-reporter=html
```

## Key Takeaways for Feature Implementation

### From Single Sentence to Production

1. **Start with Questions**: Break down the feature request into specific requirements
2. **Design Data First**: Database schema drives the entire feature architecture
3. **Test-Driven Development**: Write tests before implementation
4. **Automate Everything**: Use CLI scripts for consistent workflows
5. **Quality Gates**: Never skip type checking, linting, and testing
6. **Performance First**: Monitor bundle size and load times from day one
7. **Security by Default**: Always implement proper authentication and authorization

### Essential Tools & Commands

| Phase | Tool | Command |
|-------|------|---------|
| **Setup** | Feature Creation | `./scripts/features/create-feature.sh <name>` |
| **Database** | Schema Testing | `./scripts/db/test-schema.sh` |
| **Development** | Feature Testing | `./scripts/features/test-feature.sh <name>` |
| **Quality** | Pre-commit Checks | `./scripts/quality/pre-commit.sh` |
| **Staging** | Staging Deploy | `./scripts/deploy/staging.sh <name>` |
| **Production** | Production Deploy | `./scripts/deploy/production.sh` |

### Success Metrics

Every feature should meet these criteria before production:

- ✅ **Type Safety**: No TypeScript errors (`bun run check`)
- ✅ **Test Coverage**: >80% test coverage for critical paths
- ✅ **Performance**: Page loads <2s, mobile responsive
- ✅ **Security**: Proper authentication and user isolation
- ✅ **Accessibility**: WCAG compliance for UI components
- ✅ **Bundle Size**: <10MB total for Cloudflare Workers
- ✅ **Database**: Proper indexing and query optimization
- ✅ **Monitoring**: Error tracking and performance monitoring set up

Remember: This systematic approach ensures every feature is production-ready, maintainable, and provides excellent user experience while maintaining the high standards expected for a business-critical CRM platform like IcePhone.

## Best Practices Checklist

### Before Starting Implementation

- [ ] **User Flow Mapped**: Clear understanding of user journey
- [ ] **Database Schema Designed**: All tables and relationships planned
- [ ] **API Endpoints Identified**: Know what server actions you need
- [ ] **Component Architecture**: Server vs Client components decided
- [ ] **Authentication Strategy**: User permissions and data isolation planned
- [ ] **Performance Considerations**: Caching, lazy loading, pagination
- [ ] **Mobile Responsiveness**: Design works on all screen sizes
- [ ] **Error Handling**: Plan for edge cases and failures

### During Implementation

- [ ] **Test Incrementally**: Test each piece before moving to next
- [ ] **Type Safety**: Use TypeScript throughout the stack
- [ ] **Security First**: Always validate user permissions
- [ ] **Performance Monitor**: Watch for N+1 queries and bundle size
- [ ] **Accessibility**: Follow WCAG guidelines
- [ ] **Code Quality**: Follow project conventions and linting rules

### Before Deployment

- [ ] **End-to-End Testing**: Complete user flows tested
- [ ] **Error Boundary**: Graceful error handling implemented
- [ ] **Loading States**: Good UX during data fetching
- [ ] **Performance Audit**: Page load times under 2 seconds
- [ ] **Security Review**: No sensitive data exposed
- [ ] **Mobile Testing**: Works on various device sizes

## Common Integration Patterns

### Pattern 1: CRUD with Real-time Updates

```typescript
// 1. Server action for mutations
export async function createVoiceAgent(data: VoiceAgentInput) {
  const user = await currentUser();
  const agent = await db.insert(voiceAgents).values({
    ...data,
    userId: user.id
  });

  // 2. Revalidate related pages
  revalidatePath('/agents');

  // 3. Background tasks
  after(async () => {
    await initializeAgentWebhooks(agent.id);
  });
}

// 4. Client component with optimistic updates
'use client';
function AgentForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (data) => {
    startTransition(async () => {
      await createVoiceAgent(data);
    });
  };
}
```

### Pattern 2: Complex Analytics with Caching

```typescript
// 1. Server component with ISR
async function AnalyticsDashboard() {
  const analytics = await fetch('/api/analytics', {
    next: { revalidate: 300 } // 5-minute cache
  });

  return <Dashboard data={analytics} />;
}

// 2. Background aggregation
export async function aggregateAnalytics() {
  const results = await db
    .select({
      date: sql`DATE(${calls.createdAt})`,
      count: count(),
      avgDuration: avg(calls.duration)
    })
    .from(calls)
    .groupBy(sql`DATE(${calls.createdAt})`);

  // Store aggregated results
  await db.insert(dailyAnalytics).values(results);
}
```

### Pattern 3: File Upload with Processing

```typescript
// 1. File upload endpoint
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // 2. Upload to R2
  const key = await uploadToR2(file);

  // 3. Background processing
  after(async () => {
    await processAudioFile(key);
    await generateTranscript(key);
  });
}
```

## Common Pitfalls to Avoid

### 1. Authentication Bypass

```typescript
// ❌ Never trust client-side user data
export async function getLeads(userId: string) {
  return db.query.leads.findMany({
    where: eq(leads.userId, userId) // Client could pass any userId
  });
}

// ✅ Always verify server-side
export async function getLeads() {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  return db.query.leads.findMany({
    where: eq(leads.userId, user.id)
  });
}
```

### 2. N+1 Query Problems

```typescript
// ❌ Will cause N+1 queries
const leads = await db.query.leads.findMany();
for (const lead of leads) {
  const calls = await db.query.calls.findMany({
    where: eq(calls.leadId, lead.id)
  });
}

// ✅ Use relations or joins
const leads = await db.query.leads.findMany({
  with: {
    calls: true
  }
});
```

### 3. Client/Server Boundary Issues

```typescript
// ❌ Server code in client component
'use client';
function LeadsList() {
  const leads = await db.query.leads.findMany(); // Error!
}

// ✅ Pass data from server component
async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsList leads={leads} />;
}
```

## Testing Strategy

### Unit Testing

```typescript
// Test server actions
describe('createLead', () => {
  it('should create lead with proper user isolation', async () => {
    mockCurrentUser({ id: 'user-1' });
    const lead = await createLead({ name: 'Test Lead' });
    expect(lead.userId).toBe('user-1');
  });
});
```

### Integration Testing

```typescript
// Test complete flows
describe('Lead Creation Flow', () => {
  it('should create lead and redirect to detail page', async () => {
    render(<LeadForm />);
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Lead' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/leads/new-id');
    });
  });
});
```

## Key Takeaways for Feature Planning

1. **Start with Data**: Design your database schema first
2. **Think Full-Stack**: Consider every layer of the application
3. **Security by Default**: Always implement proper user isolation
4. **Performance First**: Plan for caching and optimization
5. **Test Incrementally**: Don't build everything before testing
6. **Mobile Responsive**: Design for all screen sizes from the start
7. **Error Handling**: Plan for failures and edge cases
8. **User Experience**: Focus on fast, intuitive interactions

Remember: IcePhone is a business-critical CRM platform. Every feature should maintain high standards for security, performance, and reliability while providing an excellent user experience.
