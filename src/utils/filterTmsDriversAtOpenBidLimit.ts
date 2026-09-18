export function tmsDriverExternalIds(driver: {
	id?: string | number | null;
	meta_data?: { driver_id?: string | number | null } | null;
}): string[] {
	const ids = [
		String(driver?.meta_data?.driver_id ?? "").trim(),
		String(driver?.id ?? "").trim(),
	];
	return [...new Set(ids.filter(Boolean))];
}

export function isTmsDriverAtOpenBidLimit(
	driver: {
		id?: string | number | null;
		meta_data?: { driver_id?: string | number | null } | null;
	},
	excludedExternalIds: ReadonlySet<string>
): boolean {
	if (excludedExternalIds.size === 0) return false;
	return tmsDriverExternalIds(driver).some((id) => excludedExternalIds.has(id));
}

/** Filter TMS driver/search payload in place (results + id_posts). Leaves pagination as TMS sent it. */
export function filterTmsDriversSearchPayload<T>(
	payload: T,
	excludedExternalIds: ReadonlySet<string>
): T {
	if (!payload || typeof payload !== "object" || excludedExternalIds.size === 0) {
		return payload;
	}
	const root = payload as Record<string, unknown>;
	const inner =
		root.data && typeof root.data === "object"
			? (root.data as Record<string, unknown>)
			: root;
	if (!Array.isArray(inner.results)) return payload;

	inner.results = inner.results.filter(
		(row) =>
			!isTmsDriverAtOpenBidLimit(
				row as {
					id?: string | number | null;
					meta_data?: { driver_id?: string | number | null } | null;
				},
				excludedExternalIds
			)
	);

	const idPosts = inner.id_posts;
	if (idPosts && typeof idPosts === "object" && !Array.isArray(idPosts)) {
		inner.id_posts = Object.fromEntries(
			Object.entries(idPosts as Record<string, unknown>).filter(
				([key]) => !excludedExternalIds.has(String(key).trim())
			)
		);
	}

	return payload;
}
