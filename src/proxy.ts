import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const PUBLIC_ROUTES = [
	/^\/$/,
	/^\/sign-in(\/.*)?$/,
	/^\/sign-up(\/.*)?$/,
	/^\/api\/auth(\/.*)?$/,
	/^\/api\/test-rag(\/.*)?$/,
	/^\/api\/call-queue(\/.*)?$/
]

const isPublicRoute = (pathname: string) =>
	PUBLIC_ROUTES.some((pattern) => pattern.test(pathname))

export default async function proxy(request: NextRequest) {
	if (isPublicRoute(request.nextUrl.pathname)) {
		return NextResponse.next()
	}

	const session = await auth.api.getSession({
		headers: request.headers
	})

	if (!session?.user || session.user.isActive === false) {
		const redirectUrl = new URL("/sign-in", request.url)
		return NextResponse.redirect(redirectUrl)
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)"
	]
}
