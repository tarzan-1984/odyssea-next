"use client";

import dynamic from "next/dynamic";

const DriversMapWithMarkers = dynamic(
	() => import("@/components/logistics/DriversMapWithMarkers"),
	{ ssr: false }
);

export function DriversMapContent() {
	return (
		<div className="h-[calc(100vh-220px)] min-h-[520px]">
			<DriversMapWithMarkers />
		</div>
	);
}
