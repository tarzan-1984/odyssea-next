"use client";

import { useEffect, useRef, useState } from "react";
import { fetchGooglePickupDirections } from "@/lib/fetchGooglePickupDirections";
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
	source: "google" | "osrm";
	routeLabel: string | null;
	distanceLabel: string | null;
	trafficNotice: string | null;
	tollNotice: string | null;
	hasTolls: boolean;
	avoidsTraffic: boolean;
};

type UsePickupRoadEtaParams = {
	enabled: boolean;
	driver: LatLng | null;
	pickup: LatLng | null;
	destination?: string | null;
};

function routeKeyFromPoints(driver: LatLng, pickup: LatLng, destination: string): string {
	return `${driver.lat.toFixed(6)},${driver.lng.toFixed(6)};${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)};${destination}`;
}

export function usePickupRoadEta({
	enabled,
	driver,
	pickup,
	destination,
}: UsePickupRoadEtaParams) {
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
	const [eta, setEta] = useState<PickupRoadEtaResult | null>(null);
	const lastCompletedRouteKeyRef = useRef<string | null>(null);

	const driverLat = driver?.lat;
	const driverLng = driver?.lng;
	const pickupLat = pickup?.lat;
	const pickupLng = pickup?.lng;
	const destinationLabel = destination?.trim() ?? "";

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
		const routeKey = routeKeyFromPoints(driverPoint, pickupPoint, destinationLabel);

		const controller = new AbortController();
		setStatus(prev =>
			lastCompletedRouteKeyRef.current === routeKey && prev === "ready" ? "ready" : "loading"
		);

		(async () => {
			try {
				if (destinationLabel.length >= 3) {
					const google = await fetchGooglePickupDirections(
						driverPoint,
						destinationLabel,
						controller.signal
					);
					if (controller.signal.aborted) return;
					if (google) {
						const arrivalMs = google.estimatedArrivalAt
							? Date.parse(google.estimatedArrivalAt)
							: NaN;
						setEta({
							durationSeconds: google.durationSeconds,
							distanceMeters: google.distanceMeters,
							drivingLabel:
								google.durationText?.trim() ||
								formatDrivingDuration(google.durationSeconds),
							arrivalLabel: Number.isFinite(arrivalMs)
								? formatNyEstimatedArrival(0, arrivalMs)
								: formatNyEstimatedArrival(google.durationSeconds),
							source: "google",
							routeLabel: google.routeLabel?.trim() || null,
							distanceLabel:
								google.distanceText?.trim() ||
								`${(google.distanceMeters / 1609.34).toFixed(1)} miles`,
							trafficNotice: google.trafficNotice?.trim() || null,
							tollNotice: google.tollNotice?.trim() || null,
							hasTolls: google.hasTolls,
							avoidsTraffic: google.avoidsTraffic,
						});
						setStatus("ready");
						lastCompletedRouteKeyRef.current = routeKey;
						return;
					}
				}

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
					source: "osrm",
					routeLabel: null,
					distanceLabel: `${(stats.distanceMeters / 1609.34).toFixed(1)} miles`,
					trafficNotice: null,
					tollNotice: null,
					hasTolls: false,
					avoidsTraffic: false,
				});
				setStatus("ready");
				lastCompletedRouteKeyRef.current = routeKey;
			} catch (err) {
				if (controller.signal.aborted) return;
				console.warn("[usePickupRoadEta] Route ETA failed:", err);
				setEta(null);
				setStatus("error");
				lastCompletedRouteKeyRef.current = null;
			}
		})();

		return () => controller.abort();
	}, [destinationLabel, driverLat, driverLng, enabled, pickupLat, pickupLng]);

	return { status, eta };
}
