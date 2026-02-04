# Better-Auth Implementation Guide

## Overview

This document provides a comprehensive analysis of the authentication system in the Kidsway eCommerce platform, which uses **better-auth v1.4.1** for email/password authentication with session-based auth, role-based access control (customer, supplier, admin), and seamless integration with Next.js 16 App Router. The implementation includes features like password reset via email, supplier onboarding with invitation tokens, and rolling sessions with 7-day expiration.

---

## 1. Better-Auth Configuration and Initialization

### Server-Side Configuration

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/lib/auth.ts`

The server-side auth instance is created using `betterAuth()` with the Drizzle adapter for PostgreSQL:

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { nanoid } from 'nanoid';
import { getResendClient } from '@/lib/resend';

export const auth = betterAuth({
  // Custom ID generation using nanoid (21 characters)
  advanced: {
    database: {
      generateId: () => nanoid(21),
    },
  },

  // Drizzle adapter with PostgreSQL
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // Additional user fields (role, locale, phone)
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'customer',
        input: false, // Don't allow role to be set during signup
      },
      locale: {
        type: 'string',
        required: false,
        defaultValue: 'en',
      },
      phone: {
        type: 'string',
        required: false,
      },
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    disableSignUp: process.env.NEXT_PUBLIC_NON_PAYMENT_DISABLED === 'true',
    sendResetPassword: async ({ user, url }) => {
      const resend = getResendClient();
      await resend.emails.send({
        from: 'Kidsway <kidsway@notifications.agentdune.com>',
        to: user.email,
        subject: 'Reset your password',
        html: `...`, // HTML email template
      });
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (rolling session)
  },

  // Auth configuration
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    'http://localhost:3000',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
  ].filter(Boolean),
});

// Type exports for session and user
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

### Key Configuration Options

| Option | Value | Description |
|--------|-------|-------------|
| `session.expiresIn` | 7 days | Session expiration time |
| `session.updateAge` | 1 day | Rolling session update interval |
| `emailAndPassword.enabled` | true | Enable email/password auth |
| `emailAndPassword.requireEmailVerification` | false | Email verification not required |
| `user.additionalFields.role.input` | false | Prevent role from being set during signup |

---

## 2. Client-Side Auth Configuration

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/lib/auth-client.ts`

The client-side auth client is created with automatic baseURL detection:

```typescript
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000',
});
```

### Client Methods Used

| Method | Description | File Location |
|--------|-------------|---------------|
| `authClient.signIn.email()` | Sign in with email/password | `src/components/sign-in-form.tsx:26` |
| `authClient.signUp.email()` | Sign up with email/password | `src/components/sign-up-form.tsx:25` |
| `authClient.getSession()` | Get current session | `src/components/sign-in-form.tsx:38` |
| `authClient.signOut()` | Sign out user | `src/components/admin/admin-header.tsx:41` |
| `authClient.requestPasswordReset()` | Request password reset email | `src/components/forgot-password-dialog.tsx:34` |
| `authClient.resetPassword()` | Reset password with token | `src/components/reset-password-form.tsx:59` |
| `authClient.changePassword()` | Change password (authenticated) | `src/components/customer/profile/change-password-form.tsx:47` |

---

## 3. API Route Handler

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/api/auth/[...all]/route.ts`

Better-auth uses a catch-all route to handle all auth-related API requests:

```typescript
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  return auth.handler(request);
}

export async function POST(request: Request) {
  return auth.handler(request);
}
```

### Routes Handled Internally

- `POST /api/auth/sign-in/email` - Email sign in
- `POST /api/auth/sign-up/email` - Email sign up
- `POST /api/auth/sign-out` - Sign out
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/session` - Get session

---

