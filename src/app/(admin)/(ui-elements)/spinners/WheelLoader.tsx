"use client";

import Image from "next/image";

export interface WheelLoaderProps {
	/** Size in pixels (width and height). Default 80. */
	size?: number;
	className?: string;
	/** Whether to animate rotation. Default true. */
	spin?: boolean;
}

/** Loader: wheel image with optional continuous rotation animation. */
export default function WheelLoader({ size = 80, className = "", spin = true }: WheelLoaderProps) {
	return (
		<span
			className={`inline-flex shrink-0 items-center justify-center ${className}`}
			style={{ width: size, height: size }}
			aria-hidden
		>
			<Image
				src="/images/customSpinner.png"
				alt=""
				width={size}
				height={size}
				className={`object-contain ${spin ? "animate-spin" : ""}`}
				style={spin ? { animationDuration: "4s" } : undefined}
				unoptimized
			/>
		</span>
	);
}
