"use client";

import { useCallback, useMemo, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/context/ThemeContext";
import { isMapTilerConfigured, type MapBasemapMode } from "@/lib/mapTileLayer";
import { ResilientBasemapTileLayer } from "@/components/logistics/ResilientBasemapTileLayer";
import { formatNyWallClockForDisplay } from "@/utils/nyWallClock";
import { collectOrderedTmsLoadStops } from "@/utils/formatTmsLoadRoute";

// Dynamically import react-leaflet components (client-side only)
// This prevents SSR issues since Leaflet uses window object
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), {
	ssr: false,
});

const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });

const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

const Polyline = dynamic(() => import("react-leaflet").then(mod => mod.Polyline), { ssr: false });

type LoadLocation = {
	address?: string | null;
	short_address?: string | null;
	type?: string | null;
	address_id?: string | number | null;
};

type TmsShipperLike = {
	address_id?: string | number;
	id?: string;
	latitude?: string | number | null;
	longitude?: string | number | null;
	full_address?: string;
};

type RoutePoint = {
	lat: number;
	lng: number;
	address: string;
};

type LoadStopMarker = {
	point: RoutePoint;
	kind: "pickup" | "delivery";
	title: string;
	isFirstPickup: boolean;
	isFinalDelivery: boolean;
};

type LoadRoute = {
	pickup: RoutePoint;
	delivery: RoutePoint;
	stopMarkers: LoadStopMarker[];
	fullPath: [number, number][];
	completedPath: [number, number][];
	remainingPath: [number, number][];
};

const MIN_DRIVER_MARKER_SIZE = 34;
const MAX_DRIVER_MARKER_SIZE = 78;
const MIN_HISTORY_MARKER_RADIUS = 6;
const MAX_HISTORY_MARKER_RADIUS = 15;
const SELECTED_HISTORY_POINT_ZOOM = 8;
const DRIVER_WAYPOINT_LABEL = "Current driver location";
/** Pixel shift so stacked PU/DEL pins stay visible at city zoom (lat/lng jitter is sub-pixel). */
const OVERLAPPING_STOP_MARKER_OFFSET_PX = 26;

function getHistoryMarkerRadiusByZoom(zoom: number): number {
	const minZoom = 10;
	const maxZoom = 16;
	const normalized = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
	return Math.round(
		MAX_HISTORY_MARKER_RADIUS -
			(MAX_HISTORY_MARKER_RADIUS - MIN_HISTORY_MARKER_RADIUS) * normalized
	);
}

/** Matches `createHistoryPointIcon` outer box so thinning uses real on-screen footprint. */
function getHistoryPointMarkerOuterPx(historyMarkerRadius: number): number {
	const diameterPx = historyMarkerRadius * 2;
	const diameter = Math.round(Math.max(22, diameterPx + 6));
	const ringSize = 2;
	return Math.ceil(diameter * 1.5 + ringSize * 2);
}

/**
 * Hide history markers that would overlap in screen space (Macropoint-style thinning).
 * Points in route order stay visible when they are far enough from already shown markers.
 */
function computeVisibleHistoryPointIndices(
	points: ReadonlyArray<{ position: [number, number] }>,
	map: L.Map,
	markerOuterPx: number,
	forceVisibleIndices: ReadonlySet<number>
): Set<number> {
	if (points.length === 0) return new Set();

	const minGapPx = Math.max(18, markerOuterPx * 0.9);
	const minGapSq = minGapPx * minGapPx;
	const visible = new Set<number>();
	const placedPixels: L.Point[] = [];

	for (let i = 0; i < points.length; i++) {
		const [lat, lng] = points[i].position;
		const pixel = map.latLngToContainerPoint(L.latLng(lat, lng));

		let overlaps = false;
		for (const placed of placedPixels) {
			const dx = pixel.x - placed.x;
			const dy = pixel.y - placed.y;
			if (dx * dx + dy * dy < minGapSq) {
				overlaps = true;
				break;
			}
		}

		if (!overlaps || forceVisibleIndices.has(i)) {
			visible.add(i);
			placedPixels.push(pixel);
		}
	}

	return visible;
}

function getDriverMarkerSizeByZoom(zoom: number): number {
	const minZoom = 6;
	const maxZoom = 16;
	const normalized = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
	return Math.round(
		MIN_DRIVER_MARKER_SIZE + (MAX_DRIVER_MARKER_SIZE - MIN_DRIVER_MARKER_SIZE) * normalized
	);
}

function normalizeLoadLocationType(type: unknown): string {
	return String(type ?? "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
}

function parseLoadLocation(
	value: unknown,
	preferredType: "pick_up_location" | "delivery_location"
): LoadLocation | null {
	if (!value) return null;

	let parsed: unknown = value;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			// TMS often stores a plain address string, not JSON.
			return { address: trimmed };
		}
	}

	try {
		const locations = Array.isArray(parsed) ? parsed : [parsed];
		const typedLocation = locations.find(
			location =>
				location &&
				typeof location === "object" &&
				normalizeLoadLocationType((location as LoadLocation).type) === preferredType
		);
		const fallbackLocation = locations.find(
			location => location && typeof location === "object"
		);
		const location = typedLocation ?? fallbackLocation;
		if (!location || typeof location !== "object") return null;
		return location as LoadLocation;
	} catch (error) {
		console.warn("[TrackingDeliveryMap] Failed to parse load location:", error);
		return null;
	}
}

function normalizeAddressForGeocoding(address: string): string {
	return address
		.replace(/\bN\.?\s*E\.?\b/gi, "NE")
		.replace(/\bN\.?\s*W\.?\b/gi, "NW")
		.replace(/\bS\.?\s*E\.?\b/gi, "SE")
		.replace(/\bS\.?\s*W\.?\b/gi, "SW")
		.replace(/\bAVENUE\b/gi, "Ave")
		.replace(/\bSTREET\b/gi, "St")
		.replace(/\bROAD\b/gi, "Rd")
		.replace(/\s+/g, " ")
		.trim();
}

function getLoadLocationAddressCandidates(
	value: unknown,
	preferredType: "pick_up_location" | "delivery_location"
): string[] {
	const location = parseLoadLocation(value, preferredType);
	const candidates = [
		location?.address?.trim(),
		location?.address ? normalizeAddressForGeocoding(location.address) : null,
		location?.short_address?.trim(),
	].filter((candidate): candidate is string => Boolean(candidate));

	return Array.from(new Set(candidates));
}

function addressCandidatesFromLocationObject(loc: LoadLocation): string[] {
	const raw = [
		loc.address?.trim(),
		loc.address ? normalizeAddressForGeocoding(loc.address) : null,
		loc.short_address?.trim(),
	].filter((c): c is string => Boolean(c));
	return Array.from(new Set(raw));
}

type StopKind = "pickup" | "delivery";

type StopBuildRow = {
	kind: StopKind;
	candidates: string[];
	title: string;
	addressId: string | null;
};

function normalizeLocationAddressId(loc: LoadLocation): string | null {
	const addressId = loc.address_id;
	if (addressId == null || String(addressId).trim() === "") return null;
	return String(addressId).trim();
}

