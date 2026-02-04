# Resend Email Service Integration for Next.js

A comprehensive guide for integrating Resend email service into any Next.js project, based on patterns from a production e-commerce application.

## Overview

This guide covers integrating Resend email service using:
- **Singleton pattern** for the client instance
- **HTML string templates** for email content
- **Bilingual support** (EN/AR with RTL layout switching)
- **Server actions** for sending emails

No React Email components are used - all templates are pure HTML strings for maximum compatibility.

---

## 1. Setup and Configuration

### Install Package

```bash
bun add resend
# or
npm install resend
# or
pnpm add resend
```

### Environment Variables

Add to `.env.local`:

```bash
RESEND_API_KEY="re_your_api_key_here"
```

> Get your API key from [resend.com/api-keys](https://resend.com/api-keys)

### Create Resend Client (Singleton)

Create `src/lib/resend.ts`:

```typescript
import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not defined');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}
```

**Why singleton?** Reuses the Resend client instance across requests, avoiding multiple instantiations in serverless environments.

---

## 2. Email Templates

### Template Structure Pattern

All templates follow this consistent pattern:

1. Accept a props interface with optional `locale` parameter
2. Return `{ subject: string; html: string }` object
3. Support multiple languages with RTL layout switching
4. Use inline CSS for email client compatibility

### Example: User Invitation Email

Create `src/lib/email-templates/user-invitation.ts`:

```typescript
interface UserInvitationEmailProps {
  inviteUrl: string;
  inviterName: string;
  locale?: 'en' | 'ar';
}

export function getUserInvitationEmail({
  inviteUrl,
  inviterName,
  locale = 'en',
}: UserInvitationEmailProps): { subject: string; html: string } {
  const isArabic = locale === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';

  const content = isArabic
    ? {
        subject: 'دعوة للانضمام',
        title: 'لقد تمت دعوتك!',
        intro: `${inviterName} دعاك للانضمام إلى منصتنا.`,
        cta: 'قبول الدعوة',
        expires: 'ستنتهي صلاحية هذا الرابط خلال 24 ساعة.',
        ignore: 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد.',
      }
    : {
        subject: 'You\'re Invited!',
        title: 'You\'ve Been Invited!',
        intro: `${inviterName} has invited you to join our platform.`,
        cta: 'Accept Invitation',
        expires: 'This link will expire in 24 hours.',
        ignore: 'If you weren\'t expecting this invitation, you can ignore this email.',
      };

  const html = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; direction: ${dir};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                ${content.title}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${content.intro}
              </p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 8px;">
                      ${content.cta}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
                ${content.expires}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                ${content.ignore}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject: content.subject, html };
}
```

### Example: Welcome Email

Create `src/lib/email-templates/welcome.ts`:

```typescript
interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
  locale?: 'en' | 'ar';
}

export function getWelcomeEmail({
  userName,
  loginUrl,
  locale = 'en',
}: WelcomeEmailProps): { subject: string; html: string } {
  const isArabic = locale === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';

  const content = isArabic
    ? {
        subject: 'مرحباً بك!',
        title: `مرحباً ${userName}!`,
        intro: 'شكراً لانضمامك إلينا. حسابك جاهز الآن.',
        steps: [
          'أكمل ملفك الشخصي',
          'استكشف المنصة',
          'ابدأ في استخدام الميزات',
        ],
        stepsTitle: 'الخطوات التالية:',
        cta: 'تسجيل الدخول',
        team: '— فريق العمل',
      }
    : {
        subject: 'Welcome!',
        title: `Welcome ${userName}!`,
        intro: 'Thank you for joining us. Your account is now ready.',
        steps: [
          'Complete your profile',
          'Explore the platform',
          'Start using features',
        ],
        stepsTitle: 'Next Steps:',
        cta: 'Sign In',
        team: '— The Team',
      };

  const stepsHtml = content.steps
    .map((step, i) => `<li style="margin-bottom: 8px; color: #3f3f46;">${i + 1}. ${step}</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; direction: ${dir};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background: #fff; border-radius: 12px;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; color: #18181b; font-size: 24px;">${content.title}</h1>
              <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">${content.intro}</p>

              <h3 style="margin: 0 0 12px; color: #18181b; font-size: 16px;">${content.stepsTitle}</h3>
              <ul style="margin: 0 0 32px; padding-${isArabic ? 'right' : 'left'}: 0; list-style: none;">
                ${stepsHtml}
              </ul>

              <table role="presentation" width="100%">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
                      ${content.cta}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 32px 0 0; color: #71717a; font-size: 14px;">${content.team}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject: content.subject, html };
}
```

### Example: Password Reset Email (Inline Template)

For simpler emails, you can define templates inline:

```typescript
const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Reset Your Password</h2>
  <p>Hi ${user.name || 'there'},</p>
  <p>We received a request to reset your password. Click the button below to create a new password:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Reset Password
    </a>
  </div>
  <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</p>
  <p style="color: #666; font-size: 14px;">— The Team</p>
