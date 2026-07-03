"use client";

import { useState } from "react";

type StarRatingInputProps = {
	value: number;
	onChange: (value: number) => void;
	max?: number;
	disabled?: boolean;
};

function StarIcon({ filled }: { filled: boolean }) {
	return (
		<svg
			className={`h-7 w-7 ${filled ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden
		>
			<path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 22 12 18.56 5.8 22 7 14.14l-5-4.87 7.1-1.01L12 2z" />
		</svg>
	);
}

export default function StarRatingInput({
	value,
	onChange,
	max = 5,
	disabled = false,
}: StarRatingInputProps) {
	const [hoverValue, setHoverValue] = useState(0);
	const displayValue = hoverValue > 0 ? hoverValue : value;

	return (
		<div
			className="flex items-center gap-1"
			onMouseLeave={() => setHoverValue(0)}
			role="radiogroup"
			aria-label="Select rating"
		>
			{Array.from({ length: max }, (_, index) => {
				const starValue = index + 1;
				const filled = starValue <= displayValue;

				return (
					<button
						key={starValue}
						type="button"
						disabled={disabled}
						role="radio"
						aria-checked={value === starValue}
						aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
						className="rounded p-0.5 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
						onMouseEnter={() => !disabled && setHoverValue(starValue)}
						onClick={() => !disabled && onChange(starValue)}
					>
						<StarIcon filled={filled} />
					</button>
				);
			})}
		</div>
	);
}
