import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { tokenEncoder } from "@/utils/tokenEncoder";
import {
	canAccessCheckList,
	canAccessDriversAndOffers,
	canAccessUserListAndCheckList,
	getAppHomePath,
} from "@/utils/roleAccess";

const USER_DATA_COOKIE = "userData";

function getUserRoleFromCookie(request: NextRequest): string | undefined {
	const userDataCookie = request.cookies.get(USER_DATA_COOKIE)?.value;
	if (!userDataCookie) return undefined;
	try {
		const decoded = tokenEncoder.decode(userDataCookie);
		const userData = JSON.parse(decoded) as { role?: string };
		return userData.role;
	} catch {
		return undefined;
	}
}

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
	// Public tracking page is available for guests (no auth required)
	"/tracking",
	"/test",
	// Privacy Policy - public for everyone (including unauthenticated)
	"/privacy-policy",
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

	// Check if it's a page accessible to everyone (authenticated and unauthenticated)
	const isTrackingPage = pathname.startsWith("/tracking");
	const isTestPage = pathname.startsWith("/test");
	const isPrivacyPolicyPage = pathname.startsWith("/privacy-policy");

	// If it's a public page and user is authenticated, redirect to app home
	// Exception: tracking, test, privacy-policy are accessible to everyone
	if (isPublicPage && hasToken && !isTrackingPage && !isTestPage && !isPrivacyPolicyPage) {
		const role = getUserRoleFromCookie(request);
		return NextResponse.redirect(new URL(getAppHomePath(role), request.url));
	}

	// These pages are always accessible (no redirect needed)
	if (isTrackingPage || isTestPage || isPrivacyPolicyPage) {
		return NextResponse.next();
	}

	// If it's not a public page and user is not authenticated, redirect to signin
	if (!isPublicPage && !hasToken) {
		return NextResponse.redirect(new URL("/signin", request.url));
	}

	// Drivers list and My offers: role list in utils/roleAccess (DRIVERS_AND_OFFERS_ALLOWED_ROLES)
	const isDriversOrOffersPage =
		pathname === "/drivers-list" || pathname.startsWith("/drivers-list/") ||
		pathname === "/offers" || pathname.startsWith("/offers/");
	if (isDriversOrOffersPage && hasToken) {
		const role = getUserRoleFromCookie(request);
		if (!canAccessDriversAndOffers(role)) {
			return NextResponse.redirect(new URL(getAppHomePath(role), request.url));
		}
	}

	// App settings: only for ADMINISTRATOR
	const isAppSettingsPage =
		pathname === "/app-settings" || pathname.startsWith("/app-settings/");
	if (isAppSettingsPage && hasToken) {
		const role = getUserRoleFromCookie(request);
		if ((role || "").trim().toUpperCase() !== "ADMINISTRATOR") {
			return NextResponse.redirect(new URL(getAppHomePath(role), request.url));
		}
	}

	const isUserListPage =
		pathname === "/user-list" ||
		pathname.startsWith("/user-list/") ||
		pathname.startsWith("/users/");
	const isCheckListPage =
		pathname === "/check-list" || pathname.startsWith("/check-list/");
	if ((isUserListPage || isCheckListPage) && hasToken) {
		const role = getUserRoleFromCookie(request);
		if (isUserListPage && !canAccessUserListAndCheckList(role)) {
			return NextResponse.redirect(new URL(getAppHomePath(role), request.url));
		}
		if (isCheckListPage && !canAccessCheckList(role)) {
			return NextResponse.redirect(new URL(getAppHomePath(role), request.url));
		}
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