function parseShipperCoordinates(
	shipper: TmsShipperLike
): { lat: number; lng: number } | null {
	const lat =
		shipper.latitude != null && String(shipper.latitude).trim() !== ""
			? Number(shipper.latitude)
			: NaN;
	const lng =
		shipper.longitude != null && String(shipper.longitude).trim() !== ""
			? Number(shipper.longitude)
			: NaN;
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return { lat, lng };
}

function resolveShipperCoordsByAddressId(
	addressId: string,
	shippers: TmsShipperLike[]
): { lat: number; lng: number; addressLabel: string } | null {
	const shipper = shippers.find(entry => {
		const shipperAddressId = String(entry.address_id ?? entry.id ?? "").trim();
		return shipperAddressId !== "" && shipperAddressId === addressId;
	});
	if (!shipper) return null;

	const coords = parseShipperCoordinates(shipper);
	if (!coords) return null;

	return {
		...coords,
		addressLabel: shipper.full_address?.trim() || addressId,
	};
}

/**
 * Ordered load stops by appointment start (`date` + `time_start`), mixed PU/DEL.
 */
function buildOrderedStopRows(pickUpRaw: unknown, deliveryRaw: unknown): StopBuildRow[] {
	const ordered = collectOrderedTmsLoadStops(pickUpRaw, deliveryRaw);
	const pickupTotal = ordered.filter(stop => stop.type === "pick_up_location").length;
	const deliveryTotal = ordered.filter(stop => stop.type === "delivery_location").length;
	const rows: StopBuildRow[] = [];
	let pickupIndex = 0;
	let deliveryIndex = 0;

	for (const stop of ordered) {
		const candidates = addressCandidatesFromLocationObject(stop.loc);
		if (candidates.length === 0) continue;
		if (stop.type === "pick_up_location") {
			pickupIndex += 1;
			rows.push({
				kind: "pickup",
				candidates,
				title: pickupTotal > 1 ? `Pick up ${pickupIndex}` : "Pick up",
				addressId: normalizeLocationAddressId(stop.loc),
			});
		} else {
			deliveryIndex += 1;
			rows.push({
				kind: "delivery",
				candidates,
				title: deliveryTotal > 1 ? `Delivery ${deliveryIndex}` : "Delivery",
				addressId: normalizeLocationAddressId(stop.loc),
			});
		}
	}
	return rows;
}

function isSinglePickupSingleDeliveryRoute(rows: StopBuildRow[]): boolean {
	return (
		rows.filter(row => row.kind === "pickup").length === 1 &&
		rows.filter(row => row.kind === "delivery").length === 1
	);
}

async function geocodeStopRows(
	rows: StopBuildRow[],
	shippers: TmsShipperLike[] = []
): Promise<{ chain: RoutePoint[]; rows: StopBuildRow[] }> {
	const chain: RoutePoint[] = [];
	const outRows: StopBuildRow[] = [];
	for (const row of rows) {
		let pt: RoutePoint | null = null;
		if (row.addressId && shippers.length > 0) {
			const shipperCoords = resolveShipperCoordsByAddressId(row.addressId, shippers);
			if (shipperCoords) {
				pt = {
					lat: shipperCoords.lat,
					lng: shipperCoords.lng,
					address: `${row.title}: ${shipperCoords.addressLabel}`,
				};
			}
		}
		if (!pt) {
			pt = await geocodeAddressCandidates(row.candidates);
			if (pt) {
				pt = {
					lat: pt.lat,
					lng: pt.lng,
					address: `${row.title}: ${row.candidates[0] ?? pt.address}`,
				};
			}
		}
		if (pt) {
			outRows.push(row);
			chain.push(pt);
		}
	}
	return { chain, rows: outRows };
}

function applyServerEndpointsToChain(
	chain: RoutePoint[],
	serverPickup: { lat: number; lng: number; addressLabel: string } | null,
	serverDelivery: { lat: number; lng: number; addressLabel: string } | null
): RoutePoint[] {
	if (chain.length === 0) return chain;
	const next = [...chain];
	if (serverPickup) {
		next[0] = {
			lat: serverPickup.lat,
			lng: serverPickup.lng,
			address: next[0].address.startsWith("Pick up")
				? `${next[0].address.split(":")[0]}: ${serverPickup.addressLabel}`
				: `Pick up: ${serverPickup.addressLabel}`,
		};
	}
	if (serverDelivery && next.length > 0) {
		const lastI = next.length - 1;
		next[lastI] = {
			lat: serverDelivery.lat,
			lng: serverDelivery.lng,
			address: next[lastI].address.startsWith("Delivery")
				? `${next[lastI].address.split(":")[0]}: ${serverDelivery.addressLabel}`
				: `Delivery: ${serverDelivery.addressLabel}`,
		};
	}
	return next;
}

function buildStopMarkersFromChain(chain: RoutePoint[], rows: StopBuildRow[]): LoadStopMarker[] {
	if (chain.length === 0) return [];
	if (rows.length !== chain.length) {
		return chain.map((point, index) => ({
			point,
			kind: index === 0 ? "pickup" : index === chain.length - 1 ? "delivery" : "pickup",
			title:
				index === 0
					? "Pick up"
					: index === chain.length - 1
						? "Delivery"
						: `Stop ${index + 1}`,
			isFirstPickup: index === 0,
			isFinalDelivery: index === chain.length - 1,
		}));
	}
	return chain.map((point, index) => ({
		point,
		kind: rows[index].kind,
		title: rows[index].title,
		isFirstPickup: index === 0,
		isFinalDelivery: index === chain.length - 1,
	}));
}

function closestChainStopIndex(chain: RoutePoint[], target: RoutePoint): number {
	let bestIndex = 0;
	let bestDistance = Infinity;
	for (let i = 0; i < chain.length; i++) {
		const stop = chain[i];
		const distance =
			(stop.lat - target.lat) * (stop.lat - target.lat) +
			(stop.lng - target.lng) * (stop.lng - target.lng);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = i;
		}
	}
	return bestIndex;
}

/**
 * Pickup/delivery chain in time_start order, then every numbered history point
 * in list order (1…N), then remaining stops after the driver's current progress.
 */
function buildOsrmWaypointSequence(
	chain: RoutePoint[],
	historyPoints: RoutePoint[],
	currentDriverPoint: RoutePoint | null
): RoutePoint[] {
	if (chain.length < 2) return [];

	const progressPoint =
		currentDriverPoint ?? (historyPoints.length > 0 ? historyPoints[historyPoints.length - 1] : null);
	const nearestStopIndex = progressPoint ? closestChainStopIndex(chain, progressPoint) : 0;
	const remainingStops = chain.slice(Math.max(nearestStopIndex, 1));

	return uniqueSequentialRoutePoints([
		chain[0],
		...historyPoints,
		...(currentDriverPoint ? [currentDriverPoint] : []),
		...remainingStops,
	]);
}

type OsrmDrivingRouteResult = {
	path: [number, number][];
	waypointSnapsLngLat: [number, number][];
	limitedRequestPoints: RoutePoint[];
};

