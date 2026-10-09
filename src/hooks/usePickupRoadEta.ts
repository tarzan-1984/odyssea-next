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

/** Same stored Google ETA as the LOAD chat header. */
export type CanonicalPickupRoadEta = {
	arrivalLabel: string;
	durationSeconds?: number | null;
	distanceMeters?: number | null;
};

type UsePickupRoadEtaParams = {
	enabled: boolean;
	driver: LatLng | null;
	pickup: LatLng | null;
	destination?: string | null;
	canonicalEta?: CanonicalPickupRoadEta | null;
};

function routeKeyFromPoints(driver: LatLng, pickup: LatLng, destination: string): string {
	return `${driver.lat.toFixed(6)},${driver.lng.toFixed(6)};${pickup.lat.toFixed(6)},${pickup.lng.toFixed(6)};${destination}`;
}

function etaFromStored(canonical: CanonicalPickupRoadEta): PickupRoadEtaResult {
	const durationSeconds =
		canonical.durationSeconds != null && canonical.durationSeconds > 0
			? canonical.durationSeconds
			: 0;
	const distanceMeters =
		canonical.distanceMeters != null && canonical.distanceMeters >= 0
			? canonical.distanceMeters
			: 0;
	return {
		durationSeconds,
		distanceMeters,
		drivingLabel: durationSeconds > 0 ? formatDrivingDuration(durationSeconds) : "",
		arrivalLabel: canonical.arrivalLabel,
		source: "google",
		routeLabel: null,
		distanceLabel: distanceMeters > 0 ? `${(distanceMeters / 1609.34).toFixed(1)} miles` : null,
		trafficNotice: null,
		tollNotice: null,
		hasTolls: false,
		avoidsTraffic: false,
	};
}

export function usePickupRoadEta({
	enabled,
	driver,
	pickup,
	destination,
	canonicalEta,
}: UsePickupRoadEtaParams) {
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
	const [eta, setEta] = useState<PickupRoadEtaResult | null>(null);
	const lastCompletedRouteKeyRef = useRef<string | null>(null);

	const driverLat = driver?.lat;
	const driverLng = driver?.lng;
	const pickupLat = pickup?.lat;
	const pickupLng = pickup?.lng;
	const destinationLabel = destination?.trim() ?? "";
	const canonicalArrival = canonicalEta?.arrivalLabel?.trim() ?? "";
	const canonicalDuration = canonicalEta?.durationSeconds;
	const canonicalDistance = canonicalEta?.distanceMeters;

	useEffect(() => {
		if (canonicalArrival) {
			lastCompletedRouteKeyRef.current = `stored:${canonicalArrival}`;
			setEta(
				etaFromStored({
					arrivalLabel: canonicalArrival,
					durationSeconds: canonicalDuration,
					distanceMeters: canonicalDistance,
				})
			);
			setStatus("ready");
			return;
		}

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
				const coordinateDestination = `${pickupPoint.lat},${pickupPoint.lng}`;
				const googleDestinations = [destinationLabel, coordinateDestination].filter(
					(value, index, all) => value.length >= 3 && all.indexOf(value) === index
				);
				let google: Awaited<ReturnType<typeof fetchGooglePickupDirections>> = null;
				for (const googleDestination of googleDestinations) {
					google = await fetchGooglePickupDirections(
						driverPoint,
						googleDestination,
						controller.signal
					);
					if (controller.signal.aborted) return;
					if (google) break;
				}
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
	}, [
		canonicalArrival,
		canonicalDistance,
		canonicalDuration,
		destinationLabel,
		driverLat,
		driverLng,
		enabled,
		pickupLat,
		pickupLng,
	]);

	return { status, eta };
}
