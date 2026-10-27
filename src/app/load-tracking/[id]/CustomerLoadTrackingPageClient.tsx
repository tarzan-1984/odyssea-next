"use client";

import PickupRoadEtaBanner from "@/components/logistics/PickupRoadEtaBanner";
import { usePickupRoadEta } from "@/hooks/usePickupRoadEta";
import {
	findNextUnpassedRoutePoint,
	isStoredRoadEtaFresh,
	parseLoadRoutePoints,
	parseStoredRoadEta,
	roadEtaBannerCopy,
	type RoadEtaStop,
} from "@/utils/loadRouteEta";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const TrackingDeliveryMap = dynamic(() => import("@/components/logistics/TrackingDeliveryMap"), {
	ssr: false,
});

const TERMINAL_LOAD_STATUSES = new Set(["delivered", "tonu", "cancelled", "canceled"]);

type GeocodeMarker = { lat: number; lng: number; addressLabel: string };

type CustomerTrackingView = {
	trackingHidden?: boolean;
	loadStatus?: string | null;
	pickUpLocation?: string | null;
	deliveryLocation?: string | null;
	routeGeocode?: {
		pickup: GeocodeMarker | null;
		delivery: GeocodeMarker | null;
	} | null;
	loadRoute?: unknown;
	shippers?: Array<{
		latitude?: string | number | null;
		longitude?: string | number | null;
		full_address?: string;
	}>;
	roadEta?: unknown;
	position?: {
		latitude: number;
		longitude: number;
		lastLocationUpdateAt: string | null;
	} | null;
	trackingPoints?: Array<{
		latitude: number;
		longitude: number;
		placeLabel: string | null;
		createdAt: string | null;
	}>;
};

function normalizeStatus(value: string | null | undefined): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/-/g, "_");
}

function markerFromGeocode(
	marker: GeocodeMarker | null | undefined,
	kind: RoadEtaStop["kind"]
): RoadEtaStop | null {
	if (!marker) return null;
	const lat = Number(marker.lat);
	const lng = Number(marker.lng);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return {
		kind,
		lat,
		lng,
		addressLabel: marker.addressLabel?.trim() || `${lat}, ${lng}`,
	};
}

function resolveEtaStop(view: CustomerTrackingView, hasPosition: boolean): RoadEtaStop | null {
	if (!hasPosition) return null;
	const status = normalizeStatus(view.loadStatus);
	if (TERMINAL_LOAD_STATUSES.has(status)) return null;

	const pickup = markerFromGeocode(view.routeGeocode?.pickup, "first_pickup");
	const delivery = markerFromGeocode(view.routeGeocode?.delivery, "delivery");
	const route = parseLoadRoutePoints(view.loadRoute);

	if (status === "waiting_on_pu_date" || status === "at_pu") {
		return pickup;
	}

	if (status === "loaded_enroute" || status === "at_del") {
		return (
			findNextUnpassedRoutePoint(route, { skipFirstPickup: true }) ?? delivery
		);
	}

	return findNextUnpassedRoutePoint(route) ?? delivery ?? pickup;
}

async function fetchCustomerTracking(token: string): Promise<CustomerTrackingView> {
	const response = await fetch(`/api/public/load-tracking/${encodeURIComponent(token)}`, {
		cache: "no-store",
	});
	const body = (await response.json().catch(() => null)) as
		| { data?: CustomerTrackingView; error?: string }
		| null;
	if (!response.ok || !body?.data) {
		throw new Error(body?.error || "Failed to load tracking");
	}
	return body.data;
}

function TrackingUnavailablePlaque() {
	return (
		<div className="absolute inset-0 z-[2000] flex items-center justify-center bg-[#eef8fb] px-6">
			<div className="w-full max-w-[440px] rounded-2xl bg-white px-[18px] py-6 text-center font-[Manrope,sans-serif] shadow-[0_6px_18px_rgba(20,36,59,0.12)]">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef3ff]">
					<svg
						viewBox="0 0 24 24"
						className="h-6 w-6 text-[#3D6EF5]"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden
					>
						<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
					</svg>
				</div>
				<p className="text-[16px] font-bold leading-[22px] text-[#152238]">
					Temporarily unavailable
				</p>
				<p className="mx-auto mt-1.5 max-w-[320px] text-[13px] font-medium leading-[18px] text-[#637899]">
					This page is temporarily unavailable. Technical work is in progress.
				</p>
			</div>
		</div>
	);
}

