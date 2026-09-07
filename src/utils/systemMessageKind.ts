export const SYSTEM_MESSAGE_KIND = {
	LOAD_DISPATCH: 'load_dispatch',
	LOAD_PROXIMITY: 'load_proximity',
} as const;

export type SystemMessageKind =
	(typeof SYSTEM_MESSAGE_KIND)[keyof typeof SYSTEM_MESSAGE_KIND];

export function isLoadProximitySystemMessage(
	kind: SystemMessageKind | null | undefined,
): boolean {
	return kind === SYSTEM_MESSAGE_KIND.LOAD_PROXIMITY;
}
