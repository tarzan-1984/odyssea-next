"use client";

import BusyOnOtherLoadMessage from "@/components/chats/BusyOnOtherLoadMessage";
import type { BusyOnOtherLoad } from "@/utils/busyOnOtherLoad";
import TrackingStatusCard from "./TrackingStatusCard";
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
			<div className="pointer-events-auto">
				<TrackingStatusCard tone="info" icon="load" title="Driver is on another load">
					<BusyOnOtherLoadMessage busy={busy} />
				</TrackingStatusCard>
			</div>
		</TrackingMapTopBannerLane>
	);
}
