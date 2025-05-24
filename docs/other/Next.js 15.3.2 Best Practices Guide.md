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