## 4. Database Schema (Auth Tables)

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/db/schema.ts` (lines 40-99)

### Users Table

```typescript
export const users = pgTable('users', {
  id: varchar('id', { length: 21 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('customer'),
  locale: varchar('locale', { length: 5 }).default('en'),
  phone: varchar('phone', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Sessions Table

```typescript
export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 21 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Accounts Table

```typescript
export const accounts = pgTable('accounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 21 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'), // Hashed password for email/password auth
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Verifications Table

```typescript
export const verifications = pgTable('verifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
});
```

### User Roles Enum

```typescript
export const userRoleEnum = pgEnum('user_role', ['customer', 'supplier', 'admin']);
```

---

## 5. Middleware and Route Protection

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/middleware.ts`

The middleware checks for session cookies on protected routes:

```typescript
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n for API routes
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Apply i18n middleware first
  const response = intlMiddleware(request);

  // Remove locale prefix for route checking
  const pathnameWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';

  // Allow public access to supplier onboarding (token-based auth)
  const isSupplierOnboarding = pathnameWithoutLocale.startsWith('/supplier/onboard');

  // Define protected routes
  const isProtectedRoute =
    (pathnameWithoutLocale.startsWith('/admin') ||
    pathnameWithoutLocale.startsWith('/supplier') ||
    pathnameWithoutLocale.startsWith('/account')) &&
    !isSupplierOnboarding;

  if (isProtectedRoute) {
    // Better Auth uses different cookie names in production vs development
    const sessionToken =
      request.cookies.get('__Secure-better-auth.session_token') ??
      request.cookies.get('better-auth.session_token');

    if (!sessionToken) {
      const url = request.nextUrl.clone();
      const locale = pathname.match(/^\/(en|ar)/)?.[1] || 'en';
      url.pathname = `/${locale}/sign-in`;
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}
```

### Session Cookie Names

| Environment | Cookie Name |
|-------------|-------------|
| Production | `__Secure-better-auth.session_token` |
| Development | `better-auth.session_token` |

---

## 6. Session Management in Server Components

### Getting Session in Server Components/Actions

**Pattern used across the codebase:**

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// In a Server Component or Server Action
const session = await auth.api.getSession({
  headers: await headers(),
});

if (!session) {
  redirect('/sign-in');
}

// Access user data
const userId = session.user.id;
const userRole = session.user.role;
```

### Example: Admin Layout Protection

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/[locale]/(admin)/layout.tsx`

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;

  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect to login if no session
  if (!session) {
    redirect(`/${locale}/sign-in?callbackUrl=/${locale}/admin`);
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${locale}`);
  }

  return <>{children}</>;
}
```

### Example: Supplier Layout Protection

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/[locale]/(supplier)/layout.tsx`

```typescript
// Check if user has supplier or admin role
if (session.user.role !== 'supplier' && session.user.role !== 'admin') {
  redirect(`/${locale}`);
}
```

---

## 7. Sign-Up Flow Implementation

### Sign-Up Page

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/[locale]/(auth)/sign-up/page.tsx`

```typescript
export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // Redirect if disabled due to non-payment
  if (process.env.NEXT_PUBLIC_NON_PAYMENT_DISABLED === 'true') {
    redirect(`/${locale}/sign-up-disabled`);
  }

  // Redirect if already authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect(`/${locale}`);
  }

  return <SignUpForm />;
}
```

### Sign-Up Form

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/sign-up-form.tsx`

```typescript
'use client';

import { authClient } from '@/lib/auth-client';

export function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authClient.signUp.email({
      email,
      password,
      name,
    });

    if (result.error) {
      setError(result.error.message || 'An error occurred during sign up');
      setIsLoading(false);
      return;
    }

    // Success - redirect to home
    router.push('/');
  };

  // ... form JSX
}
```

---

## 8. Sign-In Flow Implementation

### Sign-In Page

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/[locale]/(auth)/sign-in/page.tsx`

```typescript
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;

  // Redirect if already authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect(callbackUrl || `/${locale}`);
  }

  return <SignInForm />;
}
```

### Sign-In Form

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/sign-in-form.tsx`

