"use client";

import { useEffect, useState } from "react";
import {
	fetchOsrmDrivingLegStats,
	formatDrivingDuration,
	formatNyEstimatedArrival,
	type LatLng,
} from "@/utils/osrmDrivingEta";

export type PickupRoadEtaResult = {
	durationSeconds: number;
	distanceMeters: number;
	drivingLabel: string;
	arrivalLabel: string;
};

type UsePickupRoadEtaParams = {
	enabled: boolean;
	driver: LatLng | null;
	pickup: LatLng | null;
};

export function usePickupRoadEta({ enabled, driver, pickup }: UsePickupRoadEtaParams) {
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
	const [eta, setEta] = useState<PickupRoadEtaResult | null>(null);

	useEffect(() => {
		if (!enabled || !driver || !pickup) {
			setStatus("idle");
			setEta(null);
			return;
		}

		const controller = new AbortController();
		setStatus("loading");

		(async () => {
			try {
				const stats = await fetchOsrmDrivingLegStats(driver, pickup, controller.signal);
				if (controller.signal.aborted) return;
				if (!stats) {
					setEta(null);
					setStatus("error");
					return;
				}
				setEta({
					durationSeconds: stats.durationSeconds,
					distanceMeters: stats.distanceMeters,
					drivingLabel: formatDrivingDuration(stats.durationSeconds),
					arrivalLabel: formatNyEstimatedArrival(stats.durationSeconds),
				});
				setStatus("ready");
			} catch (err) {
				if (controller.signal.aborted) return;
				console.warn("[usePickupRoadEta] OSRM failed:", err);
				setEta(null);
				setStatus("error");
			}
		})();

		return () => controller.abort();
	}, [enabled, driver, pickup]);

	return { status, eta };
}
