export const SYSTEM_MESSAGE_KIND = {
	LOAD_DISPATCH: 'load_dispatch',
	LOAD_PROXIMITY: 'load_proximity',
	LOAD_STALE_LOCATION: 'load_stale_location',
} as const;

export type SystemMessageKind =
	(typeof SYSTEM_MESSAGE_KIND)[keyof typeof SYSTEM_MESSAGE_KIND];

export const STALE_LOCATION_ALERT_VISIBLE_ROLES = [
	'ADMINISTRATOR',
	'TRACKING',
	'TRACKING_TL',
	'MORNING_TRACKING',
	'NIGHTSHIFT_TRACKING',
	'TRACKING_TL_DAYTIME',
	'TRACKING_TL_NIGHTSHIFT',
	'TRACKING_TL_MORNINGSHIFT',
] as const;

const STALE_LOCATION_ALERT_VISIBLE_ROLE_SET = new Set<string>(
	STALE_LOCATION_ALERT_VISIBLE_ROLES,
);

export function isLoadProximitySystemMessage(
	kind: SystemMessageKind | string | null | undefined,
): boolean {
	return kind === SYSTEM_MESSAGE_KIND.LOAD_PROXIMITY;
}

export function isLoadDispatchSystemMessage(
	kind: SystemMessageKind | string | null | undefined,
): boolean {
	return kind === SYSTEM_MESSAGE_KIND.LOAD_DISPATCH;
}

export function isLoadStaleLocationSystemMessage(
	kind: SystemMessageKind | string | null | undefined,
): boolean {
	return kind === SYSTEM_MESSAGE_KIND.LOAD_STALE_LOCATION;
}

export function canSeeLoadStaleLocationSystemMessage(
	role: string | null | undefined,
): boolean {
	if (!role) return false;
	return STALE_LOCATION_ALERT_VISIBLE_ROLE_SET.has(role.trim().toUpperCase());
}

export function isSystemMessageVisibleToRole(
	kind: SystemMessageKind | string | null | undefined,
	role: string | null | undefined,
): boolean {
	if (isLoadProximitySystemMessage(kind) && role?.trim().toUpperCase() === 'DRIVER') {
		return false;
	}
	if (
		isLoadStaleLocationSystemMessage(kind) &&
		!canSeeLoadStaleLocationSystemMessage(role)
	) {
		return false;
	}
	return true;
}