async function requestOsrmDrivingRoute(
	points: RoutePoint[]
): Promise<OsrmDrivingRouteResult | null> {
	if (points.length < 2) return null;

	const coordinatesParam = points.map(point => `${point.lng},${point.lat}`).join(";");
	const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinatesParam}`);
	url.searchParams.set("overview", "full");
	url.searchParams.set("geometries", "geojson");

	try {
		const response = await fetch(url.toString());
		const data = (await response.json()) as {
			code?: string;
			waypoints?: Array<{ location?: [number, number] }>;
			routes?: Array<{
				geometry?: {
					coordinates?: [number, number][];
				};
			}>;
		};
		const coordinates = data.routes?.[0]?.geometry?.coordinates;
		if (!response.ok || data.code === "NoRoute" || !coordinates?.length) {
			return null;
		}

		const rawSnaps = data.waypoints?.map(w => w.location) ?? [];
		const snaps = rawSnaps.filter(
			(loc): loc is [number, number] => Array.isArray(loc) && loc.length >= 2
		);

		return {
			path: coordinates.map(([lng, lat]) => [lat, lng]),
			waypointSnapsLngLat:
				snaps.length === points.length
					? snaps
					: points.map(p => [p.lng, p.lat] as [number, number]),
			limitedRequestPoints: points,
		};
	} catch {
		return null;
	}
}

/**
 * Stitch road legs. If a waypoint is off the connected network (OSRM NoRoute),
 * skip it and route from the last good point to a later stop.
 */
async function stitchOsrmSkippingUnroutable(
	points: RoutePoint[]
): Promise<OsrmDrivingRouteResult | null> {
	if (points.length < 2) return null;

	const path: [number, number][] = [];
	const snaps: [number, number][] = [];
	const usedPoints: RoutePoint[] = [points[0]];
	let fromIndex = 0;

	for (let i = 1; i < points.length; i++) {
		const leg = await requestOsrmDrivingRoute([points[fromIndex], points[i]]);
		if (!leg || leg.path.length < 2) continue;
		if (path.length > 0) path.pop();
		path.push(...leg.path);
		if (snaps.length === 0) {
			snaps.push(leg.waypointSnapsLngLat[0] ?? [points[fromIndex].lng, points[fromIndex].lat]);
		}
		snaps.push(leg.waypointSnapsLngLat[1] ?? [points[i].lng, points[i].lat]);
		usedPoints.push(points[i]);
		fromIndex = i;
	}

	if (path.length < 2) return null;
	return {
		path,
		waypointSnapsLngLat: snaps,
		limitedRequestPoints: usedPoints,
	};
}

const OSRM_WAYPOINT_WINDOW = 8;

/**
 * Route consecutive numbered waypoints along roads, in windows so every
 * history pin is visited without one giant OSRM request.
 */
async function stitchOsrmInWindows(points: RoutePoint[]): Promise<OsrmDrivingRouteResult | null> {
	if (points.length < 2) return null;
	if (points.length <= OSRM_WAYPOINT_WINDOW) {
		const combined = await requestOsrmDrivingRoute(points);
		if (combined) return combined;
		return stitchOsrmSkippingUnroutable(points);
	}

	const path: [number, number][] = [];
	const snaps: [number, number][] = [];
	const usedPoints: RoutePoint[] = [];

	let start = 0;
	while (start < points.length - 1) {
		const end = Math.min(start + OSRM_WAYPOINT_WINDOW, points.length);
		const windowPoints = points.slice(start, end);
		let windowRoute = await requestOsrmDrivingRoute(windowPoints);
		if (!windowRoute) {
			windowRoute = await stitchOsrmSkippingUnroutable(windowPoints);
		}
		if (!windowRoute || windowRoute.path.length < 2) {
			start += 1;
			continue;
		}
		if (path.length > 0) path.pop();
		path.push(...windowRoute.path);
		if (snaps.length === 0) {
			snaps.push(...windowRoute.waypointSnapsLngLat);
			usedPoints.push(...windowRoute.limitedRequestPoints);
		} else {
			snaps.push(...windowRoute.waypointSnapsLngLat.slice(1));
			usedPoints.push(...windowRoute.limitedRequestPoints.slice(1));
		}
		start = end - 1;
	}

	if (path.length < 2) return null;
	return {
		path,
		waypointSnapsLngLat: snaps,
		limitedRequestPoints: usedPoints.length >= 2 ? usedPoints : points,
	};
}

async function fetchOsrmDrivingRoute(points: RoutePoint[]): Promise<OsrmDrivingRouteResult | null> {
	const cleanPoints = uniqueSequentialRoutePoints(points);
	if (cleanPoints.length < 2) return null;

	if (cleanPoints.length <= OSRM_WAYPOINT_WINDOW) {
		const combined = await requestOsrmDrivingRoute(cleanPoints);
		if (combined) return combined;
		return stitchOsrmSkippingUnroutable(cleanPoints);
	}

	return stitchOsrmInWindows(cleanPoints);
}

/** Nominatim usage policy: at most ~1 request per second for heavy use. */
let nominatimNextAllowedAt = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

async function nominatimThrottle(): Promise<void> {
	const now = Date.now();
	if (now < nominatimNextAllowedAt) {
		await new Promise(r => setTimeout(r, nominatimNextAllowedAt - now));
	}
	nominatimNextAllowedAt = Date.now() + NOMINATIM_MIN_INTERVAL_MS;
}

/** Default US; override when address explicitly mentions Canada or Mexico. */
function resolveNominatimCountryCodes(address: string): string {
	if (/\bcanada\b/i.test(address)) return "ca";
	if (/\b(mexico|méxico)\b/i.test(address)) return "mx";
	return "us";
}

async function geocodeAddress(address: string): Promise<RoutePoint | null> {
	const trimmed = address.trim();
	const params = new URLSearchParams({
		q: trimmed,
		format: "json",
		limit: "1",
		addressdetails: "0",
		"accept-language": "en",
		countrycodes: resolveNominatimCountryCodes(trimmed),
	});

	await nominatimThrottle();

	const response = await fetch(`/api/geocode/nominatim-search?${params.toString()}`, {
		credentials: "include",
	});
	if (!response.ok) return null;

	let results: Array<{ lat?: string; lon?: string }>;
	try {
		const parsed = (await response.json()) as unknown;
		results = Array.isArray(parsed) ? parsed : [];
	} catch {
		return null;
	}
	const first = results[0];
	if (!first?.lat || !first?.lon) return null;

	const lat = Number(first.lat);
	const lng = Number(first.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

	return { lat, lng, address: trimmed };
}

async function geocodeAddressCandidates(candidates: string[]): Promise<RoutePoint | null> {
	for (const candidate of candidates) {
		const point = await geocodeAddress(candidate);
		if (point) return point;
	}

	return null;
}

function areRoutePointsClose(a: RoutePoint, b: RoutePoint): boolean {
	return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
}

function toRoutePoint(value: [number, number], address: string): RoutePoint | null {
	const [lat, lng] = value;
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return { lat, lng, address };
}

function uniqueSequentialRoutePoints(points: RoutePoint[]): RoutePoint[] {
	return points.reduce<RoutePoint[]>((acc, point) => {
		const prev = acc[acc.length - 1];
		if (!prev || !areRoutePointsClose(prev, point)) {
			acc.push(point);
		}
		return acc;
	}, []);
}

function isDegenerateLatLngPath(path: [number, number][]): boolean {
	if (path.length < 2) return true;
	const [lat0, lng0] = path[0];
	return path.every(
		([lat, lng]) => Math.abs(lat - lat0) < 0.0001 && Math.abs(lng - lng0) < 0.0001
	);
}

/** Horizontal pixel offset so overlapping stop pins (same yard) sit side by side. */
function overlappingStopMarkerOffsetX(markers: LoadStopMarker[], index: number): number {
	const cluster = markers
		.map((marker, markerIndex) => ({ marker, markerIndex }))
		.filter(({ marker }) => areRoutePointsClose(marker.point, markers[index].point));
	if (cluster.length <= 1) return 0;
	const positionInCluster = cluster.findIndex(entry => entry.markerIndex === index);
	if (positionInCluster < 0) return 0;
	const n = cluster.length;
	if (n === 2) {
		return positionInCluster === 0
			? -OVERLAPPING_STOP_MARKER_OFFSET_PX
			: OVERLAPPING_STOP_MARKER_OFFSET_PX;
	}
	return (positionInCluster - (n - 1) / 2) * OVERLAPPING_STOP_MARKER_OFFSET_PX;
}

function createStopDivIcon(kind: StopKind, offsetX: number): L.DivIcon {
	const isPickup = kind === "pickup";
	return L.divIcon({
		className: isPickup
			? "tracking-pickup-stop-marker-icon"
			: "tracking-delivery-stop-marker-icon",
		html: `<img src="${isPickup ? "/images/pickUp.png" : "/images/deliveryMarcer.png"}" width="52" height="72" alt="" style="width:52px;height:72px;display:block;" />`,
		iconSize: [52, 72],
		iconAnchor: [26 - offsetX, 72],
		popupAnchor: [offsetX, -64],
	});
}

function clampSplitIndex(splitIdx: number, pathLen: number): number {
	if (pathLen < 2) return 0;
	return Math.min(Math.max(splitIdx, 1), pathLen - 2);
}

function splitRoutePaths(
	fullPath: [number, number][],
	splitTarget: RoutePoint | null
): { completedPath: [number, number][]; remainingPath: [number, number][] } {
	if (fullPath.length < 2) {
		return { completedPath: [], remainingPath: [] };
	}
	if (!splitTarget) {
		return { completedPath: [], remainingPath: fullPath };
	}
	const rawSplit = findClosestPolylineVertexIndex(fullPath, [splitTarget.lat, splitTarget.lng]);
	const splitIdx = clampSplitIndex(rawSplit, fullPath.length);
	return {
		completedPath: fullPath.slice(0, splitIdx + 1),
		remainingPath: fullPath.slice(splitIdx),
	};
}

/** Vertex on the route polyline closest to the driver's coordinates (for splitting completed vs remaining). */
function findClosestPolylineVertexIndex(
	path: [number, number][],
	target: [number, number]
): number {
	if (path.length === 0) return 0;
	const [tLat, tLng] = target;
	let bestI = 0;
	let bestD = Infinity;
	for (let i = 0; i < path.length; i++) {
		const d =
			(path[i][0] - tLat) * (path[i][0] - tLat) + (path[i][1] - tLng) * (path[i][1] - tLng);
		if (d < bestD) {
			bestD = d;
			bestI = i;
		}
	}
	return bestI;
}

// Component to set map reference using useMap hook
// This component must be inside MapContainer to use useMap hook
const MapRefSetter = dynamic(
	() =>
		import("react-leaflet").then(mod => {
			const { useMap } = mod;
			return function MapRefSetterComponent({
				mapRef,
				onZoomChange,
				onMapViewChange,
			}: {
				mapRef: React.MutableRefObject<L.Map | null>;
				onZoomChange?: (zoom: number) => void;
				onMapViewChange?: () => void;
			}) {
				const map = useMap();
				useEffect(() => {
					if (map) {
						// Set reference immediately
						mapRef.current = map;
						// Also ensure it's set when map is fully ready
						map.whenReady(() => {
							if (mapRef.current !== map) {
								mapRef.current = map;
							}
						});
						onZoomChange?.(map.getZoom());
						onMapViewChange?.();
						const handleZoomEnd = () => {
							onZoomChange?.(map.getZoom());
							onMapViewChange?.();
						};
						const handleMoveEnd = () => {
							onMapViewChange?.();
						};
						map.on("zoomend", handleZoomEnd);
						map.on("moveend", handleMoveEnd);
						return () => {
							map.off("zoomend", handleZoomEnd);
							map.off("moveend", handleMoveEnd);
						};
					}
				}, [map, mapRef, onMapViewChange, onZoomChange]);
				return null;
			};
		}),
	{ ssr: false }
);

function stopMapClickBubbling(e: L.LeafletMouseEvent) {
	L.DomEvent.stopPropagation(e.originalEvent);
}

function createHistoryPointIcon({
	diameterPx,
	index,
	isLast,
	isSelected,
}: {
	diameterPx: number;
	index: number;
	isLast: boolean;
	isSelected: boolean;
}) {
	const diameter = Math.round(Math.max(22, diameterPx + 6));
	const color = isLast ? "#16a34a" : "#2563eb";
	const borderColor = isLast ? "#15803d" : "#1d4ed8";
	const ringColor = isLast ? "rgba(22, 163, 74, 0.25)" : "rgba(37, 99, 235, 0.25)";
	const ringSize = isSelected ? 4 : 2;
	const outer = Math.ceil(diameter * 1.5 + ringSize * 2);
	const fontSize = Math.max(10, Math.min(15, diameter * 0.45));

	return L.divIcon({
		className: "tracking-history-point-icon",
		html: `<div class="tracking-history-marker-wrap" style="width:${outer}px;height:${outer}px;">
