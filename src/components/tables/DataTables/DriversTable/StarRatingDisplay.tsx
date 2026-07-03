type StarRatingDisplayProps = {
	value: number;
	max?: number;
};

function StarIcon({ filled }: { filled: boolean }) {
	return (
		<svg
			className={`h-4 w-4 ${filled ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden
		>
			<path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 22 12 18.56 5.8 22 7 14.14l-5-4.87 7.1-1.01L12 2z" />
		</svg>
	);
}

export default function StarRatingDisplay({
	value,
	max = 5,
}: StarRatingDisplayProps) {
	const rounded = Math.max(0, Math.min(max, Math.round(value)));

	return (
		<div className="flex items-center gap-0.5" aria-label={`${value} out of ${max} stars`}>
			{Array.from({ length: max }, (_, index) => (
				<StarIcon key={index + 1} filled={index + 1 <= rounded} />
			))}
		</div>
	);
}
