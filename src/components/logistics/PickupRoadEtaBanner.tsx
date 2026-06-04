"use client";

import type { PickupRoadEtaResult } from "@/hooks/usePickupRoadEta";
import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type PickupRoadEtaBannerProps = {
	status: "idle" | "loading" | "ready" | "error";
	eta: PickupRoadEtaResult | null;
	pickupAddressLabel?: string | null;
	/** Leave top-right lane clear for Load history panel (25vw + offset). */
	reserveRightForHistory?: boolean;
};

export default function PickupRoadEtaBanner({
	status,
	eta,
	pickupAddressLabel,
	reserveRightForHistory = false,
}: PickupRoadEtaBannerProps) {
	if (status === "idle") return null;

	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="w-full max-w-2xl rounded-lg border border-brand-200 bg-white/95 px-5 py-2.5 text-center shadow-md backdrop-blur-sm dark:border-brand-800/60 dark:bg-gray-900/95 [overflow-wrap:anywhere]">
				{status === "loading" && (
					<p className="text-sm font-medium text-gray-700 dark:text-gray-200">
						Calculating estimated arrival at pickup…
					</p>
				)}
				{status === "error" && (
					<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
						Unable to estimate road arrival time right now.
					</p>
				)}
				{status === "ready" && eta && (
					<>
						<p className="text-sm font-semibold text-gray-900 dark:text-white">
							Estimated arrival at first pickup
						</p>
						<p className="mt-1 text-base font-semibold text-brand-600 dark:text-brand-400">
							{eta.arrivalLabel}
						</p>
						<p className="mt-1 break-words text-xs leading-snug text-gray-600 dark:text-gray-400">
							~{eta.drivingLabel} driving (road route)
							{pickupAddressLabel ? ` · ${pickupAddressLabel}` : ""}
						</p>
					</>
				)}
			</div>
		</TrackingMapTopBannerLane>
	);
}
