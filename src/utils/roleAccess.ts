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

/** Check list: all tabs (location, version, several devices) and device admin actions. */
export const CHECK_LIST_FULL_ACCESS_ROLES = [
	"ADMINISTRATOR",
	"MODERATOR",
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
] as const;

/**
 * Check list: all tabs; on Version + Several devices —
 * no Action column / Send push / Send Email (Location keeps messaging actions).
 */
export const CHECK_LIST_LIMITED_ACCESS_ROLES = [
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"TRACKING",
	"TRACKING_TL",
	"TRACKING_TL_DAYTIME",
	"TRACKING_TL_NIGHTSHIFT",
	"TRACKING_TL_MORNINGSHIFT",
	"DRIVER_UPDATES",
	"MORNING_TRACKING",
	"NIGHTSHIFT_TRACKING",
] as const;

/** @deprecated Use CHECK_LIST_LIMITED_ACCESS_ROLES */
export const CHECK_LIST_VERSION_ONLY_ROLES = CHECK_LIST_LIMITED_ACCESS_ROLES;

/** @deprecated Use CHECK_LIST_FULL_ACCESS_ROLES */
export const CHECK_LIST_ALLOWED_ROLES = CHECK_LIST_FULL_ACCESS_ROLES;

export function canAccessUserListAndCheckList(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (USER_LIST_AND_CHECK_LIST_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

export function canAccessCheckListFull(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (CHECK_LIST_FULL_ACCESS_ROLES as readonly string[]).includes(normalized);
}

export function canAccessCheckListLimited(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (CHECK_LIST_LIMITED_ACCESS_ROLES as readonly string[]).includes(normalized);
}

/** @deprecated Use canAccessCheckListLimited */
export function canAccessCheckListVersionOnly(role: string | undefined | null): boolean {
	return canAccessCheckListLimited(role);
}

export function canAccessCheckList(role: string | undefined | null): boolean {
	return canAccessCheckListFull(role) || canAccessCheckListLimited(role);
}

export function canManageCheckListDevices(role: string | undefined | null): boolean {
	if (isGastRole(role)) return false;
	return canAccessCheckListFull(role);
}

/** Check list Mass email / Mass Push buttons (broadcast to all drivers). */
export const CHECK_LIST_MASS_EMAIL_ROLES = [
	"ADMINISTRATOR",
	"HR_MANAGER",
	"TRACKING_TL",
	"RECRUITER_TL",
] as const;

export function canAccessCheckListMassEmail(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (CHECK_LIST_MASS_EMAIL_ROLES as readonly string[]).includes(normalized);
}

/** Bid rates page: dispatchers, expedite managers, and tracking team leads. */
export const BID_RATES_ALLOWED_ROLES = [
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"ADMINISTRATOR",
	"TRACKING_TL",
] as const;

export function canAccessBidRates(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (BID_RATES_ALLOWED_ROLES as readonly string[]).includes(normalized);
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

/** App Logs page: administrators and tracking team leads. */
export const APP_LOGS_ALLOWED_ROLES = ["ADMINISTRATOR", "TRACKING_TL"] as const;

export function canAccessAppLogs(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (APP_LOGS_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

/** News/Updates page: recruiters TL, tracking TL, and administrators. */
export const NEWS_UPDATES_ALLOWED_ROLES = [
	"RECRUITER_TL",
	"TRACKING_TL",
	"ADMINISTRATOR",
] as const;

export function canAccessNewsUpdates(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (NEWS_UPDATES_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

/** Load board page. */
export const LOAD_BOARD_ALLOWED_ROLES = [
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"MODERATOR",
	"ADMINISTRATOR",
	"NIGHTSHIFT_TRACKING",
	"MORNING_TRACKING",
	"TRACKING_TL",
] as const;

export function canAccessLoadBoard(role: string | undefined | null): boolean {
	if (isGastRole(role)) return true;
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (LOAD_BOARD_ALLOWED_ROLES as readonly string[]).includes(normalized);
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

/** True if role may submit create/edit offer (GAST can open UI but not submit). */
export function canCreateOffers(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/**
 * Write actions on My Offers (edit, deactivate, drivers, chat, reminder, delete, accept).
 * DRIVER_UPDATES may open /offers but cannot use these actions.
 */
export function canModifyOffers(role: string | undefined | null): boolean {
	if (!canCreateOffers(role)) return false;
	if (!role) return true;
	return role.trim().toUpperCase() !== "DRIVER_UPDATES";
}

/** True if role may create bid rates / Leave bid (GAST may view page but not create). */
export function canCreateBidRates(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/** Alias: bid rate write actions (create, etc.). */
export const canModifyBidRates = canCreateBidRates;

/** True if role may create/edit load board shipments (GAST may view but not post). */
export function canCreateLoadBoardShipments(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/** Alias: load board write actions (create, edit, post/unpost, delete). */
export const canModifyLoadBoardShipments = canCreateLoadBoardShipments;

/** True if role may create/edit/delete news (GAST may view but not create). */
export function canCreateNews(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/** Alias: news write actions (create, update, delete). */
export const canModifyNews = canCreateNews;

/** True if role may send chat messages (GAST is view-only). */
export function canSendChatMessages(role: string | undefined | null): boolean {
	return !isGastRole(role);
}

/** My Loads secondary chat tab (TMS teams without subordinates). */
export const MY_LOADS_CHAT_TAB_ROLES = [
	"TRACKING_TL",
	"TRACKING_TL_DAYTIME",
	"TRACKING_TL_NIGHTSHIFT",
	"TRACKING_TL_MORNINGSHIFT",
] as const;

/** My Team secondary chat tab (TMS teams with subordinates). */
export const MY_TEAM_CHAT_TAB_ROLES = [
	"TRACKING_TL_DAYTIME",
	"TRACKING_TL_NIGHTSHIFT",
	"TRACKING_TL_MORNINGSHIFT",
] as const;

export function canAccessMyLoadsChatTab(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (MY_LOADS_CHAT_TAB_ROLES as readonly string[]).includes(normalized);
}

export function canAccessMyTeamChatTab(role: string | undefined | null): boolean {
	if (!role) return false;
	const normalized = role.trim().toUpperCase();
	return (MY_TEAM_CHAT_TAB_ROLES as readonly string[]).includes(normalized);
}

/** Default in-app landing path after login / generic "home" redirects. */
export function getAppHomePath(role: string | undefined | null): string {
	if (isGastRole(role)) return "/user-list";
	if (canAccessUserListAndCheckList(role)) return "/user-list";
	if (canAccessDriversAndOffers(role)) return "/drivers-list";
	return "/chat";
}
