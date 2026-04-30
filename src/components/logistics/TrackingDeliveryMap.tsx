"use client";

import { useCallback, useMemo, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/context/ThemeContext";
import { getLeafletRasterTileLayerProps } from "@/lib/mapTileLayer";

// Dynamically import react-leaflet components (client-side only)
// This prevents SSR issues since Leaflet uses window object
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), {
	ssr: false,
});

const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });

const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });

const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

const Polyline = dynamic(() => import("react-leaflet").then(mod => mod.Polyline), { ssr: false });

type LoadLocation = {
	address?: string;
	short_address?: string;
	type?: string;
};

type RoutePoint = {
	lat: number;
	lng: number;
	address: string;
};

type LoadRoute = {
	pickup: RoutePoint;
	delivery: RoutePoint;
	completedPath: [number, number][];
	remainingPath: [number, number][];
};

const MIN_DRIVER_MARKER_SIZE = 34;
const MAX_DRIVER_MARKER_SIZE = 78;
const MAX_OSRM_WAYPOINTS = 25;

function getDriverMarkerSizeByZoom(zoom: number): number {
	const minZoom = 6;
	const maxZoom = 16;
	const normalized = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
	return Math.round(
		MIN_DRIVER_MARKER_SIZE + (MAX_DRIVER_MARKER_SIZE - MIN_DRIVER_MARKER_SIZE) * normalized
	);
}

