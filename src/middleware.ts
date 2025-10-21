import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public pages that don't require authentication
const publicPages = [
	"/signin",
	"/signup",
	"/forgot-password",
	"/reset-password",
	"/verify-email",
	"/coming-soon",
	"/success",
	"/auth-success",
	"/404",
	"/500",
	"/error",
];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Check if the current path is a public page
	const isPublicPage = publicPages.some(page => pathname.startsWith(page));

	// Check if it's the two-step-verification page
	const isTwoStepVerification = pathname.startsWith("/two-step-verification");

	// Get tokens from cookies (check both accessToken and refreshToken)
	const accessToken = request.cookies.get("accessToken")?.value;
	const refreshToken = request.cookies.get("refreshToken")?.value;
	const hasToken = accessToken || refreshToken;

	// Get login success cookie for two-step-verification
	const loginSuccess = request.cookies.get("login-success")?.value;

	// Special handling for two-step-verification page
	if (isTwoStepVerification) {
		// Check if user has either valid tokens OR login success cookie
		if (!loginSuccess && !hasToken) {
			// No valid authentication method, redirect to signin
			return NextResponse.redirect(new URL("/signin", request.url));
		}

		// User has valid authentication (either tokens or login success cookie)
		return NextResponse.next();
	}

	// If it's a public page and user is authenticated, redirect to admin dashboard
	if (isPublicPage && hasToken) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	// If it's not a public page and user is not authenticated, redirect to signin
	if (!isPublicPage && !hasToken) {
		return NextResponse.redirect(new URL("/signin", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - images (static images)
		 * - icons (static icons)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|images|icons).*)",
	],
};
