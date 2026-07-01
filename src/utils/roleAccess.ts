/**
 * Roles allowed to access Drivers list and My offers pages.
 * Users with other roles are redirected to home when visiting these pages.
 */
export const GAST_ROLE = "GAST" as const;

export function isGastRole(role: string | undefined | null): boolean {
	if (!role) return false;
	return role.trim().toUpperCase() === GAST_ROLE;
}

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
	if (isGastRole(role)) return true;
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
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (DRIVERS_MAP_RESTRICTED_STATUS_VIEWER_ROLES as readonly string[]).includes(normalized);
}

/** User List sidebar and routes. */
export const USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES = [
	"ADMINISTRATOR",
	"MODERATOR",
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
	"DRIVER_UPDATES",
	"TRACKING_TL",
] as const;

/** Check list: user-list roles plus tracking shifts. */
export const CHECK_LIST_ALLOWED_ROLES = [
	...USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES,
	"MORNING_TRACKING",
	"NIGHTSHIFT_TRACKING",
] as const;

export function canAccessUserListAndCheckList(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

export function canAccessCheckList(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (CHECK_LIST_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

/** Load tracking page: edit/delete history points on the map. */
export const LOAD_TRACKING_HISTORY_EDIT_ROLES = [
	"EXPEDITE_MANAGER",
	"ADMINISTRATOR",
	"MODERATOR",
	"TRACKING_TL",
] as const;

export function canEditLoadTrackingHistory(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (LOAD_TRACKING_HISTORY_EDIT_ROLES as readonly string[]).includes(normalized);
}

export function canAccessAppSettings(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return normalized === "ADMINISTRATOR" || isGastRole(role);
}

export function canModifyAppSettings(role: string | undefined | null): boolean {
	if (!role) return false;
	return role.trim().toUpperCase() === "ADMINISTRATOR";
}

export const CHAT_MESSAGE_DELETE_ROLES = [
	"ADMINISTRATOR",
	"TRACKING_TL",
	"HR_MANAGER",
	"EXPEDITE_MANAGER",
] as const;

export function canDeleteChatMessages(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (CHAT_MESSAGE_DELETE_ROLES as readonly string[]).includes(normalized);
}

export function canSendCheckListMessages(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

export function canCreateOffers(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/** Alias: all offer write actions (create, deactivate, drivers, accept, push, etc.). */
export const canModifyOffers = canCreateOffers;

/** Default in-app landing path after login / generic "home" redirects. */
export function getAppHomePath(role: string | undefined | null): string {
	if (isGastRole(role)) return "/user-list";
	if (canAccessUserListAndCheckList(role)) return "/user-list";
	if (canAccessDriversAndOffers(role)) return "/drivers-list";
	return "/chat";
}
