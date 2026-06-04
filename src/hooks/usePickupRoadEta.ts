"use client";

import { useEffect, useRef, useState } from "react";
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

function routeKeyFromPoints(driver: LatLng, pickup: LatLng): string {
	return `${driver.lat.toFixed(6)},${driver.lng.toFixed(6)};${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)}`;
}

export function usePickupRoadEta({ enabled, driver, pickup }: UsePickupRoadEtaParams) {
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
	const [eta, setEta] = useState<PickupRoadEtaResult | null>(null);
	const lastCompletedRouteKeyRef = useRef<string | null>(null);

	const driverLat = driver?.lat;
	const driverLng = driver?.lng;
	const pickupLat = pickup?.lat;
	const pickupLng = pickup?.lng;

	useEffect(() => {
		const hasCoords =
			Number.isFinite(driverLat) &&
			Number.isFinite(driverLng) &&
			Number.isFinite(pickupLat) &&
			Number.isFinite(pickupLng);

		if (!enabled || !hasCoords) {
			lastCompletedRouteKeyRef.current = null;
			setStatus("idle");
			setEta(null);
			return;
		}

		const driverPoint = { lat: driverLat as number, lng: driverLng as number };
		const pickupPoint = { lat: pickupLat as number, lng: pickupLng as number };
		const routeKey = routeKeyFromPoints(driverPoint, pickupPoint);

		const controller = new AbortController();
		setStatus(prev =>
			lastCompletedRouteKeyRef.current === routeKey && prev === "ready" ? "ready" : "loading"
		);

		(async () => {
			try {
				const stats = await fetchOsrmDrivingLegStats(
					driverPoint,
					pickupPoint,
					controller.signal
				);
				if (controller.signal.aborted) return;
				if (!stats) {
					setEta(null);
					setStatus("error");
					lastCompletedRouteKeyRef.current = null;
					return;
				}
				setEta({
					durationSeconds: stats.durationSeconds,
					distanceMeters: stats.distanceMeters,
					drivingLabel: formatDrivingDuration(stats.durationSeconds),
					arrivalLabel: formatNyEstimatedArrival(stats.durationSeconds),
				});
				setStatus("ready");
				lastCompletedRouteKeyRef.current = routeKey;
			} catch (err) {
				if (controller.signal.aborted) return;
				console.warn("[usePickupRoadEta] OSRM failed:", err);
				setEta(null);
				setStatus("error");
				lastCompletedRouteKeyRef.current = null;
			}
		})();

		return () => controller.abort();
	}, [enabled, driverLat, driverLng, pickupLat, pickupLng]);

	return { status, eta };
}
