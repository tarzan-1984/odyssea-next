"use client";

const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";

type DriverNotLoadedEnroutePanelProps = {
	driverStatusLabel: string;
	driverExternalId?: string | null;
};

export default function DriverNotLoadedEnroutePanel({
	driverStatusLabel,
	driverExternalId,
}: DriverNotLoadedEnroutePanelProps) {
	const driverPageUrl = driverExternalId?.trim()
		? `${TMS_DRIVER_PAGE_URL}?driver=${encodeURIComponent(driverExternalId.trim())}`
		: null;

	return (
		<div className="absolute inset-0 z-[500] bg-white dark:bg-gray-950">
			<div className="pointer-events-none absolute inset-x-0 top-20 z-[600] flex justify-center px-6">
				<div className="max-w-lg rounded-lg border border-gray-200 bg-white px-6 py-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<p className="text-base font-semibold text-gray-900 dark:text-white">
						Driver status is not Loaded &amp; Enroute
					</p>
					<p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
						Current driver status:{" "}
						<span className="font-medium text-gray-900 dark:text-white">
							{driverStatusLabel}
						</span>
						. Please verify the driver status in{" "}
						{driverPageUrl ? (
							<a
								href={driverPageUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="pointer-events-auto font-medium text-brand-500 underline hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
							>
								TMS
							</a>
						) : (
							"TMS"
						)}{" "}
						before tracking this load on the map.
					</p>
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
						Map, load history, and live tracking are available only when the driver
						is Loaded &amp; Enroute.
					</p>
				</div>
			</div>
		</div>
	);
}