</div>
`;
```

---

## 3. Server Actions

### Pattern 1: Critical Email (With Rollback)

Use when the email is essential to the operation - if it fails, undo the database change.

```typescript
'use server';

import { db } from '@/db';
import { invitations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getResendClient } from '@/lib/resend';
import { getUserInvitationEmail } from '@/lib/email-templates/user-invitation';

export async function inviteUser(email: string, inviterName: string) {
  // 1. Create database record first
  const [invitation] = await db
    .insert(invitations)
    .values({
      email,
      inviterName,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    })
    .returning();

  // 2. Generate invite URL
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;

  // 3. Send email
  const resend = getResendClient();
  const { subject, html } = getUserInvitationEmail({
    inviteUrl,
    inviterName,
    locale: 'en',
  });

  const { error: emailError } = await resend.emails.send({
    from: 'My App <noreply@verified-domain.com>',
    to: [email],
    subject,
    html,
  });

  // 4. If email fails, rollback database
  if (emailError) {
    console.error('Error sending invitation email:', emailError);
    await db.delete(invitations).where(eq(invitations.id, invitation.id));
    return { success: false, error: 'Failed to send invitation email' };
  }

  return { success: true, invitationId: invitation.id };
}
```

### Pattern 2: Non-Blocking Email (Best Effort)

Use when the email is supplementary - log errors but don't fail the main operation.

```typescript
'use server';

import { getResendClient } from '@/lib/resend';
import { getWelcomeEmail } from '@/lib/email-templates/welcome';

export async function completeRegistration(userId: string, email: string, name: string) {
  // ... main registration logic ...

  // Send welcome email (non-blocking - don't fail registration if email fails)
  try {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`;

    const resend = getResendClient();
    const { subject, html } = getWelcomeEmail({
      userName: name,
      loginUrl,
      locale: 'en',
    });

    await resend.emails.send({
      from: 'My App <noreply@verified-domain.com>',
      to: [email.toLowerCase()],
      subject,
      html,
    });
  } catch (emailError) {
    // Log error but don't fail the registration
    console.error('Error sending welcome email:', emailError);
  }

  return { success: true };
}
```

### Pattern 3: Auth Integration (better-auth callback)

When using better-auth, configure email callbacks:

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { getResendClient } from '@/lib/resend';

export const auth = betterAuth({
  // ... other config ...
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const resend = getResendClient();
      await resend.emails.send({
        from: 'My App <noreply@verified-domain.com>',
        to: user.email,
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          </div>
        `,
      });
    },
    // Optional: Email verification
    sendVerificationEmail: async ({ user, url }) => {
      const resend = getResendClient();
      await resend.emails.send({
        from: 'My App <noreply@verified-domain.com>',
        to: user.email,
        subject: 'Verify your email',
        html: `<a href="${url}">Verify Email</a>`,
      });
    },
  },
});
```

---

## 4. Frontend Usage

### Calling Server Actions from Components

```tsx
'use client';

import { useState } from 'react';
import { inviteUser } from '@/actions/invitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function InviteForm({ inviterName }: { inviterName: string }) {
  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    try {
      const result = await inviteUser(email, inviterName);

      if (result.success) {
        toast.success('Invitation sent!');
        setEmail('');
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send Invite'}
      </Button>
    </form>
  );
}
```

### Using with TanStack Query (React Query)

```tsx
'use client';

