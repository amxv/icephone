import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nanoid } from "nanoid"
import { db_ws } from "@/db"
import * as schema from "@/db/schema"
import { sendEmail } from "@/lib/email"
import {
	getEnv,
	isNextBuildPhase,
	requireEnv,
	resolveAuthBaseUrl
} from "@/lib/env"

const baseURL = resolveAuthBaseUrl()
const betterAuthSecret = isNextBuildPhase()
	? getEnv("BETTER_AUTH_SECRET") || "build-only-better-auth-secret"
	: requireEnv("BETTER_AUTH_SECRET")

export const auth = betterAuth({
	advanced: {
		database: {
			generateId: () => nanoid(21)
		}
	},
	database: drizzleAdapter(db_ws, {
		provider: "pg",
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications
		}
	}),
	user: {
		additionalFields: {
			defaultTeamId: {
				type: "string",
				required: false,
				input: false
			},
			isActive: {
				type: "boolean",
				required: false,
				defaultValue: true,
				input: false
			}
		}
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		disableSignUp: process.env.NEXT_PUBLIC_NON_PAYMENT_DISABLED === "true",
		sendResetPassword: async ({ user, url }) => {
			const subject = "Reset your password"
			const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:40px 40px 20px;text-align:center;border-bottom:1px solid #e4e4e7;">
              <h1 style="margin:0;font-size:24px;font-weight:600;color:#18181b;">${subject}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">
                Hi${user?.name ? ` ${user.name}` : ""},
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:16px 0;">
                    <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:500;border-radius:8px;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:14px;color:#71717a;text-align:center;">
                If you didn\'t request this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
			`.trim()

			await sendEmail({
				to: [user.email],
				subject,
				html
			})
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24
	},
	secret: betterAuthSecret,
	baseURL,
	trustedOrigins: [
		baseURL,
		"http://localhost:3000",
		getEnv("VERCEL_URL") ? `https://${getEnv("VERCEL_URL")}` : null,
		getEnv("VERCEL_BRANCH_URL")
			? `https://${getEnv("VERCEL_BRANCH_URL")}`
			: null
	].filter(Boolean) as string[]
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
