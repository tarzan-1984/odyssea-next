"use client";

import { useCurrentUser } from "@/stores/userStore";
import TrackingStatusCard from "./TrackingStatusCard";

const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";

type DriverNotLoadedEnroutePanelProps = {
	driverStatusLabel: string;
	driverExternalId?: string | null;
};

export default function DriverNotLoadedEnroutePanel({
	driverStatusLabel,
	driverExternalId,
}: DriverNotLoadedEnroutePanelProps) {
	const currentUser = useCurrentUser();
	const showTmsLinks = currentUser?.role?.trim().toUpperCase() !== "DRIVER";
	const driverPageUrl = showTmsLinks && driverExternalId?.trim()
		? `${TMS_DRIVER_PAGE_URL}?driver=${encodeURIComponent(driverExternalId.trim())}`
		: null;

	return (
		<div className="absolute inset-0 z-[500] bg-white">
			<div className="pointer-events-none absolute inset-x-0 top-16 z-[600] flex justify-center px-6">
				<TrackingStatusCard
					tone="warning"
					icon="status"
					title="Driver status is not Loaded & Enroute"
				>
					<p>
						Current driver status:{" "}
						<span className="font-semibold text-[#152238]">{driverStatusLabel}</span>
						. Please verify the driver status in{" "}
						{driverPageUrl ? (
							<a
								href={driverPageUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="pointer-events-auto font-semibold text-[#3D6EF5] underline"
							>
								TMS
							</a>
						) : (
							"TMS"
						)}{" "}
						before tracking this load on the map.
					</p>
					<p className="mt-2">
						Map, load history, and live tracking are available only when the driver is
						Loaded &amp; Enroute.
					</p>
				</TrackingStatusCard>
			</div>
		</div>
	);
}
