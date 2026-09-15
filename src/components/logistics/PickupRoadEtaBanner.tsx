"use client";

import type { PickupRoadEtaResult } from "@/hooks/usePickupRoadEta";
import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type PickupRoadEtaBannerProps = {
	status: "idle" | "loading" | "ready" | "error";
	eta: PickupRoadEtaResult | null;
	pickupAddressLabel?: string | null;
	title?: string;
	loadingLabel?: string;
	/** Leave top-right lane clear for Load history panel (25vw + offset). */
	reserveRightForHistory?: boolean;
};

const DEFAULT_TITLE = "Estimated arrival at first pickup";
const DEFAULT_LOADING = "Calculating estimated arrival at pickup…";

export default function PickupRoadEtaBanner({
	status,
	eta,
	pickupAddressLabel,
	title = DEFAULT_TITLE,
	loadingLabel = DEFAULT_LOADING,
	reserveRightForHistory = false,
}: PickupRoadEtaBannerProps) {
	if (status === "idle") return null;

	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="w-full max-w-xl rounded-lg border border-brand-200 bg-white/95 px-3.5 py-2.5 text-left shadow-md backdrop-blur-sm dark:border-brand-800/60 dark:bg-gray-900/95 [overflow-wrap:anywhere]">
				{status === "loading" && (
					<p className="text-center text-sm font-medium text-gray-700 dark:text-gray-200">
						{loadingLabel}
					</p>
				)}
				{status === "error" && (
					<p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">
						Unable to estimate road arrival time right now.
					</p>
				)}
				{status === "ready" && eta && eta.source === "google" ? (
					<>
						<p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							{title}
						</p>
						<p className="mt-0.5 text-base font-semibold text-brand-600 dark:text-brand-400">
							{eta.arrivalLabel}
						</p>
						<div className="mt-1.5 flex items-start justify-between gap-3">
							<p className="min-w-0 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
								{eta.routeLabel ? `via ${eta.routeLabel}` : "Fastest route"}
							</p>
							<p className="shrink-0 text-sm font-bold text-red-600 dark:text-red-400">
								{eta.drivingLabel}
							</p>
						</div>
						<div className="mt-0.5 flex items-start justify-between gap-3">
							<p className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
								{eta.avoidsTraffic ? "Avoids traffic" : "Fastest route"}
							</p>
							{eta.distanceLabel ? (
								<p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
									{eta.distanceLabel}
								</p>
							) : null}
						</div>
						{eta.trafficNotice ? (
							<p className="mt-1 text-xs leading-snug text-gray-500 dark:text-gray-400">
								{eta.trafficNotice}
							</p>
						) : null}
						{eta.hasTolls || eta.tollNotice ? (
							<p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
								{eta.tollNotice || "This route has tolls."}
							</p>
						) : null}
						{pickupAddressLabel ? (
							<p className="mt-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
								{pickupAddressLabel}
							</p>
						) : null}
					</>
				) : null}
				{status === "ready" && eta && eta.source !== "google" ? (
					<>
						<p className="text-center text-sm font-semibold text-gray-900 dark:text-white">
							{title}
						</p>
						<p className="mt-1 text-center text-base font-semibold text-brand-600 dark:text-brand-400">
							{eta.arrivalLabel}
						</p>
						<p className="mt-1 text-center text-xs leading-snug text-gray-600 dark:text-gray-400">
							~{eta.drivingLabel} driving (road route)
							{pickupAddressLabel ? ` · ${pickupAddressLabel}` : ""}
						</p>
					</>
				) : null}
			</div>
		</TrackingMapTopBannerLane>
	);
}
