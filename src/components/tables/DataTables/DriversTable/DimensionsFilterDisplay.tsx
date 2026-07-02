import {
	DIMENSION_VALUE_CLASS_NAMES,
	type DimensionsFilterValues,
} from "./dimensionsFilterUtils";

const separatorClassName = "text-gray-400 dark:text-gray-500";

interface DimensionsFilterDisplayProps {
	values: DimensionsFilterValues;
}

export default function DimensionsFilterDisplay({ values }: DimensionsFilterDisplayProps) {
	const l = values.dim_min_1.trim();
	const w = values.dim_min_2.trim();
	const h = values.dim_min_3.trim();

	if (!l && !w && !h) return null;

	const parts: Array<{ key: string; value: string; className: string }> = [];
	if (l) parts.push({ key: "l", value: l, className: DIMENSION_VALUE_CLASS_NAMES.dim_min_1 });
	if (w) parts.push({ key: "w", value: w, className: DIMENSION_VALUE_CLASS_NAMES.dim_min_2 });
	if (h) parts.push({ key: "h", value: h, className: DIMENSION_VALUE_CLASS_NAMES.dim_min_3 });

	return (
		<span className="inline-flex items-center font-medium">
			{parts.map((part, index) => (
				<span key={part.key} className="inline-flex items-center">
					{index > 0 && <span className={separatorClassName}>&nbsp;x&nbsp;</span>}
					<span className={part.className}>{part.value}</span>
				</span>
			))}
		</span>
	);
}
