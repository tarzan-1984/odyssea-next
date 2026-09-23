type LoadRestFields = {
	isRest?: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
};

function asRestTimestamp(value: string | null | undefined): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

/**
 * A concrete restDate/restStartedAt always replaces the current value
 * (TMS websocket and Next rest updates must recompute the countdown).
 * Keep the previous timestamp only when rest stays on and the patch omits it.
 */
export function mergeLoadRestFields<T extends LoadRestFields>(
	current: T | null | undefined,
	incoming: Partial<LoadRestFields>,
): LoadRestFields {
	if (incoming.isRest === false) {
		return { isRest: false, restDate: null, restStartedAt: null };
	}

	const isRest =
		incoming.isRest !== undefined ? Boolean(incoming.isRest) : current?.isRest;

	const incomingRestDate = asRestTimestamp(incoming.restDate);
	const incomingRestStartedAt = asRestTimestamp(incoming.restStartedAt);

	const restDate =
		incomingRestDate ??
		(isRest ? current?.restDate ?? null : incoming.restDate !== undefined ? null : current?.restDate ?? null);

	const restStartedAt =
		incomingRestStartedAt ??
		(isRest
			? current?.restStartedAt ?? null
			: incoming.restStartedAt !== undefined
				? null
				: current?.restStartedAt ?? null);

	return { isRest, restDate, restStartedAt };
}