<div class="tracking-history-marker-pin" style="width:${diameter}px;height:${diameter}px;background:${color};border-color:${borderColor};box-shadow:0 0 0 ${ringSize}px ${ringColor};">
<span style="font-size:${fontSize}px;">${index + 1}</span>
</div>
</div>`,
		iconSize: [outer, outer],
		iconAnchor: [outer / 2, outer / 2 + diameter * 0.56],
		popupAnchor: [0, -outer / 2],
	});
}

function createHistoryPointEditIcon(diameterPx: number) {
	// Match CircleMarker visual size: radius in px → diameter = 2 * radius (we pass 2*radius here).
	const dot = Math.round(Math.max(10, diameterPx));
	const pad = 22;
	const outer = dot + pad * 2;
	return L.divIcon({
		className: "tracking-history-point-edit-icon",
		html: `<div class="tracking-history-edit-hit" style="width:${outer}px;height:${outer}px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
<div class="tracking-history-edit-marker-dot" style="width:${dot}px;height:${dot}px;box-sizing:border-box;"></div>
</div>`,
		iconSize: [outer, outer],
		iconAnchor: [outer / 2, outer / 2],
	});
}

const MapBackgroundClickListener = dynamic(
	() =>
		import("react-leaflet").then(mod => {
			const { useMapEvents } = mod;
			return function MapBackgroundClickListenerComponent({
				onBackgroundClick,
			}: {
				onBackgroundClick?: () => void;
			}) {
				useMapEvents({
					click: () => {
						onBackgroundClick?.();
					},
				});
				return null;
			};
		}),
	{ ssr: false }
);

// Fix for default marker icon in Next.js
if (typeof window !== "undefined") {
	delete (L.Icon.Default.prototype as any)._getIconUrl;
	L.Icon.Default.mergeOptions({
		iconRetinaUrl:
			"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
		iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
		shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
	});
}

interface DriverData {
	firstName: string;
	lastName: string;
	phone: string;
	profilePhoto: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	latitude: number | null;
	longitude: number | null;
	lastLocationUpdateAt: string | null;
	pick_up_location?: string | null;
	delivery_location?: string | null;
	shippers?: TmsShipperLike[];
	/** From GET load — server-cached Nominatim pickup/delivery (preferred over browser geocoding). */
	routeGeocode?: {
		pickup: { lat: number; lng: number; addressLabel: string } | null;
		delivery: { lat: number; lng: number; addressLabel: string } | null;
	} | null;
	load_history?: [number, number][];
	load_history_details?: {
		position: [number, number];
		createdAt: string | null;
		updatedAt: string | null;
		externalDriverId?: string | null;
		driverName?: string | null;
		placeLabel?: string | null;
	}[];
}

interface TrackingDeliveryMapProps {
	driverId?: string;
	driverData?: DriverData | null;
	showEmptyMap?: boolean;
	initialCenter?: [number, number];
	initialZoom?: number;
	selectedLoadHistoryPointIndex?: number | null;
	editingLoadHistoryPointIndex?: number | null;
	/** Fired when user clicks a load-history point on the map (same intent as selecting the sidebar card). */
	onLoadHistoryPointMarkerClick?: (index: number) => void;
	/** Fired on map pane click (not swallowed by a marker/route handle); clears sidebar + history highlight in parent. */
	onMapBackgroundClick?: () => void;
	/** Committed position after drag ends (card + route update then). */
	historyEditDragPosition?: [number, number] | null;
	onHistoryEditPointDragEnd?: (lat: number, lng: number) => void;
	/** When false, history point popups omit driver name (public load tracking). */
	showDriverInHistoryPopup?: boolean;
	/** When true, basemap stays light even if the app theme is dark (e.g. /tracking/load/[id]). */
	forceLightMapBasemap?: boolean;
	/** Show Simple / Hybrid basemap toggle (MapTiler hybrid requires API key). */
	enableBasemapModeSwitch?: boolean;
}

export default function TrackingDeliveryMap({
	driverId,
	driverData,
	showEmptyMap = false,
	initialCenter = [39.2904, -76.6122],
	initialZoom = 18,
	selectedLoadHistoryPointIndex = null,
	editingLoadHistoryPointIndex = null,
	onLoadHistoryPointMarkerClick,
	onMapBackgroundClick,
	historyEditDragPosition = null,
	onHistoryEditPointDragEnd,
	showDriverInHistoryPopup = true,
	forceLightMapBasemap = false,
	enableBasemapModeSwitch = false,
}: TrackingDeliveryMapProps = {}) {
	const { theme } = useTheme();
	const [isDark, setIsDark] = useState(false);
	const mapUsesDarkTiles = !forceLightMapBasemap && isDark;
	const mapTilerConfigured = enableBasemapModeSwitch && isMapTilerConfigured();
	const [mapTilerUnavailable, setMapTilerUnavailable] = useState(false);
	const mapTilerUsable = mapTilerConfigured && !mapTilerUnavailable;
	const [basemapMode, setBasemapMode] = useState<MapBasemapMode>("simple");

	const handleBasemapFallback = useCallback(() => {
		setMapTilerUnavailable(true);
		setBasemapMode("simple");
	}, []);
	const [loadRoute, setLoadRoute] = useState<LoadRoute | null>(null);
	const [isRouteBuilding, setIsRouteBuilding] = useState(false);
	const [driverMarkerSize, setDriverMarkerSize] = useState(MAX_DRIVER_MARKER_SIZE);
	const [historyMarkerRadius, setHistoryMarkerRadius] = useState(
		getHistoryMarkerRadiusByZoom(initialZoom)
	);
	const [mapViewRevision, setMapViewRevision] = useState(0);
	const mapRef = useRef<L.Map | null>(null);
	const hasFitInitialBoundsRef = useRef(false);
	const lastHistoryFocusCenterKeyRef = useRef<string | null>(null);

	// Check if dark theme is active
	useEffect(() => {
		setIsDark(theme === "dark");
		// Also check document class as fallback
		const checkDark = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};
		checkDark();
		// Listen for theme changes via MutationObserver
		const observer = new MutationObserver(checkDark);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, [theme]);

	// Check if we have valid coordinates
	const hasValidCoordinates = useMemo(() => {
		return (
			driverData?.latitude !== null &&
			driverData?.latitude !== undefined &&
			driverData?.longitude !== null &&
			driverData?.longitude !== undefined &&
			!isNaN(driverData.latitude) &&
			!isNaN(driverData.longitude)
		);
	}, [driverData?.latitude, driverData?.longitude]);

	// Get center coordinates for map
	const center = useMemo(() => {
		if (hasValidCoordinates && driverData) {
			return [driverData.latitude!, driverData.longitude!] as [number, number];
		}
		return initialCenter;
	}, [hasValidCoordinates, driverData?.latitude, driverData?.longitude, initialCenter]);

	// Get marker position
	const markerPosition = useMemo(() => {
		if (hasValidCoordinates && driverData) {
			return [driverData.latitude!, driverData.longitude!] as [number, number];
		}
		return null;
	}, [hasValidCoordinates, driverData?.latitude, driverData?.longitude]);

	// Custom driver marker icon
	const carIcon = useMemo(() => {
		const anchorX = driverMarkerSize / 2;
		const anchorY = driverMarkerSize * 0.95;
		return L.divIcon({
			className: "tracking-driver-marker-icon",
			html: `
				<img
					src="/images/tracking-driver-marker.png"
					alt="Driver"
					style="width:${driverMarkerSize}px;height:auto;display:block;"
				/>
			`,
			iconSize: [driverMarkerSize, driverMarkerSize],
			iconAnchor: [anchorX, anchorY],
			popupAnchor: [0, -driverMarkerSize * 0.92],
		});
	}, [driverMarkerSize]);

	const historyPointEditIcon = useMemo(
		() => createHistoryPointEditIcon(historyMarkerRadius * 2),
		[historyMarkerRadius]
	);

	const handleZoomChange = useCallback((zoom: number) => {
		setDriverMarkerSize(getDriverMarkerSizeByZoom(zoom));
		setHistoryMarkerRadius(getHistoryMarkerRadiusByZoom(zoom));
	}, []);

	const handleMapViewChange = useCallback(() => {
		setMapViewRevision(revision => revision + 1);
	}, []);

	const pickupAddressCandidates = useMemo(
		() => getLoadLocationAddressCandidates(driverData?.pick_up_location, "pick_up_location"),
		[driverData?.pick_up_location]
	);

	const deliveryAddressCandidates = useMemo(
		() => getLoadLocationAddressCandidates(driverData?.delivery_location, "delivery_location"),
		[driverData?.delivery_location]
	);

	const historyMarkerPositions = useMemo(
		() =>
			(driverData?.load_history ?? []).filter(
				(point): point is [number, number] =>
					Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
			),
		[driverData?.load_history]
	);

	const historyMarkerDetails = useMemo(() => {
		const details = driverData?.load_history_details ?? [];
		const filtered =
			details.length > 0
				? details.filter(
						point =>
							Array.isArray(point.position) &&
							Number.isFinite(point.position[0]) &&
							Number.isFinite(point.position[1])
					)
				: historyMarkerPositions.map(position => ({
						position,
						createdAt: null,
						updatedAt: null,
						externalDriverId: null,
						driverName: null,
						placeLabel: null,
					}));

		return filtered;
	}, [driverData?.load_history_details, historyMarkerPositions]);

	const visibleHistoryPointIndices = useMemo(() => {
		const map = mapRef.current;
		if (!map || historyMarkerDetails.length === 0) {
			return new Set(historyMarkerDetails.map((_, index) => index));
		}

		const forced = new Set<number>();
		forced.add(0);
		forced.add(historyMarkerDetails.length - 1);
		if (selectedLoadHistoryPointIndex !== null) {
			forced.add(selectedLoadHistoryPointIndex);
		}
		if (editingLoadHistoryPointIndex !== null) {
			forced.add(editingLoadHistoryPointIndex);
		}

		return computeVisibleHistoryPointIndices(
			historyMarkerDetails,
			map,
			getHistoryPointMarkerOuterPx(historyMarkerRadius),
			forced
		);
	}, [
		editingLoadHistoryPointIndex,
		historyMarkerDetails,
		historyMarkerRadius,
		mapViewRevision,
		selectedLoadHistoryPointIndex,
	]);

	const formatHistoryPointTime = useCallback((dateString: string | null) => {
		return formatNyWallClockForDisplay(dateString);
	}, []);

	/** Stable unless PU/DEL collapse to one place — then bucket live driver so OSRM is not rebuilt on every ping. */
	const coincidentRouteOriginKey = useMemo(() => {
		const pickup = driverData?.routeGeocode?.pickup ?? null;
		const delivery = driverData?.routeGeocode?.delivery ?? null;
		const coordsClose = Boolean(
			pickup &&
				delivery &&
				Math.abs(pickup.lat - delivery.lat) < 0.0001 &&
				Math.abs(pickup.lng - delivery.lng) < 0.0001
		);
		const sameAddress = Boolean(
			pickupAddressCandidates[0] &&
				deliveryAddressCandidates[0] &&
				pickupAddressCandidates[0] === deliveryAddressCandidates[0]
		);
		if (!coordsClose && !sameAddress) return "distinct";
		if (historyMarkerPositions.length > 0) return "history";
		if (!markerPosition) return "no-origin";
		return `${markerPosition[0].toFixed(3)},${markerPosition[1].toFixed(3)}`;
	}, [
		deliveryAddressCandidates,
		driverData?.routeGeocode,
		historyMarkerPositions,
		markerPosition,
		pickupAddressCandidates,
	]);

	const renderedStopMarkers = useMemo(() => {
		if (!loadRoute) return [];
		return loadRoute.stopMarkers.map((stop, index) => {
			const offsetX = overlappingStopMarkerOffsetX(loadRoute.stopMarkers, index);
			return {
				stop,
				offsetX,
				icon: createStopDivIcon(stop.kind, offsetX),
			};
		});
	}, [loadRoute]);

	useEffect(() => {
		let cancelled = false;

		const buildLoadRoute = async () => {
			const serverRoute = driverData?.routeGeocode;
			const serverPickup = serverRoute?.pickup ?? null;
			const serverDelivery = serverRoute?.delivery ?? null;

			const hasServerEndpoints = Boolean(serverPickup && serverDelivery);
			if (
				!hasServerEndpoints &&
				(!pickupAddressCandidates.length || !deliveryAddressCandidates.length)
			) {
				setLoadRoute(null);
				setIsRouteBuilding(false);
				return;
			}

			setIsRouteBuilding(true);
			try {
				const rows = buildOrderedStopRows(
					driverData?.pick_up_location,
					driverData?.delivery_location
				);

				let chain: RoutePoint[] = [];
				let stopRows: StopBuildRow[] = rows;

				if (rows.length >= 2) {
					const shippers = driverData?.shippers ?? [];
					const { chain: geoChain, rows: geoRows } = await geocodeStopRows(rows, shippers);
					stopRows = geoRows;
					chain = isSinglePickupSingleDeliveryRoute(rows)
						? applyServerEndpointsToChain(geoChain, serverPickup, serverDelivery)
						: geoChain;
				}

				if (chain.length < 2) {
					if (!serverPickup || !serverDelivery) {
						const [pickupGeo, deliveryGeo] = await Promise.all([
							geocodeAddressCandidates(pickupAddressCandidates),
							geocodeAddressCandidates(deliveryAddressCandidates),
						]);
						if (!pickupGeo && !deliveryGeo) {
							console.warn(
								"[TrackingDeliveryMap] Pickup or delivery geocoding failed",
								{
									pickupAddressCandidates,
									deliveryAddressCandidates,
									usedServerGeocode: Boolean(serverPickup && serverDelivery),
								}
							);
							setLoadRoute(null);
							return;
						}
						chain = [
							...(pickupGeo
								? [{ ...pickupGeo, address: `Pick up: ${pickupGeo.address}` }]
								: []),
							...(deliveryGeo
								? [
										{
											...deliveryGeo,
											address: `Delivery: ${deliveryGeo.address}`,
										},
									]
								: []),
						];
					} else {
						chain = [
							{
								lat: serverPickup.lat,
								lng: serverPickup.lng,
								address: `Pick up: ${serverPickup.addressLabel}`,
							},
							{
								lat: serverDelivery.lat,
								lng: serverDelivery.lng,
								address: `Delivery: ${serverDelivery.addressLabel}`,
							},
						];
					}
					const fallbackStopRows: StopBuildRow[] = [
						{ kind: "pickup", candidates: [], title: "Pick up", addressId: null },
						{ kind: "delivery", candidates: [], title: "Delivery", addressId: null },
					];
					stopRows = fallbackStopRows.slice(0, chain.length);
				}

				if (cancelled) return;

				if (chain.length < 1) {
					setLoadRoute(null);
					return;
				}

				const pickupMarker = chain[0];
				const deliveryMarker = chain[chain.length - 1];
				const stopMarkers = buildStopMarkersFromChain(chain, stopRows);

				const historyPoints = historyMarkerPositions
					.map((point, index) => toRoutePoint(point, `History point ${index + 1}`))
					.filter((point): point is RoutePoint => point !== null);

				const uniqueChain = uniqueSequentialRoutePoints(chain);
				let osrmSeq: RoutePoint[] = [];
				if (uniqueChain.length >= 2) {
					// Do not include the live driver point in OSRM — location pings must not
					// rebuild the paid/ basemap-adjacent route request.
					osrmSeq = buildOsrmWaypointSequence(chain, historyPoints, null);
				} else {
					// Same yard / duplicate TMS coords: PU→DEL is a zero-length route.
					// Draw driving path from last progress (history, else live driver) to the stop.
					const stop = uniqueChain[0] ?? chain[0];
					const origin =
						historyPoints.length > 0
							? historyPoints[historyPoints.length - 1]
							: markerPosition
								? toRoutePoint(markerPosition, DRIVER_WAYPOINT_LABEL)
								: null;
					if (origin && stop && !areRoutePointsClose(origin, stop)) {
						osrmSeq = [origin, stop];
					}
				}

				const osrmResult = await fetchOsrmDrivingRoute(osrmSeq);
				if (cancelled) return;

				const fullPath =
					osrmResult &&
					osrmResult.path.length >= 2 &&
					!isDegenerateLatLngPath(osrmResult.path)
						? osrmResult.path
						: [];
				const splitTarget = markerPosition
					? toRoutePoint(markerPosition, DRIVER_WAYPOINT_LABEL)
					: historyPoints.length > 0
						? historyPoints[historyPoints.length - 1]
						: null;
				const { completedPath, remainingPath } = splitRoutePaths(fullPath, splitTarget);

				if (cancelled) return;

				setLoadRoute({
					pickup: pickupMarker,
					delivery: deliveryMarker,
					stopMarkers,
					fullPath,
					completedPath,
					remainingPath,
				});
			} catch (error) {
				if (!cancelled) {
					console.warn("[TrackingDeliveryMap] Failed to build load route:", error);
					setLoadRoute(null);
				}
			} finally {
				if (!cancelled) {
					setIsRouteBuilding(false);
				}
			}
		};

		buildLoadRoute().catch(error => {
			if (!cancelled) {
				console.warn("[TrackingDeliveryMap] Failed to start route build:", error);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [
		driverData?.routeGeocode,
		driverData?.shippers,
		driverData?.pick_up_location,
		driverData?.delivery_location,
		pickupAddressCandidates,
		deliveryAddressCandidates,
		historyMarkerPositions,
		coincidentRouteOriginKey,
	]);

	useEffect(() => {
		setLoadRoute(prev => {
			if (!prev || prev.fullPath.length < 2) return prev;
			const historyPoints = historyMarkerPositions
				.map((point, index) => toRoutePoint(point, `History point ${index + 1}`))
				.filter((point): point is RoutePoint => point !== null);
			const splitTarget = markerPosition
				? toRoutePoint(markerPosition, DRIVER_WAYPOINT_LABEL)
				: historyPoints.length > 0
					? historyPoints[historyPoints.length - 1]
					: null;
			const { completedPath, remainingPath } = splitRoutePaths(prev.fullPath, splitTarget);
			if (
				completedPath.length === prev.completedPath.length &&
				remainingPath.length === prev.remainingPath.length &&
				completedPath[completedPath.length - 1] ===
					prev.completedPath[prev.completedPath.length - 1] &&
				remainingPath[0] === prev.remainingPath[0]
			) {
				return prev;
			}
			return { ...prev, completedPath, remainingPath };
		});
	}, [historyMarkerPositions, markerPosition]);

	useEffect(() => {
		if (!mapRef.current) return;
		if (hasFitInitialBoundsRef.current) return;

		const boundsPoints: [number, number][] = [];
		if (loadRoute) {
			boundsPoints.push(
				...loadRoute.stopMarkers.map(s => [s.point.lat, s.point.lng] as [number, number])
			);
		}
		if (markerPosition) {
			boundsPoints.push(markerPosition);
		}
		boundsPoints.push(...historyMarkerPositions);

		if (boundsPoints.length === 0) return;

		mapRef.current.fitBounds(L.latLngBounds(boundsPoints), {
			padding: [60, 60],
			maxZoom: 12,
		});
		hasFitInitialBoundsRef.current = true;
	}, [loadRoute, markerPosition, historyMarkerPositions]);

	useEffect(() => {
		const indexToFocus =
			editingLoadHistoryPointIndex !== null
				? editingLoadHistoryPointIndex
				: selectedLoadHistoryPointIndex;

		if (indexToFocus === null || !mapRef.current) {
			lastHistoryFocusCenterKeyRef.current = null;
			return;
		}

		const targetPoint = historyMarkerDetails[indexToFocus];
		if (!targetPoint) return;

		const useDraft =
			editingLoadHistoryPointIndex === indexToFocus && historyEditDragPosition !== null;
		const position = (useDraft ? historyEditDragPosition : targetPoint.position) as [
			number,
			number,
		];

		const focusKey = `${indexToFocus}|${position[0]},${position[1]}|${useDraft ? "d" : "s"}`;
		if (lastHistoryFocusCenterKeyRef.current === focusKey) return;
		lastHistoryFocusCenterKeyRef.current = focusKey;

		const map = mapRef.current;
		map.whenReady(() => {
			if (mapRef.current !== map) return;

			const currentZoom = map.getZoom();
			map.setView(position, Math.max(currentZoom, SELECTED_HISTORY_POINT_ZOOM), {
				animate: true,
				duration: 0.5,
			});
		});
	}, [
		historyEditDragPosition,
		historyMarkerDetails,
		selectedLoadHistoryPointIndex,
		editingLoadHistoryPointIndex,
	]);

	if (!hasValidCoordinates && !showEmptyMap) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
				<div className="text-center p-4">
					<p className="text-gray-600 dark:text-gray-400 text-sm">
						{driverData ? "Location data not available" : "Loading driver location..."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`w-full h-full relative z-0 ${
				forceLightMapBasemap
					? "tracking-map-light-basemap bg-white"
					: "bg-white dark:bg-gray-900"
			}`}
		>
			<style>
				{`
					.tracking-history-point-icon {
						background: transparent !important;
						border: none !important;
					}
					.tracking-history-marker-wrap {
						display: flex;
						align-items: center;
						justify-content: center;
					}
					.tracking-history-marker-pin {
						display: flex;
						align-items: center;
						justify-content: center;
						border: 2px solid;
						border-radius: 50% 50% 50% 0;
						box-sizing: border-box;
						color: #ffffff;
						font-weight: 800;
						line-height: 1;
						text-align: center;
						text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
						transform: rotate(-45deg);
					}
					.tracking-history-marker-pin span {
						display: block;
						transform: rotate(45deg);
					}
					.tracking-history-point-editing {
						transition: fill 0.65s ease-in-out, stroke 0.65s ease-in-out;
					}
					.tracking-history-point-edit-icon.leaflet-interactive {
						cursor: move !important;
					}
					.tracking-history-edit-hit {
						cursor: move !important;
					}
					.tracking-history-edit-marker-dot {
						border-radius: 9999px;
						border: 3px solid #1d4ed8;
						animation: tracking-history-edit-blink 1.3s ease-in-out infinite;
						cursor: move !important;
					}
					@keyframes tracking-history-edit-blink {
						0%, 100% { background: #2563eb; border-color: #1d4ed8; }
						50% { background: #dc2626; border-color: #991b1b; }
					}
					.leaflet-marker-draggable.leaflet-dragging .tracking-history-edit-hit {
						cursor: move !important;
					}
					.tracking-pickup-stop-marker-icon {
						background: transparent !important;
						border: none !important;
					}
					.tracking-delivery-stop-marker-icon {
						background: transparent !important;
						border: none !important;
					}
				`}
			</style>
			{enableBasemapModeSwitch ? (
				<div
					className="pointer-events-none absolute left-40 top-4 z-[1000] flex flex-col items-start gap-1"
					role="group"
					aria-label="Map display mode"
				>
					<div className="pointer-events-auto inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white/95 shadow-md backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
						<button
							type="button"
							className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
								basemapMode === "simple"
									? "bg-brand-500 text-white dark:bg-brand-400"
									: "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
							}`}
							onClick={() => setBasemapMode("simple")}
						>
							Map
						</button>
						<button
							type="button"
							title={
								mapTilerUsable
									? "Satellite with roads and labels"
									: mapTilerUnavailable
										? "MapTiler unavailable — using standard map"
										: process.env.NODE_ENV === "production"
											? "Requires MapTiler API key"
											: "Satellite map is available in production"
							}
							disabled={!mapTilerUsable}
							className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
								basemapMode === "hybrid"
									? "bg-brand-500 text-white dark:bg-brand-400"
									: "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
							} disabled:cursor-not-allowed disabled:opacity-45`}
							onClick={() => setBasemapMode("hybrid")}
						>
							Hybrid
						</button>
					</div>
					{mapTilerUnavailable ? (
						<p className="pointer-events-none max-w-[220px] rounded bg-black/55 px-2 py-0.5 text-[10px] text-white">
							MapTiler unavailable — standard map
						</p>
					) : !mapTilerConfigured && process.env.NODE_ENV === "production" ? (
						<p className="pointer-events-none max-w-[220px] rounded bg-black/55 px-2 py-0.5 text-[10px] text-white">
							Hybrid needs NEXT_PUBLIC_MAPTILER_API_KEY
						</p>
					) : null}
				</div>
			) : null}
			<MapContainer
				center={center}
				zoom={initialZoom}
				attributionControl={false}
				style={{ height: "100%", width: "100%" }}
				scrollWheelZoom={true}
				key={`map-${mapUsesDarkTiles ? "dark" : "light"}`}
			>
				<MapRefSetter
					mapRef={mapRef}
					onZoomChange={handleZoomChange}
					onMapViewChange={handleMapViewChange}
				/>
				<MapBackgroundClickListener onBackgroundClick={onMapBackgroundClick} />
				<ResilientBasemapTileLayer
					mode={basemapMode}
					useMapTilerBasemap
					onFallback={handleBasemapFallback}
				/>
				{loadRoute && (
					<>
						{/* Completed (red) drawn first; remaining (blue) on top — same geometry, no overlapping segments. */}
						{loadRoute.completedPath.length > 1 && (
							<Polyline
								positions={loadRoute.completedPath}
								smoothFactor={0}
								pathOptions={{
									color: "#dc2626",
									weight: 5,
									opacity: 0.9,
									interactive: false,
								}}
							/>
						)}
						{loadRoute.remainingPath.length > 1 && (
							<Polyline
								positions={loadRoute.remainingPath}
								smoothFactor={0}
								pathOptions={{
									color: "#2563eb",
									weight: 5,
									opacity: 0.85,
									interactive: false,
								}}
							/>
						)}
						{renderedStopMarkers.map(({ stop, offsetX, icon }, index) => (
							<Marker
								key={`load-stop-${index}-${stop.kind}-${stop.point.lat}-${stop.point.lng}-${offsetX}`}
								position={[stop.point.lat, stop.point.lng]}
								icon={icon}
								zIndexOffset={stop.kind === "pickup" ? 420 : 410}
								eventHandlers={{ click: stopMapClickBubbling }}
							>
								<Popup>
									<div className="text-sm dark:text-white">
										<p className="font-semibold dark:text-white">
											{stop.title}
										</p>
										<p className="text-gray-600 dark:text-gray-300">
											{stop.point.address.includes(": ")
												? stop.point.address.split(": ").slice(1).join(": ")
												: stop.point.address}
										</p>
									</div>
								</Popup>
							</Marker>
						))}
					</>
				)}
				{historyMarkerDetails.map((point, index) => {
					const isSelected = index === selectedLoadHistoryPointIndex;
					const isEditing = index === editingLoadHistoryPointIndex;
					const isLastHistoryPoint = index === historyMarkerDetails.length - 1;

					if (!isEditing && !visibleHistoryPointIndices.has(index)) {
						return null;
					}

					if (isEditing) {
						const position = (historyEditDragPosition ?? point.position) as [
							number,
							number,
						];
						return (
							<Marker
								key={`history-point-edit-${index}`}
								position={position}
								draggable
								autoPan={false}
								zIndexOffset={750}
								icon={historyPointEditIcon}
								eventHandlers={{
									click: stopMapClickBubbling,
									dragstart: () => {
										document.body.style.cursor = "move";
									},
									dragend: e => {
										document.body.style.cursor = "";
										const ll = e.target.getLatLng();
										onHistoryEditPointDragEnd?.(ll.lat, ll.lng);
									},
								}}
							/>
						);
					}

					return (
						<Marker
							key={`history-point-${index}`}
							position={point.position}
							icon={createHistoryPointIcon({
								diameterPx: historyMarkerRadius * 2,
								index,
								isLast: isLastHistoryPoint,
								isSelected,
							})}
							zIndexOffset={isLastHistoryPoint ? 650 : isSelected ? 600 : 500}
							eventHandlers={{
								click: e => {
									stopMapClickBubbling(e);
									onLoadHistoryPointMarkerClick?.(index);
								},
							}}
						>
							<Popup>
								<div className="text-sm dark:text-white">
									<p className="font-semibold dark:text-white">
										History point {index + 1}
									</p>
									{point.placeLabel?.trim() ? (
										<p className="font-semibold text-gray-600 dark:text-gray-300">
											{point.placeLabel.trim()}
										</p>
									) : null}
									<p
										className={
											point.placeLabel?.trim()
												? "text-xs text-gray-600 dark:text-gray-300 mt-1"
												: "text-xs text-gray-600 dark:text-gray-300"
										}
									>
										{point.position[0].toFixed(6)}, {point.position[1].toFixed(6)}
									</p>
									{showDriverInHistoryPopup ? (
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											Driver:{" "}
											{point.driverName ||
												(point.externalDriverId
													? `(${point.externalDriverId})`
													: "N/A")}
										</p>
									) : null}
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										Tracked:{" "}
										{formatHistoryPointTime(point.createdAt ?? point.updatedAt)}
									</p>
								</div>
							</Popup>
						</Marker>
					);
				})}
				{markerPosition && (
					<Marker
						position={markerPosition}
						icon={carIcon}
						zIndexOffset={1000}
						eventHandlers={{ click: stopMapClickBubbling }}
						// No key prop - react-leaflet will update position automatically without recreating marker
					>
						{driverData && (
							<Popup>
								<div className="text-sm dark:text-white">
									{showDriverInHistoryPopup ? (
										<p className="font-semibold dark:text-white">
											{driverData.firstName} {driverData.lastName}
										</p>
									) : null}
									{driverData.city && driverData.state && (
										<p className="text-gray-600 dark:text-gray-300">
											{driverData.city}, {driverData.state}
										</p>
									)}
									{driverData.lastLocationUpdateAt && (
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											Last update:{" "}
											{formatNyWallClockForDisplay(
												driverData.lastLocationUpdateAt
											)}
										</p>
									)}
								</div>
							</Popup>
						)}
					</Marker>
				)}
			</MapContainer>

			{/* Route/OSRM/geocode in progress */}
			{isRouteBuilding && (
				<div
					className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/45 backdrop-blur-sm dark:bg-gray-950/50"
					aria-busy="true"
					aria-live="polite"
				>
					<div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200/80 bg-white/95 px-8 py-6 shadow-xl dark:border-gray-700 dark:bg-gray-900/95">
						<div
							className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-600 dark:border-t-brand-400"
							aria-hidden
						/>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-200">
							Drawing route...
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
