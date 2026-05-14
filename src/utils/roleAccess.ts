/**
 * Roles allowed to access Drivers list and My offers pages.
 * Users with other roles are redirected to home when visiting these pages.
 */
export const DRIVERS_AND_OFFERS_ALLOWED_ROLES = [
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"ADMINISTRATOR",
	"MORNING_TRACKING",
	"NIGHTSHIFT_TRACKING",
] as const;

export type DriversAndOffersRole = (typeof DRIVERS_AND_OFFERS_ALLOWED_ROLES)[number];

export function canAccessDriversAndOffers(role: string | undefined | null): boolean {
	if (!role) return false;
	return DRIVERS_AND_OFFERS_ALLOWED_ROLES.includes(role as DriversAndOffersRole);
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