function parseLoadLocation(value: unknown): LoadLocation | null {
	if (!value) return null;

	try {
		const parsed = typeof value === "string" ? JSON.parse(value) : value;
		const first = Array.isArray(parsed) ? parsed[0] : parsed;
		if (!first || typeof first !== "object") return null;
		return first as LoadLocation;
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

function getLoadLocationAddressCandidates(value: unknown): string[] {
	const location = parseLoadLocation(value);
	const candidates = [
		location?.address?.trim(),
		location?.address ? normalizeAddressForGeocoding(location.address) : null,
		location?.short_address?.trim(),
	].filter((candidate): candidate is string => Boolean(candidate));

	return Array.from(new Set(candidates));
}

async function geocodeAddress(address: string): Promise<RoutePoint | null> {
	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("q", address);
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "1");
	url.searchParams.set("addressdetails", "0");
	url.searchParams.set("accept-language", "en");
	url.searchParams.set("countrycodes", "us");

	const response = await fetch(url.toString());
	if (!response.ok) return null;

	const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
	const first = results[0];
	if (!first?.lat || !first?.lon) return null;

	const lat = Number(first.lat);
	const lng = Number(first.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

	return { lat, lng, address };
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

function limitRouteWaypoints(points: RoutePoint[]): RoutePoint[] {
	if (points.length <= MAX_OSRM_WAYPOINTS) return points;

	const first = points[0];
	const last = points[points.length - 1];
	const middle = points.slice(1, -1);
	const slots = MAX_OSRM_WAYPOINTS - 2;
	const step = Math.max(1, Math.ceil(middle.length / slots));
	const sampledMiddle = middle.filter((_, index) => index % step === 0).slice(0, slots);

	return [first, ...sampledMiddle, last].filter((point): point is RoutePoint => Boolean(point));
}

async function fetchRoutePath(points: RoutePoint[]): Promise<[number, number][]> {
	const cleanPoints = uniqueSequentialRoutePoints(points);
	if (cleanPoints.length < 2) return [];

	const limitedPoints = limitRouteWaypoints(cleanPoints);

	const fallbackPath = cleanPoints.map(point => [point.lat, point.lng] as [number, number]);

	try {
		const coordinatesParam = limitedPoints.map(point => `${point.lng},${point.lat}`).join(";");
		const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinatesParam}`);
		url.searchParams.set("overview", "full");
		url.searchParams.set("geometries", "geojson");

		const response = await fetch(url.toString());
		if (!response.ok) throw new Error(`OSRM ${response.status}`);

		const data = (await response.json()) as {
			routes?: Array<{
				geometry?: {
					coordinates?: [number, number][];
				};
			}>;
		};
		const coordinates = data.routes?.[0]?.geometry?.coordinates;
		if (!coordinates?.length) throw new Error("OSRM route is empty");

		return coordinates.map(([lng, lat]) => [lat, lng]);
	} catch (error) {
		console.warn(
			"[TrackingDeliveryMap] Failed to build road route, using straight line:",
			error
		);
		return fallbackPath;
	}
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
			}: {
				mapRef: React.MutableRefObject<L.Map | null>;
				onZoomChange?: (zoom: number) => void;
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
						const handleZoomEnd = () => {
							onZoomChange?.(map.getZoom());
						};
						map.on("zoomend", handleZoomEnd);
						return () => {
							map.off("zoomend", handleZoomEnd);
						};
					}
				}, [map, mapRef, onZoomChange]);
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
	load_history?: [number, number][];
}

interface TrackingDeliveryMapProps {
	driverId?: string;
	driverData?: DriverData | null;
}

export default function TrackingDeliveryMap({
	driverId,
	driverData,
}: TrackingDeliveryMapProps = {}) {
	const { theme } = useTheme();
	const [isDark, setIsDark] = useState(false);
	const [loadRoute, setLoadRoute] = useState<LoadRoute | null>(null);
	const [driverMarkerSize, setDriverMarkerSize] = useState(MAX_DRIVER_MARKER_SIZE);
	const mapRef = useRef<L.Map | null>(null);

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
		// Default center (Baltimore)
		return [39.2904, -76.6122] as [number, number];
	}, [hasValidCoordinates, driverData?.latitude, driverData?.longitude]);

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

	const handleZoomChange = useCallback((zoom: number) => {
		setDriverMarkerSize(getDriverMarkerSizeByZoom(zoom));
	}, []);

	const mapTiles = useMemo(() => getLeafletRasterTileLayerProps(), []);

	const pickupAddressCandidates = useMemo(
		() => getLoadLocationAddressCandidates(driverData?.pick_up_location),
		[driverData?.pick_up_location]
	);

	const deliveryAddressCandidates = useMemo(
		() => getLoadLocationAddressCandidates(driverData?.delivery_location),
		[driverData?.delivery_location]
	);

	useEffect(() => {
		let cancelled = false;

		const buildLoadRoute = async () => {
			if (!pickupAddressCandidates.length || !deliveryAddressCandidates.length) {
				setLoadRoute(null);
				return;
			}

			try {
				const [pickup, delivery] = await Promise.all([
					geocodeAddressCandidates(pickupAddressCandidates),
					geocodeAddressCandidates(deliveryAddressCandidates),
				]);

				if (cancelled) return;

				if (!pickup || !delivery) {
					console.warn("[TrackingDeliveryMap] Pickup or delivery geocoding failed", {
						pickupAddressCandidates,
						deliveryAddressCandidates,
					});
					setLoadRoute(null);
					return;
				}

				const historyPoints = (driverData?.load_history ?? [])
					.map((point, index) => toRoutePoint(point, `History point ${index + 1}`))
					.filter((point): point is RoutePoint => point !== null);
				const currentDriverPoint = markerPosition
					? toRoutePoint(markerPosition, "Current driver location")
					: null;
				const completedWaypoints = uniqueSequentialRoutePoints([
					pickup,
					...historyPoints,
					...(currentDriverPoint ? [currentDriverPoint] : []),
				]);
				const remainingStart =
					currentDriverPoint ??
					completedWaypoints[completedWaypoints.length - 1] ??
					pickup;

				const [completedPath, remainingPath] = await Promise.all([
					completedWaypoints.length > 1
						? fetchRoutePath(completedWaypoints)
						: Promise.resolve([]),
					fetchRoutePath([remainingStart, delivery]),
				]);
				if (cancelled) return;

				setLoadRoute({ pickup, delivery, completedPath, remainingPath });
			} catch (error) {
				if (!cancelled) {
					console.warn("[TrackingDeliveryMap] Failed to build load route:", error);
					setLoadRoute(null);
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
		pickupAddressCandidates,
		deliveryAddressCandidates,
		driverData?.load_history,
		markerPosition,
	]);

	useEffect(() => {
		if (!loadRoute || !mapRef.current) return;

		const boundsPoints: [number, number][] = [
			[loadRoute.pickup.lat, loadRoute.pickup.lng],
			[loadRoute.delivery.lat, loadRoute.delivery.lng],
		];
		if (markerPosition) {
			boundsPoints.push(markerPosition);
		}

		mapRef.current.fitBounds(L.latLngBounds(boundsPoints), {
			padding: [60, 60],
			maxZoom: 12,
		});
	}, [loadRoute, markerPosition]);

	// Center map when lastLocationUpdateAt changes (every WebSocket update)
	// This ensures map centers on driver location even if coordinates haven't changed
	// but a new update was received. User's zoom level is preserved.
	useEffect(() => {
		// Only center if we have a valid lastLocationUpdateAt (meaning update was received)
		if (
			!driverData?.lastLocationUpdateAt ||
			!mapRef.current ||
			!hasValidCoordinates ||
			!driverData?.latitude ||
			!driverData?.longitude
		) {
			return;
		}

		const newCenter: [number, number] = [driverData.latitude, driverData.longitude];
		const map = mapRef.current;

		// Function to center the map while preserving user's zoom level
		const centerMap = () => {
			if (mapRef.current === map && map) {
				// Get current zoom level set by user
				const currentZoom = map.getZoom();

				// Center map on new coordinates while keeping user's zoom
				map.setView(newCenter, currentZoom, {
					animate: true,
					duration: 0.5,
				});
			}
		};

		// Always use whenReady to ensure map is fully initialized
		// This is safe even if map is already loaded (whenReady resolves immediately)
		map.whenReady(() => {
			centerMap();
		});
	}, [
		driverData?.lastLocationUpdateAt,
		driverData?.latitude,
		driverData?.longitude,
		hasValidCoordinates,
	]);

	if (!hasValidCoordinates) {
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
		<div className="w-full h-full bg-white dark:bg-gray-900 relative z-0">
			<MapContainer
				center={center}
				zoom={18}
				style={{ height: "100%", width: "100%" }}
				scrollWheelZoom={true}
				key={`map-${isDark ? "dark" : "light"}`}
			>
				<MapRefSetter mapRef={mapRef} onZoomChange={handleZoomChange} />
				<TileLayer
					key={`tiles-${isDark ? "dark" : "light"}`}
					attribution={mapTiles.attribution}
					url={mapTiles.url}
					{...(mapTiles.subdomains ? { subdomains: mapTiles.subdomains } : {})}
					maxZoom={mapTiles.maxZoom}
				/>
				{loadRoute && (
					<>
						{loadRoute.remainingPath.length > 1 && (
							<Polyline
								positions={loadRoute.remainingPath}
								pathOptions={{
									color: "#2563eb",
									weight: 5,
									opacity: 0.85,
								}}
							/>
						)}
						{loadRoute.completedPath.length > 1 && (
							<Polyline
								positions={loadRoute.completedPath}
								pathOptions={{
									color: "#dc2626",
									weight: 5,
									opacity: 0.9,
								}}
							/>
						)}
						<Marker position={[loadRoute.pickup.lat, loadRoute.pickup.lng]}>
							<Popup>
								<div className="text-sm dark:text-white">
									<p className="font-semibold dark:text-white">Pick up</p>
									<p className="text-gray-600 dark:text-gray-300">
										{loadRoute.pickup.address}
									</p>
								</div>
							</Popup>
						</Marker>
						<Marker position={[loadRoute.delivery.lat, loadRoute.delivery.lng]}>
							<Popup>
								<div className="text-sm dark:text-white">
									<p className="font-semibold dark:text-white">Delivery</p>
									<p className="text-gray-600 dark:text-gray-300">
										{loadRoute.delivery.address}
									</p>
								</div>
							</Popup>
						</Marker>
					</>
				)}
				{markerPosition && (
					<Marker
						position={markerPosition}
						icon={carIcon}
						zIndexOffset={1000}
						// No key prop - react-leaflet will update position automatically without recreating marker
					>
						{driverData && (
							<Popup>
								<div className="text-sm dark:text-white">
									<p className="font-semibold dark:text-white">
										{driverData.firstName} {driverData.lastName}
									</p>
									{driverData.city && driverData.state && (
										<p className="text-gray-600 dark:text-gray-300">
											{driverData.city}, {driverData.state}
										</p>
									)}
									{driverData.lastLocationUpdateAt && (
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											Last update:{" "}
											{new Date(
												driverData.lastLocationUpdateAt
											).toLocaleString()}
										</p>
									)}
								</div>
							</Popup>
						)}
					</Marker>
				)}
			</MapContainer>
		</div>
	);
}