import { useMutation } from '@tanstack/react-query';
import { inviteUser } from '@/actions/invitations';
import { toast } from 'sonner';

export function useInviteUser() {
  return useMutation({
    mutationFn: ({ email, inviterName }: { email: string; inviterName: string }) =>
      inviteUser(email, inviterName),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Invitation sent!');
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    },
    onError: () => {
      toast.error('Something went wrong');
    },
  });
}

// Usage in component
function MyComponent() {
  const { mutate: invite, isPending } = useInviteUser();

  return (
    <Button
      onClick={() => invite({ email: 'user@example.com', inviterName: 'John' })}
      disabled={isPending}
    >
      Invite
    </Button>
  );
}
```

---

## 5. Email Sending API Reference

### Basic Send

```typescript
const { data, error } = await resend.emails.send({
  from: 'My App <noreply@verified-domain.com>',
  to: ['recipient@example.com'],
  subject: 'Email Subject',
  html: '<html>...</html>',
});
```

### With CC/BCC

```typescript
await resend.emails.send({
  from: 'My App <noreply@verified-domain.com>',
  to: ['main@example.com'],
  cc: ['cc@example.com'],
  bcc: ['bcc@example.com'],
  subject: 'Email Subject',
  html: '<html>...</html>',
});
```

### With Reply-To

```typescript
await resend.emails.send({
  from: 'My App <noreply@verified-domain.com>',
  to: ['recipient@example.com'],
  replyTo: 'support@example.com',
  subject: 'Email Subject',
  html: '<html>...</html>',
});
```

### Sender Address Format

```
'Display Name <email@verified-domain.com>'
```

> The domain must be verified in your Resend dashboard before sending.

---

## 6. Best Practices

### Email Template Guidelines

1. **Use inline CSS** - Most email clients strip `<style>` tags
2. **Use tables for layout** - Flexbox/Grid support is inconsistent
3. **Include plain text fallback** - For accessibility (optional with Resend)
4. **Test across clients** - Gmail, Outlook, Apple Mail render differently
5. **Keep images hosted externally** - Don't embed base64 images

### Error Handling Guidelines

| Scenario | Pattern | Example |
|----------|---------|---------|
| Email required for operation | Critical with rollback | Invitation, verification |
| Email is supplementary | Non-blocking | Welcome, notification |
| Auth-related emails | Auth callback | Password reset, verification |

### Security Considerations

1. **Validate email addresses** server-side before sending
2. **Use signed tokens** in URLs to prevent tampering
3. **Set expiration** on all action links (invite, reset, verify)
4. **Rate limit** email sending endpoints
5. **Log email sends** for debugging and audit

---

## 7. Project Structure

```
src/
├── lib/
│   ├── resend.ts                    # Resend client singleton
│   └── email-templates/
│       ├── user-invitation.ts       # Invitation email template
│       ├── welcome.ts               # Welcome email template
│       └── password-reset.ts        # Password reset template
├── actions/
│   ├── invitations.ts               # Invitation server actions
│   └── auth.ts                      # Auth-related actions
└── components/
    └── invite-form.tsx              # Frontend invite component
```

---

## 8. Troubleshooting

### Common Issues

**"RESEND_API_KEY environment variable is not defined"**
- Add `RESEND_API_KEY` to `.env.local`
- Restart the dev server after adding env vars

**"Domain not verified"**
- Verify your sending domain in Resend dashboard
- Use the exact domain in the `from` address

**"Emails not being received"**
- Check spam folder
- Verify recipient email is valid
- Check Resend dashboard for delivery status

**"Rate limit exceeded"**
- Resend has rate limits per plan
- Implement queuing for bulk sends
- Use batch sending for multiple recipients

---

## 9. Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [HTML Email Best Practices](https://www.smashingmagazine.com/2021/04/html-email-best-practices/)
- [Can I Email](https://www.caniemail.com/) - Email CSS compatibility