```typescript
'use client';

import { authClient } from '@/lib/auth-client';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message || 'Invalid email or password');
      setIsLoading(false);
      return;
    }

    // Fetch session to get full user data including role
    const session = await authClient.getSession();
    const userRole = (session.data?.user as { role?: string } | undefined)?.role;

    // Role-based redirect
    if (userRole === 'supplier') {
      router.push('/supplier');
      return;
    }

    // Regular customers - redirect to callback URL or home
    const rawCallbackUrl = searchParams.get('callbackUrl') || '/';
    const callbackUrl = rawCallbackUrl.replace(/^\/(en|ar)/, '') || '/';
    router.push(callbackUrl);
  };

  // ... form JSX
}
```

---

## 9. Password Reset Flow

### Forgot Password Dialog

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/forgot-password-dialog.tsx`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setIsLoading(true);

  try {
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });

    if (result.error) {
      setError(result.error.message || t('resetPasswordError'));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
  } catch {
    setError(t('resetPasswordError'));
  } finally {
    setIsLoading(false);
  }
};
```

### Reset Password Form

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/reset-password-form.tsx`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  if (password !== confirmPassword) {
    setError(t('passwordsDoNotMatch'));
    return;
  }

  if (password.length < 8) {
    setError(t('passwordTooShort'));
    return;
  }

  setIsLoading(true);

  try {
    const result = await authClient.resetPassword({
      newPassword: password,
      token, // From URL search params
    });

    if (result.error) {
      setError(result.error.message || t('resetPasswordError'));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/sign-in');
    }, 3000);
  } catch {
    setError(t('resetPasswordError'));
  } finally {
    setIsLoading(false);
  }
};
```

---

## 10. Change Password (Authenticated Users)

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/customer/profile/change-password-form.tsx`

```typescript
const onSubmit = async (data: ChangePasswordFormData) => {
  setSuccess(false);
  startTransition(async () => {
    try {
      const result = await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (result.error) {
        if (result.error.message?.includes('incorrect')) {
          toast.error(t('incorrectPassword'));
        } else {
          toast.error(result.error.message || t('passwordChangeError'));
        }
        return;
      }

      setSuccess(true);
      reset();
      toast.success(t('passwordChanged'));
    } catch {
      toast.error(t('passwordChangeError'));
    }
  });
};
```

---

## 11. Sign Out Implementation

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/admin/admin-header.tsx` (lines 40-49)

```typescript
const handleLogout = async () => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        router.push('/');
        router.refresh();
      },
    },
  });
};
```

---

## 12. Role-Based Access Control

### User Roles

```typescript
// Defined in schema.ts:23
export const userRoleEnum = pgEnum('user_role', ['customer', 'supplier', 'admin']);
```

