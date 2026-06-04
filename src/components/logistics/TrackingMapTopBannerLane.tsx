"use client";

import type { ReactNode } from "react";

type TrackingMapTopBannerLaneProps = {
	children: ReactNode;
	reserveRightForHistory?: boolean;
};

/** Top-center lane between map controls (left) and load history (right). */
export function TrackingMapTopBannerLane({
	children,
	reserveRightForHistory = false,
}: TrackingMapTopBannerLaneProps) {
	const laneClass = reserveRightForHistory
		? "left-[19.5rem] right-[calc(25vw+1.25rem)]"
		: "left-[19.5rem] right-4";

	return (
		<div
			className={`pointer-events-none absolute top-4 z-[1000] flex justify-center px-2 ${laneClass}`}
		>
			{children}
		</div>
	);
}