export default function CustomerLoadTrackingPageClient({ token }: { token: string }) {
	const { data, isPending, isError, error } = useQuery({
		queryKey: ["customer-load-tracking", token],
		queryFn: () => fetchCustomerTracking(token),
		enabled: Boolean(token),
		staleTime: 60 * 1000,
		refetchInterval: 60 * 1000,
		refetchOnWindowFocus: true,
	});

	const trackingHidden = data?.trackingHidden === true;
	const position = trackingHidden ? null : (data?.position ?? null);
	const hasPosition = Boolean(
		position &&
			Number.isFinite(position.latitude) &&
			Number.isFinite(position.longitude)
	);

	const historyDetails = useMemo(() => {
		const points = [...(data?.trackingPoints ?? [])].sort((left, right) => {
			const leftTime = new Date(left.createdAt ?? 0).getTime();
			const rightTime = new Date(right.createdAt ?? 0).getTime();
			return leftTime - rightTime;
		});
		return points.flatMap(point => {
			const latitude = Number(point.latitude);
			const longitude = Number(point.longitude);
			if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
			return [
				{
					position: [latitude, longitude] as [number, number],
					createdAt: point.createdAt,
					updatedAt: point.createdAt,
					placeLabel: point.placeLabel,
				},
			];
		});
	}, [data?.trackingPoints]);

	const mapLoadData = useMemo(
		() => ({
			firstName: "",
			lastName: "",
			phone: "",
			profilePhoto: null,
			city: null,
			state: null,
			zip: null,
			latitude: hasPosition && position ? position.latitude : null,
			longitude: hasPosition && position ? position.longitude : null,
			lastLocationUpdateAt: position?.lastLocationUpdateAt ?? null,
			pick_up_location: data?.pickUpLocation ?? null,
			delivery_location: data?.deliveryLocation ?? null,
			shippers: data?.shippers ?? [],
			routeGeocode: data?.routeGeocode ?? null,
			load_history: historyDetails.map(point => point.position),
			load_history_details: historyDetails,
		}),
		[data, hasPosition, historyDetails, position]
	);

	const etaStop = useMemo(
		() => (data ? resolveEtaStop(data, hasPosition) : null),
		[data, hasPosition]
	);
	const storedRoadEta = useMemo(() => parseStoredRoadEta(data?.roadEta ?? null), [data?.roadEta]);
	const canonicalEta =
		etaStop &&
		storedRoadEta &&
		storedRoadEta.kind === etaStop.kind &&
		isStoredRoadEtaFresh(storedRoadEta, position?.lastLocationUpdateAt)
			? storedRoadEta
			: null;
	const etaCopy = roadEtaBannerCopy(etaStop?.kind ?? "delivery");
	const roadEta = usePickupRoadEta({
		enabled: Boolean(etaStop && hasPosition && position),
		driver: hasPosition && position ? { lat: position.latitude, lng: position.longitude } : null,
		pickup: etaStop ? { lat: etaStop.lat, lng: etaStop.lng } : null,
		destination: etaStop?.addressLabel ?? "",
		canonicalEta,
	});

	return (
		<section className="absolute inset-0 h-full w-full overflow-hidden bg-[#eef8fb]">
			{isPending && (
				<div
					className="absolute inset-0 z-[2000] flex items-center justify-center bg-white"
					aria-busy="true"
				>
					<div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-8 py-6 shadow-xl">
						<div
							className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"
							aria-hidden
						/>
						<p className="text-sm font-medium text-gray-700">Loading tracking...</p>
					</div>
				</div>
			)}

			{isError && !isPending && (
				<div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white px-6">
					<p className="max-w-md text-center text-sm text-red-600">
						{error instanceof Error ? error.message : "Failed to load tracking"}
					</p>
				</div>
			)}

			{trackingHidden && !isPending ? <TrackingUnavailablePlaque /> : null}

			{data && !trackingHidden ? (
				<>
					{etaStop ? (
						<PickupRoadEtaBanner
							status={roadEta.status}
							eta={roadEta.eta}
							pickupAddressLabel={etaStop.addressLabel}
							title={etaCopy.title}
							loadingLabel={etaCopy.loading}
						/>
					) : null}
					<TrackingDeliveryMap
						driverData={mapLoadData}
						showEmptyMap
						forceLightMapBasemap
						enableBasemapModeSwitch
						initialZoom={4}
						showDriverInHistoryPopup={false}
						historyPointNumbering="compact"
					/>
				</>
			) : null}
		</section>
	);
}
