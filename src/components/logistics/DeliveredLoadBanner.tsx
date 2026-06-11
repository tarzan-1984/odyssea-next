"use client";

import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type DeliveredLoadBannerProps = {
	reserveRightForHistory?: boolean;
};

export default function DeliveredLoadBanner({
	reserveRightForHistory = false,
}: DeliveredLoadBannerProps) {
	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="w-full max-w-2xl rounded-lg border border-emerald-200 bg-emerald-50/95 px-5 py-2.5 text-center shadow-md backdrop-blur-sm dark:border-emerald-900/60 dark:bg-emerald-950/90 [overflow-wrap:anywhere]">
				<p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
					This load has already been delivered
				</p>
				<p className="mt-1 break-words text-xs leading-snug text-emerald-900/85 dark:text-emerald-200/90">
					The map shows the movement history recorded for this load.
				</p>
			</div>
		</TrackingMapTopBannerLane>
	);
}