### Role Checking in Server Actions

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/actions/admin/suppliers.ts` (lines 99-111)

```typescript
async function validateAdminRole(): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== 'admin') {
    return false;
  }

  return true;
}
```

### Protected Routes by Role

| Route Pattern | Required Role(s) |
|---------------|------------------|
| `/admin/*` | `admin` |
| `/supplier/*` | `supplier` or `admin` |
| `/account/*` | Any authenticated user |

---

## 13. Supplier Onboarding Flow (Special Case)

Suppliers are invited by admins and complete their account setup via a token-based flow.

### Server Action

**File:** `/Users/ashray/code/amxv/kidsway-ai-demo/src/actions/supplier/onboarding.ts`

```typescript
export async function completeSupplierOnboarding(
  input: CompleteOnboardingInput
): Promise<OnboardingResult> {
  const { token, email, password, companyName, phone } = input;

  // Validate invitation token
  const invitation = await db
    .select()
    .from(supplierInvitations)
    .where(
      and(
        eq(supplierInvitations.token, token),
        eq(supplierInvitations.email, email.toLowerCase()),
        isNull(supplierInvitations.usedAt),
        gt(supplierInvitations.expiresAt, new Date())
      )
    )
    .limit(1);

  // Hash password using better-auth's internal method
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  // Create user with supplier role
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name: companyName,
    phone: phone || null,
    role: 'supplier',
    emailVerified: true,
    locale: 'en',
  });

  // Create account with password
  await db.insert(accounts).values({
    id: accountId,
    userId: userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
  });

  // Create session manually
  const sessionToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: nanoid(),
    userId: userId,
    token: sessionToken,
    expiresAt: expiresAt,
  });

  // Set session cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token';

  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { success: true };
}
```

---

## 14. Password Hashing

Better-auth provides internal methods for password hashing that can be accessed via the auth context:

```typescript
// Hash a password
const ctx = await auth.$context;
const hashedPassword = await ctx.password.hash(password);

// Alternative using the crypto export (for scripts)
import { hashPassword } from 'better-auth/crypto';
const hashedPassword = await hashPassword(plainPassword);
```

---

## 15. Environment Variables Required

```env
# Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-domain.com

# Feature Flags
NEXT_PUBLIC_NON_PAYMENT_DISABLED=false  # Set to 'true' to disable sign-up

# Vercel (auto-set)
VERCEL_URL=your-app.vercel.app
VERCEL_BRANCH_URL=your-branch.vercel.app
```

---

## 16. File Reference Summary

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Server-side auth configuration |
| `src/lib/auth-client.ts` | Client-side auth client |
| `src/app/api/auth/[...all]/route.ts` | Auth API route handler |
| `src/middleware.ts` | Route protection middleware |
| `src/db/schema.ts` | Database schema (users, sessions, accounts, verifications) |
| `src/components/sign-in-form.tsx` | Sign-in form component |
| `src/components/sign-up-form.tsx` | Sign-up form component |
| `src/components/forgot-password-dialog.tsx` | Password reset request dialog |
| `src/components/reset-password-form.tsx` | Password reset form |
| `src/components/customer/profile/change-password-form.tsx` | Change password form |
| `src/components/supplier-onboard-form.tsx` | Supplier onboarding form |
| `src/actions/supplier/onboarding.ts` | Supplier onboarding server action |
| `src/app/[locale]/(admin)/layout.tsx` | Admin layout with role protection |
| `src/app/[locale]/(supplier)/layout.tsx` | Supplier layout with role protection |
| `src/app/[locale]/(storefront)/layout.tsx` | Storefront layout (optional auth) |

---

## 17. Implementation Checklist for New Projects

1. **Install Dependencies**
   ```bash
   bun add better-auth nanoid
   ```

2. **Create Auth Configuration** (`src/lib/auth.ts`)
   - Configure `betterAuth()` with your database adapter
   - Set up email/password authentication
   - Configure session settings
   - Add any additional user fields

3. **Create Auth Client** (`src/lib/auth-client.ts`)
   - Create client-side auth instance with `createAuthClient()`

4. **Create API Route** (`src/app/api/auth/[...all]/route.ts`)
   - Set up catch-all route with `auth.handler()`

5. **Create Database Tables**
   - `users` - User accounts
   - `sessions` - Active sessions
   - `accounts` - Auth providers (including password)
   - `verifications` - Email verification tokens

6. **Add Middleware** (`src/middleware.ts`)
   - Check for session cookies on protected routes
   - Handle different cookie names in production vs development

7. **Create Auth UI Components**
   - Sign-in form
   - Sign-up form
   - Forgot password dialog
   - Reset password form
   - Change password form

8. **Protect Routes**
   - Use `auth.api.getSession()` in server components/actions
   - Check user roles for role-based access

9. **Set Environment Variables**
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - `NEXT_PUBLIC_BETTER_AUTH_URL`

---

## 18. Key Patterns and Best Practices

1. **Always use `await headers()`** when calling `auth.api.getSession()` in server components
2. **Check both cookie names** in middleware (production uses `__Secure-` prefix)
3. **Use `input: false`** for fields like `role` that shouldn't be set during signup
4. **Handle callback URLs** to redirect users back after authentication
5. **Use role-based redirects** after sign-in (e.g., suppliers to `/supplier`)
6. **Create sessions manually** when onboarding users through invitation flows
7. **Use `auth.$context.password.hash()`** for consistent password hashing

---

*Generated: 2026-01-08*
