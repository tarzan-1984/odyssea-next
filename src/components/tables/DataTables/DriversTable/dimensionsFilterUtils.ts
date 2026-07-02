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
