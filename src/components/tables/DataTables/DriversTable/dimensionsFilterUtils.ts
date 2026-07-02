export interface DimensionsFilterValues {
	dim_min_1: string;
	dim_min_2: string;
	dim_min_3: string;
}

export const EMPTY_DIMENSIONS_FILTER: DimensionsFilterValues = {
	dim_min_1: "",
	dim_min_2: "",
	dim_min_3: "",
};

export function createEmptyDimensionsFilter(): DimensionsFilterValues {
	return { ...EMPTY_DIMENSIONS_FILTER };
}

export const DIMENSION_VALUE_CLASS_NAMES = {
	dim_min_1: "text-[#16a34a] dark:text-[#22c55e]",
	dim_min_2: "text-[#ea580c] dark:text-[#f97316]",
	dim_min_3: "text-[#2563eb] dark:text-[#3b82f6]",
} as const;

export const DIMENSION_BORDER_CLASS_NAMES = {
	dim_min_1:
		"border-[#16a34a] focus:border-[#16a34a] focus:ring-[#16a34a]/20 dark:border-[#22c55e] dark:focus:border-[#22c55e] dark:focus:ring-[#22c55e]/20",
	dim_min_2:
		"border-[#ea580c] focus:border-[#ea580c] focus:ring-[#ea580c]/20 dark:border-[#f97316] dark:focus:border-[#f97316] dark:focus:ring-[#f97316]/20",
	dim_min_3:
		"border-[#2563eb] focus:border-[#2563eb] focus:ring-[#2563eb]/20 dark:border-[#3b82f6] dark:focus:border-[#3b82f6] dark:focus:ring-[#3b82f6]/20",
} as const;

export function formatDimensionsFilterDisplay(values: DimensionsFilterValues): string {
	const l = values.dim_min_1.trim();
	const w = values.dim_min_2.trim();
	const h = values.dim_min_3.trim();
	if (!l && !w && !h) return "";
	if (l && w && h) return `${l} x ${w} x ${h}`;
	return [l, w, h].filter(Boolean).join(" x ");
}

export function hasDimensionsFilter(values: DimensionsFilterValues): boolean {
	return Boolean(
		values.dim_min_1.trim() || values.dim_min_2.trim() || values.dim_min_3.trim()
	);
}

/** Returns only non-empty dimension params for API requests. */
export function getActiveDimensionsQueryParams(
	values?: DimensionsFilterValues
): Partial<DimensionsFilterValues> {
	if (!values) return {};

	const params: Partial<DimensionsFilterValues> = {};
	const dim_min_1 = values.dim_min_1.trim();
	const dim_min_2 = values.dim_min_2.trim();
	const dim_min_3 = values.dim_min_3.trim();

	if (dim_min_1) params.dim_min_1 = dim_min_1;
	if (dim_min_2) params.dim_min_2 = dim_min_2;
	if (dim_min_3) params.dim_min_3 = dim_min_3;

	return params;
}
