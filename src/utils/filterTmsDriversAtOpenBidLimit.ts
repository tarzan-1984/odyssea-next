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
	atLimitExternalIds: ReadonlySet<string>
): boolean {
	if (atLimitExternalIds.size === 0) return false;
	return tmsDriverExternalIds(driver).some((id) => atLimitExternalIds.has(id));
}
