"use client";

import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type LoadedEnrouteStaleLocationBannerProps = {
	thresholdLabel: string;
	reserveRightForHistory?: boolean;
};

export default function LoadedEnrouteStaleLocationBanner({
	thresholdLabel,
	reserveRightForHistory = false,
}: LoadedEnrouteStaleLocationBannerProps) {
	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50/95 px-5 py-2.5 text-center shadow-md backdrop-blur-sm dark:border-amber-900/60 dark:bg-amber-950/90 [overflow-wrap:anywhere]">
				<p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
					No driver location updates in the last {thresholdLabel}
				</p>
				<p className="mt-1 break-words text-xs leading-snug text-amber-900/85 dark:text-amber-200/90">
					The driver has not sent a location update in the last {thresholdLabel}{" "}
					(Eastern Time).
				</p>
			</div>
		</TrackingMapTopBannerLane>
	);
}
