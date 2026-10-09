"use client";

import TrackingStatusCard from "./TrackingStatusCard";
import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type DeliveredLoadBannerProps = {
	reserveRightForHistory?: boolean;
};

export default function DeliveredLoadBanner({
	reserveRightForHistory = false,
}: DeliveredLoadBannerProps) {
	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<TrackingStatusCard
				tone="success"
				icon="delivered"
				title="This load has already been delivered"
			>
				The map shows the movement history recorded for this load.
			</TrackingStatusCard>
		</TrackingMapTopBannerLane>
	);
}
