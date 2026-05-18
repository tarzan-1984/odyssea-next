/**
 * Roles allowed to access Drivers list and My offers pages.
 * Users with other roles are redirected to home when visiting these pages.
 */
export const DRIVERS_AND_OFFERS_ALLOWED_ROLES = [
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"ADMINISTRATOR",
	"TRACKING",
	"TRACKING_TL",
	"DRIVER_UPDATES",
	"MORNING_TRACKING",
	"NIGHTSHIFT_TRACKING",
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
	"MODERATOR",
] as const;

export type DriversAndOffersRole = (typeof DRIVERS_AND_OFFERS_ALLOWED_ROLES)[number];

export function canAccessDriversAndOffers(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (DRIVERS_AND_OFFERS_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

/** Roles that may see drivers with blocked / banned / expired_documents on the drivers map. */
export const DRIVERS_MAP_RESTRICTED_STATUS_VIEWER_ROLES = [
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
	"ADMINISTRATOR",
	"DRIVER_UPDATES",
	"MODERATOR",
] as const;

export function canViewRestrictedDriverStatusesOnMap(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (DRIVERS_MAP_RESTRICTED_STATUS_VIEWER_ROLES as readonly string[]).includes(normalized);
}

/** User List + Check list sidebar and routes: admin, moderator, HR, driver updates. */
export const USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES = [
	"ADMINISTRATOR",
	"MODERATOR",
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
	"DRIVER_UPDATES",
] as const;

export function canAccessUserListAndCheckList(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

/** Default in-app landing path after login / generic "home" redirects. */
export function getAppHomePath(role: string | undefined | null): string {
	if (canAccessUserListAndCheckList(role)) return "/user-list";
	if (canAccessDriversAndOffers(role)) return "/drivers-list";
	return "/chat";
}
