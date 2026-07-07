type RatingStyle = {
	backgroundColor: string;
	color: string;
};

export function getDriverRatingStyle(
	rating: number | null | undefined
): RatingStyle {
	if (rating == null || rating <= 0 || Number.isNaN(rating)) {
		return {
			backgroundColor: "#616161",
			color: "#FFFFFF",
		};
	}

	if (rating >= 4) {
		return {
			backgroundColor: "#2E7D32",
			color: "#FFFFFF",
		};
	}

	if (rating >= 3) {
		return {
			backgroundColor: "#FBC02D",
			color: "#000000",
		};
	}

	if (rating >= 2) {
		return {
			backgroundColor: "#EF6C00",
			color: "#FFFFFF",
		};
	}

	return {
		backgroundColor: "#C62828",
		color: "#FFFFFF",
	};
}

function formatRatingDisplay(rating: number): string {
	const rounded = Math.round(rating * 100) / 100;
	return rounded.toFixed(2).replace(/\.?0+$/, "");
}

type DriverRatingBadgeProps = {
	avgRating: number | null | undefined;
	count?: number;
	onClick?: () => void;
};

export default function DriverRatingBadge({
	avgRating,
	count,
	onClick,
}: DriverRatingBadgeProps) {
	const numericRating =
		avgRating != null && !Number.isNaN(Number(avgRating))
			? Number(avgRating)
			: null;
	const hasRating = numericRating != null && numericRating > 0;
	const displayValue = hasRating ? formatRatingDisplay(numericRating) : "—";
	const style = getDriverRatingStyle(hasRating ? numericRating : null);
	const title =
		hasRating && count != null && count > 0
			? `${displayValue} · ${count} rating${count === 1 ? "" : "s"}`
			: hasRating
				? displayValue
				: "No rating";

	return (
		<button
			type="button"
			title={title}
			onClick={onClick}
			className="inline-flex h-[18px] w-[30px] shrink-0 items-center justify-center rounded px-0 text-[10px] font-medium tabular-nums leading-none transition-opacity hover:opacity-90"
			style={{
				backgroundColor: style.backgroundColor,
				color: style.color,
			}}
		>
			{displayValue}
		</button>
	);
}
