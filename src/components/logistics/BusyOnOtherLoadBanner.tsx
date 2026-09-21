"use client";

import BusyOnOtherLoadMessage from "@/components/chats/BusyOnOtherLoadMessage";
import type { BusyOnOtherLoad } from "@/utils/busyOnOtherLoad";
import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type BusyOnOtherLoadBannerProps = {
	busy: BusyOnOtherLoad;
	reserveRightForHistory?: boolean;
};

export default function BusyOnOtherLoadBanner({
	busy,
	reserveRightForHistory = false,
}: BusyOnOtherLoadBannerProps) {
	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="pointer-events-auto w-full max-w-xl rounded-lg border border-brand-200 bg-white/95 px-3.5 py-2.5 text-left shadow-md backdrop-blur-sm dark:border-brand-800/60 dark:bg-gray-900/95 [overflow-wrap:anywhere]">
				<BusyOnOtherLoadMessage
					busy={busy}
					className="text-sm font-medium leading-snug text-gray-800 dark:text-gray-100"
				/>
			</div>
		</TrackingMapTopBannerLane>
	);
}
