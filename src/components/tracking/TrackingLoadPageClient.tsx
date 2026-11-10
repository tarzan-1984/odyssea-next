"use client";

import { fetchTrackingLoadDetails, patchTrackingLoadDetailsRest } from "@/lib/fetchTrackingLoadDetails";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { clientAuth } from "@/utils/auth";
import { canEditLoadTrackingHistory } from "@/utils/roleAccess";
import { useCurrentUser } from "@/stores/userStore";
import DriverInfo, { getDriverInfoCardWidthClass } from "@/app/tracking/[id]/DriverInfo";
import DriverNotLoadedEnroutePanel from "@/components/logistics/DriverNotLoadedEnroutePanel";
import DeliveredLoadBanner from "@/components/logistics/DeliveredLoadBanner";
import TrackingStatusCard from "@/components/logistics/TrackingStatusCard";
import PickupRoadEtaBanner from "@/components/logistics/PickupRoadEtaBanner";
import EmbeddedTrackingDriverSheet from "@/components/tracking/EmbeddedTrackingDriverSheet";
import { getStatusLabelForFilter } from "@/components/logistics/driversMapConstants";
import { usePickupRoadEta } from "@/hooks/usePickupRoadEta";
import {
	findNextUnpassedRoutePoint,
	storedRoadEtaMatchesStop,
	parseLoadRoutePoints,
	isStoredRoadEtaFresh,
	parseStoredRoadEta,
	roadEtaBannerCopy,
	type RoadEtaStop,
} from "@/utils/loadRouteEta";
import { formatDriverLocationLine } from "@/utils/formatDriverLocation";
import {
	normalizeDriverExternalId,
	normalizeTrackingLoadDriver,
	normalizeTrackingLoadId,
} from "@/utils/trackingLoadDriver";
import { useResolvedDriverLastActiveApp } from "@/hooks/useResolvedDriverLastActiveApp";
import { isLastLocationOlderThanNy, parseNaiveNyDateTime } from "@/utils/nyWallClock";
import { formatTmsLoadRoute } from "@/utils/formatTmsLoadRoute";
import { parseBusyOnOtherLoad } from "@/utils/busyOnOtherLoad";

const STALE_LOCATION_THRESHOLD: { hours?: number; minutes?: number } = { minutes: 30 };

function formatStaleThresholdLabel(): string {
	if (STALE_LOCATION_THRESHOLD.minutes != null) {
		const n = STALE_LOCATION_THRESHOLD.minutes;
		return n === 1 ? "1 minute" : `${n} minutes`;
	}
	const h = STALE_LOCATION_THRESHOLD.hours ?? 3;
	return h === 1 ? "1 hour" : `${h} hours`;
}

const TrackingDeliveryMap = dynamic(() => import("@/components/logistics/TrackingDeliveryMap"), {
	ssr: false,
});

interface TrackingLoadPageClientProps {
	loadId: string;
	/** Embedded in chat side panel: hide page Back control. */
	embedded?: boolean;
}

type RouteGeocodeMarker = {
	lat: number;
	lng: number;
	addressLabel: string;
};

type LoadDetailsResponse = {
	data?: {
		data?: {
			meta_data?: {
				pick_up_location?: string | null;
				delivery_location?: string | null;
				load_status?: string | null;
				reference_number?: string | null;
				all_miles?: string | number | null;
				attached_driver?: string | null;
				attached_second_driver?: string | null;
				attached_third_driver?: string | null;
			};
			drivers?: LoadDriver[];
			trackingPoints?: LoadTrackingPoint[];
			routeGeocode?: {
				pickup: RouteGeocodeMarker | null;
				delivery: RouteGeocodeMarker | null;
			};
			loadRoute?: unknown;
			roadEta?: unknown;
			busyOnLoad?: unknown;
			isRest?: boolean;
			restDate?: string | null;
			restStartedAt?: string | null;
			shippers?: Array<{
				address_id?: string | number;
				id?: string;
				latitude?: string | number | null;
				longitude?: string | number | null;
				full_address?: string;
			}>;
		};
		meta_data?: {
			pick_up_location?: string | null;
			delivery_location?: string | null;
			load_status?: string | null;
			reference_number?: string | null;
			all_miles?: string | number | null;
			attached_driver?: string | null;
			attached_second_driver?: string | null;
			attached_third_driver?: string | null;
		};
		drivers?: LoadDriver[];
		trackingPoints?: LoadTrackingPoint[];
		routeGeocode?: {
			pickup: RouteGeocodeMarker | null;
			delivery: RouteGeocodeMarker | null;
		};
		loadRoute?: unknown;
		roadEta?: unknown;
		busyOnLoad?: unknown;
		isRest?: boolean;
		restDate?: string | null;
		restStartedAt?: string | null;
		shippers?: Array<{
			address_id?: string | number;
			id?: string;
			latitude?: string | number | null;
			longitude?: string | number | null;
			full_address?: string;
		}>;
	};
};

type LoadDriver = {
	id?: string | null;
	email?: string | null;
	externalId?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	profilePhoto?: string | null;
	driverStatus?: string | null;
	status?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	lastLocationUpdateAt?: string | null;
	lastActiveApp?: string | null;
	trackingLoadId?: string | null;
};

/** Load statuses where live driver marker must not be shown. */
const LOAD_STATUSES_HIDE_DRIVER_MARKER = new Set(["delivered", "tonu", "cancelled", "canceled"]);

/** Load statuses where a stale-location warning banner applies (at / before pickup). */
const LOAD_STATUSES_STALE_TRACKING = new Set(["waiting_on_pu_date", "at_pu"]);

/** Load statuses where live driver location is appended to history list. */
const LOAD_STATUSES_SHOW_CURRENT_LOCATION = new Set([
	"loaded_enroute",
	"at_del",
	"waiting_on_pu_date",
	"at_pu",
]);

type LoadTrackingPoint = {
	id?: string | null;
	externalDriverId?: string | null;
	driverName?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	placeLabel?: string | null;
	deviceId?: string | null;
	deviceModel?: string | null;
	deviceName?: string | null;
	devicePlatform?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type LoadHistoryDetail = {
	id: string | null;
	position: [number, number];
	createdAt: string | null;
	updatedAt: string | null;
	externalDriverId: string | null;
	driverName: string | null;
	placeLabel: string | null;
	deviceId: string | null;
	deviceModel: string | null;
	deviceName: string | null;
	devicePlatform: string | null;
	deviceLabel: string | null;
};

type TrackingDeviceHistoryGroup = {
	key: string;
	label: string;
	points: LoadHistoryDetail[];
};

type LocationUpdatePayload = {
	userId?: string;
	externalId?: string | number | null;
	latitude?: number | null;
	longitude?: number | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	lastLocationUpdateAt?: string | null;
	trackingLoadId?: string | number | null;
};

function locationPayloadMatchesLoadDriver(
	payload: LocationUpdatePayload,
	loadId: string,
	drivers: LoadDriver[]
): boolean {
	if (normalizeTrackingLoadId(payload.trackingLoadId) === normalizeTrackingLoadId(loadId)) {
		return Boolean(normalizeTrackingLoadId(loadId));
	}
	const payloadUserId = String(payload.userId ?? "").trim();
	const payloadExternal = normalizeDriverExternalId(payload.externalId);
	return drivers.some(driver => {
		if (payloadUserId && String(driver.id ?? "").trim() === payloadUserId) return true;
		const driverExternal = normalizeDriverExternalId(driver.externalId);
		return payloadExternal.length > 0 && payloadExternal === driverExternal;
	});
}

function patchLoadDetailsDriverLocation(
	details: LoadDetailsResponse,
	payload: LocationUpdatePayload
): LoadDetailsResponse {
	const patchDrivers = (drivers: LoadDriver[] | undefined): LoadDriver[] | undefined => {
		if (!Array.isArray(drivers)) return drivers;
		return drivers.map(driver => {
			const payloadUserId = String(payload.userId ?? "").trim();
			const payloadExternal = normalizeDriverExternalId(payload.externalId);
			const matches =
				(payloadUserId && String(driver.id ?? "").trim() === payloadUserId) ||
				(payloadExternal.length > 0 &&
					normalizeDriverExternalId(driver.externalId) === payloadExternal);
			if (!matches) return driver;
			return {
				...driver,
				latitude: payload.latitude ?? driver.latitude,
				longitude: payload.longitude ?? driver.longitude,
				city: payload.city ?? driver.city,
				state: payload.state ?? driver.state,
				zip: payload.zip ?? driver.zip,
				lastLocationUpdateAt: payload.lastLocationUpdateAt ?? driver.lastLocationUpdateAt,
				trackingLoadId:
					payload.trackingLoadId != null
						? String(payload.trackingLoadId)
						: driver.trackingLoadId,
			};
		});
	};
	const outer = details.data;
	if (!outer) return details;
	const inner = outer.data;
	return {
		...details,
		data: {
			...outer,
			drivers: patchDrivers(outer.drivers) ?? outer.drivers,
			data: inner
				? { ...inner, drivers: patchDrivers(inner.drivers) ?? inner.drivers }
				: inner,
		},
	};
}

type DriverTrackingPointCreatedPayload = {
	loadId?: string | null;
};

function formatHistoryDate(dateString: string | null) {
	const date = parseNaiveNyDateTime(dateString);
	if (!date) return dateString?.trim() || "N/A";
	const formatted = new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
	return formatted.replace(/, (\d{2}:\d{2})$/, " · $1");
}

function formatTrackingDeviceLabel(point: {
	deviceModel?: string | null;
	deviceName?: string | null;
	deviceId?: string | null;
	devicePlatform?: string | null;
}): string | null {
	const model = point.deviceModel?.trim();
	const name = point.deviceName?.trim();
	const platform = point.devicePlatform?.trim();
	const label =
		model && name && name.toLowerCase() !== model.toLowerCase()
			? `${name} (${model})`
			: model || name;
	if (label && platform) {
		return `${label} · ${platform}`;
	}
	if (label) {
		return label;
	}
	const id = point.deviceId?.trim();
	return id ? `Device ${id.slice(0, 8)}…` : null;
}

function getTrackingDeviceGroupKey(point: {
	deviceId?: string | null;
	deviceModel?: string | null;
	deviceName?: string | null;
	devicePlatform?: string | null;
}): string {
	const id = point.deviceId?.trim();
	if (id) return `device:${id}`;
	const fallback = [
		point.deviceModel?.trim(),
		point.deviceName?.trim(),
		point.devicePlatform?.trim(),
	]
		.filter(Boolean)
		.join("|");
	return fallback ? `legacy:${fallback}` : "legacy:unknown";
}

function formatTrackingDeviceTabLabel(point: {
	deviceId?: string | null;
	deviceModel?: string | null;
	deviceName?: string | null;
}): string {
	const model = point.deviceModel?.trim();
	if (model) return model;
	const name = point.deviceName?.trim();
	if (name) return name;
	const id = point.deviceId?.trim();
	return id ? `Device ${id.slice(0, 8)}…` : "Unknown device";
}

/** Align with TMS / Nest: loaded-enroute → loaded_enroute */
function normalizeTrackingStatus(value: string | null | undefined): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/-/g, "_");
}

const MAP_REFRESH_MIN_INTERVAL_MS = 10 * 60 * 1000;

function hasValidLastLocationUpdate(value: string | null | undefined): boolean {
	const raw = String(value ?? "").trim();
	if (!raw) return false;
	return Number.isFinite(new Date(raw).getTime());
}

const LOAD_STATUS_LABELS: Record<string, string> = {
	delivered: "Delivered",
	loaded_enroute: "Loaded & Enroute",
	available: "Available",
	draft: "Draft",
	cancelled: "Cancelled",
	canceled: "Canceled",
};

function formatLoadStatusLabel(value: string | null | undefined): string {
	const raw = String(value ?? "").trim();
	if (!raw) return "N/A";
	const normalized = normalizeTrackingStatus(raw);
	return (
		LOAD_STATUS_LABELS[normalized] ??
		raw.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
	);
}

function getLoadStatusFromDetails(details: LoadDetailsResponse | undefined): string {
	const meta = details?.data?.data?.meta_data ?? details?.data?.meta_data ?? null;
	return normalizeTrackingStatus(meta?.load_status ?? null);
}

function getLoadRestFromDetails(details: LoadDetailsResponse | undefined): {
	isRest: boolean;
	restDate: string | null;
	restStartedAt: string | null;
} {
	const isRest = Boolean(details?.data?.data?.isRest ?? details?.data?.isRest);
	const restDateRaw = details?.data?.data?.restDate ?? details?.data?.restDate ?? null;
	const restDate =
		typeof restDateRaw === "string" && restDateRaw.trim() ? restDateRaw : null;
	const restStartedAtRaw =
		details?.data?.data?.restStartedAt ?? details?.data?.restStartedAt ?? null;
	const restStartedAt =
		typeof restStartedAtRaw === "string" && restStartedAtRaw.trim()
			? restStartedAtRaw
			: null;
	return { isRest, restDate, restStartedAt };
}

export default function TrackingLoadPageClient({
	loadId,
	embedded = false,
}: TrackingLoadPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const canEditLoadHistory = canEditLoadTrackingHistory(currentUser?.role);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isAuthLoading, setIsAuthLoading] = useState(true);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [isDriverInfoOpen, setIsDriverInfoOpen] = useState(false);
	const [activeTrackingDeviceKey, setActiveTrackingDeviceKey] = useState<string | null>(null);
	const [selectedHistoryPointIndex, setSelectedHistoryPointIndex] = useState<number | null>(null);
	const [pinnedHistoryPointIndices, setPinnedHistoryPointIndices] = useState<number[]>([]);
	const [editingHistoryPointIndex, setEditingHistoryPointIndex] = useState<number | null>(null);
	const [historyDragDraft, setHistoryDragDraft] = useState<[number, number] | null>(null);
	const [historyEditShowApplyCancel, setHistoryEditShowApplyCancel] = useState(false);
	const [savingHistoryPointId, setSavingHistoryPointId] = useState<string | null>(null);
	const historyCardRefs = useRef<(HTMLLIElement | null)[]>([]);

	useEffect(() => {
		setPinnedHistoryPointIndices([]);
	}, [loadId]);

	useEffect(() => {
		const checkAuth = () => {
			setIsAuthenticated(clientAuth.isAuthenticated());
			setIsAuthLoading(false);
		};
		checkAuth();
		const onChange = () => checkAuth();
		window.addEventListener("focus", onChange);
		window.addEventListener("storage", onChange);
		document.addEventListener("visibilitychange", onChange);
		return () => {
			window.removeEventListener("focus", onChange);
			window.removeEventListener("storage", onChange);
			document.removeEventListener("visibilitychange", onChange);
		};
	}, []);

	useEffect(() => {
		setHistoryDragDraft(null);
		setHistoryEditShowApplyCancel(false);
	}, [editingHistoryPointIndex]);

	useEffect(() => {
		if (!canEditLoadHistory) {
			setEditingHistoryPointIndex(null);
			setHistoryDragDraft(null);
			setHistoryEditShowApplyCancel(false);
		}
	}, [canEditLoadHistory]);

	const clearHistoryPointSelection = useCallback(() => {
		setSelectedHistoryPointIndex(null);
		setEditingHistoryPointIndex(null);
		setHistoryDragDraft(null);
		setHistoryEditShowApplyCancel(false);
	}, []);

	const applyHistoryPointSelection = useCallback((index: number) => {
		setEditingHistoryPointIndex(prev => (prev !== null && prev !== index ? null : prev));
		setSelectedHistoryPointIndex(index);
		setPinnedHistoryPointIndices(prev => (prev.includes(index) ? prev : [...prev, index]));
	}, []);

	const handleLoadHistoryPointMarkerClick = useCallback(
		(index: number) => {
			const wasClosed = !isHistoryOpen;
			setIsHistoryOpen(true);
			applyHistoryPointSelection(index);
			window.setTimeout(
				() => {
					historyCardRefs.current[index]?.scrollIntoView({
						behavior: "smooth",
						block: "start",
					});
				},
				wasClosed ? 150 : 0
			);
		},
		[applyHistoryPointSelection, isHistoryOpen]
	);

	const [deletingHistoryPointId, setDeletingHistoryPointId] = useState<string | null>(null);
	const isPublicView = !isAuthLoading && !isAuthenticated;
	const trackingLoadDetailsQueryKey = [
		"tracking-load-details",
		loadId,
		isPublicView ? "public" : "auth",
	] as const;
	const cachedLoadDetails = queryClient.getQueryData(trackingLoadDetailsQueryKey) as
		| LoadDetailsResponse
		| undefined;
	const isLoadDeliveredFromCache = getLoadStatusFromDetails(cachedLoadDetails) === "delivered";

	const {
		data: loadDetails,
		isPending: isLoadDetailsPending,
		isError: isLoadDetailsError,
		error: loadDetailsError,
	} = useQuery({
		queryKey: trackingLoadDetailsQueryKey,
		queryFn: () => fetchTrackingLoadDetails(loadId, { publicView: isPublicView }),
		enabled: Boolean(loadId) && !isAuthLoading,
		staleTime: MAP_REFRESH_MIN_INTERVAL_MS,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: !isLoadDeliveredFromCache,
		refetchOnReconnect: !isLoadDeliveredFromCache,
	});
	const loadRest = getLoadRestFromDetails(loadDetails as LoadDetailsResponse | undefined);
	const isLoadResting = loadRest.isRest;

	const isPageLoading = isAuthLoading || isLoadDetailsPending;
	const isPageReady = !isPageLoading && Boolean(loadDetails);
	const lastMapRefreshAtRef = useRef(0);

	useEffect(() => {
		if (isPageReady && lastMapRefreshAtRef.current === 0) {
			lastMapRefreshAtRef.current = Date.now();
		}
	}, [isPageReady]);

	const refreshLoadDetails = useCallback(() => {
		lastMapRefreshAtRef.current = Date.now();
		return queryClient
			.invalidateQueries({
				queryKey: ["tracking-load-details", loadId],
			})
			.catch(error => {
				console.error("[TrackingLoadPage] Failed to refresh load details:", error);
			});
	}, [loadId, queryClient]);

	const refreshMapIfIntervalElapsed = useCallback(() => {
		if (Date.now() - lastMapRefreshAtRef.current < MAP_REFRESH_MIN_INTERVAL_MS) {
			return;
		}
		refreshLoadDetails();
	}, [refreshLoadDetails]);

	const routeGeocodeFromApi = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.routeGeocode ?? details?.data?.routeGeocode ?? null;
	}, [loadDetails]);

	const loadMetaData = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.meta_data ?? details?.data?.meta_data ?? null;
	}, [loadDetails]);
	const normalizedLoadStatus = normalizeTrackingStatus(loadMetaData?.load_status ?? null);
	const isLoadDelivered = normalizedLoadStatus === "delivered";
	const loadStatusLabel = formatLoadStatusLabel(loadMetaData?.load_status ?? null);
	const loadReferenceNumber = String(loadMetaData?.reference_number ?? "").trim();
	const loadRouteDetails = useMemo(
		() =>
			formatTmsLoadRoute(
				loadMetaData?.pick_up_location,
				loadMetaData?.delivery_location
			),
		[loadMetaData?.pick_up_location, loadMetaData?.delivery_location]
	);
	const loadRouteTotalMiles = useMemo(() => {
		const raw = loadMetaData?.all_miles;
		if (raw == null) return null;
		const text = String(raw).replace(/,/g, "").trim();
		if (!text) return null;
		const value = Number(text);
		if (!Number.isFinite(value)) return text;
		return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
	}, [loadMetaData?.all_miles]);
	const loadStatusAllowsDriverMarker =
		!LOAD_STATUSES_HIDE_DRIVER_MARKER.has(normalizedLoadStatus);

	useEffect(() => {
		if (!loadId || !isPageReady || isLoadDelivered) return;

		let baseUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL ||
			process.env.NEXT_PUBLIC_WS_URL ||
			"http://localhost:3000";

		if (baseUrl.startsWith("ws://")) {
			baseUrl = baseUrl.replace("ws://", "http://");
		} else if (baseUrl.startsWith("wss://")) {
			baseUrl = baseUrl.replace("wss://", "https://");
		}

		const socket = io(baseUrl.replace(/\/$/, ""), {
			transports: ["websocket", "polling"],
			timeout: 20000,
			forceNew: true,
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
		});

		socket.on("connect_error", error => {
			console.error("❌ [TrackingLoadPage] WebSocket connection error:", error);
		});

		socket.on("userLocationUpdate", (payload: LocationUpdatePayload) => {
			let matched = false;
			let trackingLoadIdChanged = false;
			queryClient.setQueryData(
				trackingLoadDetailsQueryKey,
				(current: LoadDetailsResponse | undefined) => {
					if (!current) return current;
					const drivers =
						current.data?.data?.drivers ?? current.data?.drivers ?? [];
					if (!locationPayloadMatchesLoadDriver(payload, loadId, drivers)) {
						return current;
					}
					matched = true;
					const payloadTracking = normalizeTrackingLoadId(payload.trackingLoadId);
					trackingLoadIdChanged = drivers.some((driver) => {
						const payloadUserId = String(payload.userId ?? "").trim();
						const payloadExternal = normalizeDriverExternalId(payload.externalId);
						const matches =
							(payloadUserId && String(driver.id ?? "").trim() === payloadUserId) ||
							(payloadExternal.length > 0 &&
								normalizeDriverExternalId(driver.externalId) === payloadExternal);
						if (!matches) return false;
						return (
							normalizeTrackingLoadId(driver.trackingLoadId) !== payloadTracking
						);
					});
					return patchLoadDetailsDriverLocation(current, payload);
				}
			);
			if (matched) refreshMapIfIntervalElapsed();
			if (trackingLoadIdChanged) {
				queryClient.invalidateQueries({ queryKey: trackingLoadDetailsQueryKey }).catch(
					() => undefined
				);
			}
		});

		socket.on("driverTrackingPointCreated", (payload: DriverTrackingPointCreatedPayload) => {
			if (normalizeTrackingLoadId(payload.loadId) !== loadId) return;
			refreshMapIfIntervalElapsed();
		});

		return () => {
			socket.disconnect();
		};
	}, [isLoadDelivered, isPageReady, loadId, queryClient, refreshMapIfIntervalElapsed]);

	const loadDrivers = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		const raw = details?.data?.data?.drivers ?? details?.data?.drivers ?? [];
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
			// Guard: enrichment must only return DRIVER; same externalId can belong to TRACKING staff.
			.filter(d => {
				const role = String(d.role ?? "").trim().toUpperCase();
				return !role || role === "DRIVER";
			})
			.map(d => normalizeTrackingLoadDriver(d)) as LoadDriver[];
	}, [loadDetails]);

	const sortedTrackingPoints = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		const trackingPoints =
			details?.data?.data?.trackingPoints ?? details?.data?.trackingPoints ?? [];

		return [...trackingPoints].sort((a, b) => {
			const aTime = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
			const bTime = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
			return aTime - bTime;
		});
	}, [loadDetails]);

	const loadHistoryDetails = useMemo(() => {
		return sortedTrackingPoints
			.map(point => {
				const latitude = Number(point.latitude);
				const longitude = Number(point.longitude);
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					return null;
				}
				const externalDriverId = point.externalDriverId?.trim() || null;
				const driver = externalDriverId
					? loadDrivers.find(item => item.externalId?.trim() === externalDriverId)
					: null;
				const attachedName = [driver?.firstName, driver?.lastName]
					.filter(Boolean)
					.join(" ")
					.trim();
				const driverName = attachedName || point.driverName?.trim() || "";
				return {
					id: point.id ?? null,
					position: [latitude, longitude] as [number, number],
					createdAt: point.createdAt ?? null,
					updatedAt: point.updatedAt ?? null,
					externalDriverId,
					driverName: driverName || null,
					placeLabel: point.placeLabel?.trim() || null,
					deviceId: point.deviceId?.trim() || null,
					deviceModel: point.deviceModel?.trim() || null,
					deviceName: point.deviceName?.trim() || null,
					devicePlatform: point.devicePlatform?.trim() || null,
					deviceLabel: formatTrackingDeviceLabel(point),
				};
			})
			.filter((point): point is LoadHistoryDetail => point !== null);
	}, [loadDrivers, sortedTrackingPoints]);

	const trackingDeviceHistoryGroups = useMemo<TrackingDeviceHistoryGroup[]>(() => {
		const groups = new Map<string, TrackingDeviceHistoryGroup>();

		for (const point of loadHistoryDetails) {
			const key = getTrackingDeviceGroupKey(point);
			const existing = groups.get(key);
			if (existing) {
				existing.points.push(point);
				continue;
			}
			groups.set(key, {
				key,
				label: formatTrackingDeviceTabLabel(point),
				points: [point],
			});
		}

		return Array.from(groups.values());
	}, [loadHistoryDetails]);

	useEffect(() => {
		if (trackingDeviceHistoryGroups.length === 0) {
			if (activeTrackingDeviceKey !== null) {
				setActiveTrackingDeviceKey(null);
			}
			return;
		}

		if (
			activeTrackingDeviceKey === null ||
			!trackingDeviceHistoryGroups.some(group => group.key === activeTrackingDeviceKey)
		) {
			setActiveTrackingDeviceKey(trackingDeviceHistoryGroups[0].key);
		}
	}, [activeTrackingDeviceKey, trackingDeviceHistoryGroups]);

	const activeLoadHistoryDetails = useMemo(() => {
		const activeGroup =
			trackingDeviceHistoryGroups.find(group => group.key === activeTrackingDeviceKey) ??
			trackingDeviceHistoryGroups[0];
		return activeGroup?.points ?? [];
	}, [activeTrackingDeviceKey, trackingDeviceHistoryGroups]);

	const activeLoadHistory = useMemo(
		() => activeLoadHistoryDetails.map(point => point.position),
		[activeLoadHistoryDetails]
	);

	const loadHistoryForMap = useMemo(() => {
		if (
			editingHistoryPointIndex === null ||
			historyDragDraft === null ||
			editingHistoryPointIndex >= activeLoadHistory.length
		) {
			return activeLoadHistory;
		}
		const next = [...activeLoadHistory];
		next[editingHistoryPointIndex] = historyDragDraft;
		return next;
	}, [activeLoadHistory, editingHistoryPointIndex, historyDragDraft]);

	const loadHistoryDetailsRef = useRef(activeLoadHistoryDetails);
	loadHistoryDetailsRef.current = activeLoadHistoryDetails;

	useEffect(() => {
		if (
			selectedHistoryPointIndex !== null &&
			selectedHistoryPointIndex >= activeLoadHistoryDetails.length
		) {
			setSelectedHistoryPointIndex(null);
		}
		if (
			editingHistoryPointIndex !== null &&
			editingHistoryPointIndex >= activeLoadHistoryDetails.length
		) {
			setEditingHistoryPointIndex(null);
		}
	}, [activeLoadHistoryDetails.length, editingHistoryPointIndex, selectedHistoryPointIndex]);

	const handleDeleteHistoryPoint = useCallback(
		async (pointId: string | null, pointIndex: number) => {
			if (!pointId || deletingHistoryPointId) return;

			setDeletingHistoryPointId(pointId);
			try {
				const response = await fetch(
					`/api/tms/load/${encodeURIComponent(loadId)}/tracking/${encodeURIComponent(pointId)}`,
					{ method: "DELETE" }
				);
				if (!response.ok) {
					const data = await response.json().catch(() => null);
					throw new Error(data?.error || "Failed to delete tracking point");
				}

				if (selectedHistoryPointIndex === pointIndex) {
					setSelectedHistoryPointIndex(null);
				} else if (
					selectedHistoryPointIndex !== null &&
					selectedHistoryPointIndex > pointIndex
				) {
					setSelectedHistoryPointIndex(selectedHistoryPointIndex - 1);
				}

				setPinnedHistoryPointIndices(prev =>
					prev.flatMap(index => {
						if (index === pointIndex) return [];
						if (index > pointIndex) return [index - 1];
						return [index];
					})
				);

				if (editingHistoryPointIndex === pointIndex) {
					setEditingHistoryPointIndex(null);
					setHistoryDragDraft(null);
					setHistoryEditShowApplyCancel(false);
				} else if (
					editingHistoryPointIndex !== null &&
					editingHistoryPointIndex > pointIndex
				) {
					setEditingHistoryPointIndex(editingHistoryPointIndex - 1);
				}

				await refreshLoadDetails();
			} catch (error) {
				console.error("[TrackingLoadPage] Failed to delete tracking point:", error);
			} finally {
				setDeletingHistoryPointId(null);
			}
		},
		[
			deletingHistoryPointId,
			editingHistoryPointIndex,
			loadId,
			refreshLoadDetails,
			selectedHistoryPointIndex,
		]
	);

	const handleHistoryEditDragEnd = useCallback(
		(lat: number, lng: number) => {
			setHistoryDragDraft([lat, lng]);
			const idx = editingHistoryPointIndex;
			if (idx === null) return;
			const orig = loadHistoryDetailsRef.current[idx]?.position;
			if (!orig) return;
			const changed = Math.abs(orig[0] - lat) > 1e-7 || Math.abs(orig[1] - lng) > 1e-7;
			setHistoryEditShowApplyCancel(changed);
		},
		[editingHistoryPointIndex]
	);

	const handleCancelHistoryPointEdit = useCallback(() => {
		setHistoryDragDraft(null);
		setHistoryEditShowApplyCancel(false);
		setEditingHistoryPointIndex(null);
	}, []);

	const handleApplyHistoryPointEdit = useCallback(async () => {
		const idx = editingHistoryPointIndex;
		const draft = historyDragDraft;
		if (idx === null || draft === null) return;
		const pointId = activeLoadHistoryDetails[idx]?.id;
		if (!pointId || savingHistoryPointId) return;

		setSavingHistoryPointId(pointId);
		try {
			const response = await fetch(
				`/api/tms/load/${encodeURIComponent(loadId)}/tracking/${encodeURIComponent(pointId)}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ latitude: draft[0], longitude: draft[1] }),
				}
			);
			if (!response.ok) {
				const data = await response.json().catch(() => null);
				throw new Error(data?.error || "Failed to update tracking point");
			}
			setHistoryDragDraft(null);
			setHistoryEditShowApplyCancel(false);
			setEditingHistoryPointIndex(null);
			await refreshLoadDetails();
		} catch (error) {
			console.error("[TrackingLoadPage] Failed to update tracking point:", error);
		} finally {
			setSavingHistoryPointId(null);
		}
	}, [
		activeLoadHistoryDetails,
		editingHistoryPointIndex,
		historyDragDraft,
		loadId,
		refreshLoadDetails,
		savingHistoryPointId,
	]);

	const currentTrackingDriver = useMemo(() => {
		// Active driver = last history point that names a driver (by externalId).
		// Scan backwards so a trailing point without externalDriverId does not hide the real active driver.
		if (sortedTrackingPoints.length > 0) {
			for (let i = sortedTrackingPoints.length - 1; i >= 0; i--) {
				const externalId = normalizeDriverExternalId(
					sortedTrackingPoints[i]?.externalDriverId
				);
				if (!externalId) continue;
				const fromHistory = loadDrivers.find(
					driver => normalizeDriverExternalId(driver.externalId) === externalId
				);
				if (fromHistory) return fromHistory;
			}
		}
		// No history (or no resolvable driver on points): always use first attached driver on load.
		return loadDrivers[0] ?? null;
	}, [loadDrivers, sortedTrackingPoints]);

	useEffect(() => {
		if (!loadDetails) return;

		let driverResolution: {
			source: "tracking_history" | "attached_driver_fallback" | "none";
			externalDriverId: string | null;
			trackingPointIndex: number | null;
		} = { source: "none", externalDriverId: null, trackingPointIndex: null };

		if (sortedTrackingPoints.length > 0) {
			for (let i = sortedTrackingPoints.length - 1; i >= 0; i--) {
				const externalId = normalizeDriverExternalId(
					sortedTrackingPoints[i]?.externalDriverId
				);
				if (!externalId) continue;
				const fromHistory = loadDrivers.find(
					driver => normalizeDriverExternalId(driver.externalId) === externalId
				);
				if (fromHistory) {
					driverResolution = {
						source: "tracking_history",
						externalDriverId: externalId,
						trackingPointIndex: i,
					};
					break;
				}
			}
		}
		if (driverResolution.source === "none" && loadDrivers[0]) {
			driverResolution = {
				source: "attached_driver_fallback",
				externalDriverId: normalizeDriverExternalId(loadDrivers[0].externalId),
				trackingPointIndex: null,
			};
		}

		console.group(`[TrackingLoadPage] page data load ${loadId}`);
		console.log("loadDetails (merged)", loadDetails);
		console.log("meta_data", loadMetaData);
		console.log("attached drivers from TMS", {
			attached_driver: loadMetaData?.attached_driver ?? null,
			attached_second_driver: loadMetaData?.attached_second_driver ?? null,
			attached_third_driver: loadMetaData?.attached_third_driver ?? null,
		});
		console.log("drivers (from DB, TMS order)", loadDrivers);
		console.log("trackingPoints", sortedTrackingPoints);
		console.log("currentTrackingDriver", currentTrackingDriver);
		console.log("driverResolution (why this driver was picked)", driverResolution);
		console.log("routeGeocode", routeGeocodeFromApi);
		console.groupEnd();
	}, [
		currentTrackingDriver,
		loadDetails,
		loadDrivers,
		loadId,
		loadMetaData,
		routeGeocodeFromApi,
		sortedTrackingPoints,
	]);

	const currentDriverLatitude = Number(currentTrackingDriver?.latitude);
	const currentDriverLongitude = Number(currentTrackingDriver?.longitude);
	const hasCurrentDriverCoordinates =
		Number.isFinite(currentDriverLatitude) && Number.isFinite(currentDriverLongitude);
	const normalizedDriverStatus = normalizeTrackingStatus(
		currentTrackingDriver?.driverStatus ?? null
	);
	const isDriverLoadedEnroute = normalizedDriverStatus === "loaded_enroute";
	// Blocked and expired-documents drivers stay on this load's map: history, last ping, and ETA.
	const driverStatusKeepsLoadTracking =
		normalizedDriverStatus === "blocked" || normalizedDriverStatus === "expired_documents";
	const canViewLiveTracking =
		isDriverLoadedEnroute || (driverStatusKeepsLoadTracking && loadStatusAllowsDriverMarker);
	const hasLastLocationUpdate = hasValidLastLocationUpdate(
		currentTrackingDriver?.lastLocationUpdateAt
	);
	const showDriverLiveMarker =
		canViewLiveTracking &&
		loadStatusAllowsDriverMarker &&
		hasCurrentDriverCoordinates &&
		hasLastLocationUpdate;

	const driverCardData = useMemo(
		() => ({
			id: currentTrackingDriver?.id ?? null,
			email: currentTrackingDriver?.email ?? null,
			externalId: currentTrackingDriver?.externalId ?? null,
			firstName: currentTrackingDriver?.firstName ?? "",
			lastName: currentTrackingDriver?.lastName ?? "",
			phone: currentTrackingDriver?.phone ?? "",
			profilePhoto: currentTrackingDriver?.profilePhoto ?? null,
			driverStatus: currentTrackingDriver?.driverStatus ?? null,
			status: currentTrackingDriver?.status ?? null,
			city: currentTrackingDriver?.city ?? null,
			state: currentTrackingDriver?.state ?? null,
			zip: currentTrackingDriver?.zip ?? null,
			latitude: hasCurrentDriverCoordinates ? currentDriverLatitude : null,
			longitude: hasCurrentDriverCoordinates ? currentDriverLongitude : null,
			lastLocationUpdateAt: currentTrackingDriver?.lastLocationUpdateAt ?? null,
			lastActiveApp: currentTrackingDriver?.lastActiveApp ?? null,
		}),
		[
			currentDriverLatitude,
			currentDriverLongitude,
			currentTrackingDriver,
			hasCurrentDriverCoordinates,
		]
	);

	const loadShippers = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		const raw = details?.data?.data?.shippers ?? details?.data?.shippers ?? [];
		return Array.isArray(raw) ? raw : [];
	}, [loadDetails]);

	const mapLoadData = useMemo(
		() => ({
			...driverCardData,
			latitude: showDriverLiveMarker ? currentDriverLatitude : null,
			longitude: showDriverLiveMarker ? currentDriverLongitude : null,
			pick_up_location: loadMetaData?.pick_up_location ?? null,
			delivery_location: loadMetaData?.delivery_location ?? null,
			shippers: loadShippers,
			routeGeocode:
				routeGeocodeFromApi?.pickup && routeGeocodeFromApi?.delivery
					? routeGeocodeFromApi
					: null,
			load_history: loadHistoryForMap,
			load_history_details: activeLoadHistoryDetails,
		}),
		[
			activeLoadHistoryDetails,
			driverCardData,
			showDriverLiveMarker,
			currentDriverLatitude,
			currentDriverLongitude,
			loadMetaData,
			loadShippers,
			routeGeocodeFromApi,
			loadHistoryForMap,
		]
	);

	const { usesMobileApp: driverUsesMobileApp } = useResolvedDriverLastActiveApp(
		currentTrackingDriver?.externalId,
		currentTrackingDriver?.lastActiveApp
	);

	const loadQualifiesForStaleTrackingCheck =
		LOAD_STATUSES_STALE_TRACKING.has(normalizedLoadStatus);
	const showStaleLocationMessage = Boolean(
		isAuthenticated &&
		currentTrackingDriver &&
		driverUsesMobileApp &&
		canViewLiveTracking &&
		loadQualifiesForStaleTrackingCheck &&
		hasLastLocationUpdate &&
		!isLoadResting &&
		isLastLocationOlderThanNy(
			currentTrackingDriver.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		)
	);

	const driverStatusLabel = getStatusLabelForFilter(currentTrackingDriver?.driverStatus ?? null);

	const mapUiMode: "map" | "no_app" | "driver_not_loaded_enroute" = (() => {
		if (currentTrackingDriver && !driverUsesMobileApp) return "no_app";
		if (
			currentTrackingDriver &&
			driverUsesMobileApp &&
			!canViewLiveTracking &&
			!isLoadDelivered
		) {
			return "driver_not_loaded_enroute";
		}
		return "map";
	})();

	const showMapAndTrackingTools = mapUiMode === "map";
	const showLoadHistoryPanel = Boolean(
		isAuthenticated &&
		showMapAndTrackingTools &&
		(canViewLiveTracking || isLoadDelivered)
	);
	const showCurrentLocationHistoryCard = Boolean(
		showLoadHistoryPanel &&
		canViewLiveTracking &&
		LOAD_STATUSES_SHOW_CURRENT_LOCATION.has(normalizedLoadStatus) &&
		hasCurrentDriverCoordinates &&
		hasLastLocationUpdate
	);
	const currentLocationPlaceLabel = formatDriverLocationLine(
		currentTrackingDriver?.city,
		currentTrackingDriver?.state,
		currentTrackingDriver?.zip
	);
	const loadHistoryPanelCount = loadHistoryDetails.length;
	const activeLoadHistoryPanelCount = activeLoadHistoryDetails.length;
	const hasLoadHistoryPanelItems =
		activeLoadHistoryPanelCount > 0 || showCurrentLocationHistoryCard;
	/** Keep top banners centered in the same lane even when history panel is hidden. */
	const reserveTopBannerRightLane = isAuthenticated && showMapAndTrackingTools;
	const showBackButton =
		!embedded &&
		isAuthenticated &&
		(mapUiMode === "map" || mapUiMode === "driver_not_loaded_enroute");

	const pickupGeocode = routeGeocodeFromApi?.pickup ?? null;
	const deliveryGeocode = routeGeocodeFromApi?.delivery ?? null;
	const loadRoutePoints = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return parseLoadRoutePoints(
			details?.data?.data?.loadRoute ?? details?.data?.loadRoute ?? []
		);
	}, [loadDetails]);
	const hasFreshLastLocationUpdate =
		hasLastLocationUpdate &&
		!isLastLocationOlderThanNy(
			currentTrackingDriver?.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		);
	const roadEtaStop = useMemo((): RoadEtaStop | null => {
		if (!showMapAndTrackingTools || !canViewLiveTracking) return null;
		if (normalizedLoadStatus === "waiting_on_pu_date") {
			if (!pickupGeocode) return null;
			const lat = Number(pickupGeocode.lat);
			const lng = Number(pickupGeocode.lng);
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
			return {
				kind: "first_pickup",
				lat,
				lng,
				addressLabel: pickupGeocode.addressLabel?.trim() || `${lat}, ${lng}`,
			};
		}
		if (normalizedLoadStatus === "loaded_enroute") {
			const next = findNextUnpassedRoutePoint(loadRoutePoints, {
				skipFirstPickup: true,
				driver: hasCurrentDriverCoordinates
					? { lat: currentDriverLatitude, lng: currentDriverLongitude }
					: null,
			});
			if (next) return next;
			if (!deliveryGeocode) return null;
			const lat = Number(deliveryGeocode.lat);
			const lng = Number(deliveryGeocode.lng);
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
			return {
				kind: "delivery",
				lat,
				lng,
				addressLabel: deliveryGeocode.addressLabel?.trim() || `${lat}, ${lng}`,
			};
		}
		return null;
	}, [
		canViewLiveTracking,
		currentDriverLatitude,
		currentDriverLongitude,
		deliveryGeocode,
		hasCurrentDriverCoordinates,
		loadRoutePoints,
		normalizedLoadStatus,
		pickupGeocode,
		showMapAndTrackingTools,
	]);
	const busyOnLoad = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return parseBusyOnOtherLoad(
			details?.data?.data?.busyOnLoad ?? details?.data?.busyOnLoad ?? null
		);
	}, [loadDetails]);
	const showPickupRoadEta = Boolean(
		!busyOnLoad &&
			roadEtaStop &&
			hasCurrentDriverCoordinates &&
			hasLastLocationUpdate
	);
	const roadEtaCopy = roadEtaBannerCopy(roadEtaStop?.kind ?? "first_pickup");

	const pickupEtaDriver = useMemo((): { lat: number; lng: number } | null => {
		if (!showPickupRoadEta || !hasCurrentDriverCoordinates) return null;
		return { lat: currentDriverLatitude, lng: currentDriverLongitude };
	}, [
		showPickupRoadEta,
		hasCurrentDriverCoordinates,
		currentDriverLatitude,
		currentDriverLongitude,
	]);

	const pickupEtaPickup = useMemo((): { lat: number; lng: number } | null => {
		if (!showPickupRoadEta || !roadEtaStop) return null;
		return { lat: roadEtaStop.lat, lng: roadEtaStop.lng };
	}, [showPickupRoadEta, roadEtaStop]);

	const pickupEtaDestination = useMemo(() => {
		const fromStop = roadEtaStop?.addressLabel?.trim() ?? "";
		if (fromStop) return fromStop;
		if (pickupEtaPickup) {
			return `${pickupEtaPickup.lat}, ${pickupEtaPickup.lng}`;
		}
		return "";
	}, [pickupEtaPickup, roadEtaStop?.addressLabel]);

	const storedRoadEta = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return parseStoredRoadEta(
			details?.data?.data?.roadEta ?? details?.data?.roadEta ?? null
		);
	}, [loadDetails]);
	const canonicalPickupEta =
		showPickupRoadEta &&
		hasFreshLastLocationUpdate &&
		storedRoadEta &&
		storedRoadEta.kind === roadEtaStop?.kind &&
		isStoredRoadEtaFresh(storedRoadEta, currentTrackingDriver?.lastLocationUpdateAt) &&
		storedRoadEtaMatchesStop(
			storedRoadEta,
			hasCurrentDriverCoordinates
				? { lat: currentDriverLatitude, lng: currentDriverLongitude }
				: null,
			roadEtaStop
		)
			? storedRoadEta
			: null;

	const pickupRoadEta = usePickupRoadEta({
		enabled: showPickupRoadEta,
		driver: pickupEtaDriver,
		pickup: pickupEtaPickup,
		destination: pickupEtaDestination,
		canonicalEta: canonicalPickupEta,
	});

	const showLoadedEnrouteStaleBanner = Boolean(
		isAuthenticated &&
		showMapAndTrackingTools &&
		currentTrackingDriver &&
		driverUsesMobileApp &&
		canViewLiveTracking &&
		normalizedLoadStatus === "loaded_enroute" &&
		hasLastLocationUpdate &&
		!isLoadResting &&
		isLastLocationOlderThanNy(
			currentTrackingDriver.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		)
	);
	const showDeliveredLoadBanner = Boolean(showMapAndTrackingTools && isLoadDelivered);

	const driverStaleLocationBanner =
		showStaleLocationMessage || showLoadedEnrouteStaleBanner
			? { thresholdLabel: formatStaleThresholdLabel(), hidesMap: false }
			: null;

	return (
		<section
			className={
				embedded
					? "relative h-full w-full overflow-hidden bg-[#eef8fb]"
					: "absolute inset-0 h-full w-full overflow-hidden bg-[#eef8fb]"
			}
			data-load-id={loadId}
		>
			{isPageLoading && (
				<div
					className="absolute inset-0 z-[2000] flex items-center justify-center bg-white dark:bg-gray-950"
					aria-busy="true"
					aria-live="polite"
				>
					<div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-8 py-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
						<div
							className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-600 dark:border-t-brand-400"
							aria-hidden
						/>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-200">
							Loading load data...
						</p>
					</div>
				</div>
			)}

			{isLoadDetailsError && !isPageLoading && (
				<div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white dark:bg-gray-950 px-6">
					<p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
						{loadDetailsError instanceof Error
							? loadDetailsError.message
							: "Failed to load data"}
					</p>
				</div>
			)}

			{!isAuthLoading && showBackButton && (
				<button
					type="button"
					onClick={() => router.back()}
					className="absolute left-4 top-4 z-[1000] inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium leading-none text-slate-600 shadow-sm backdrop-blur transition-colors hover:border-brand-300 hover:text-brand-600"
					aria-label="Go back"
				>
					<svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
						<path
							d="M12.7083 5L7.5 10.2083L12.7083 15.4167"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					Back
				</button>
			)}

			{isPageReady && (
				<>
					{mapUiMode === "no_app" && (
						<div
							className={`absolute inset-0 z-[500] flex items-start justify-center bg-white px-6 ${
								embedded ? "pt-6" : "pt-16"
							}`}
						>
							<TrackingStatusCard
								tone="info"
								icon="phone"
								title="Driver is not using the mobile app"
							>
								Map, load history, and live tracking are unavailable until the driver
								opens the mobile application at least once.
							</TrackingStatusCard>
						</div>
					)}
					{mapUiMode === "driver_not_loaded_enroute" && !embedded && (
						<DriverNotLoadedEnroutePanel
							driverStatusLabel={driverStatusLabel}
							driverExternalId={currentTrackingDriver?.externalId}
						/>
					)}
					{mapUiMode === "driver_not_loaded_enroute" && embedded && (
						<div className="absolute inset-0 z-[500] flex items-start justify-center bg-white px-6 pt-6">
							<TrackingStatusCard
								tone="info"
								icon="load"
								title="Driver is not loaded & enroute"
							>
								Map tracking will appear once the load status is Loaded & Enroute.
							</TrackingStatusCard>
						</div>
					)}
					{showMapAndTrackingTools && (
						<>
							{!embedded && showPickupRoadEta ? (
								<PickupRoadEtaBanner
									status={pickupRoadEta.status}
									eta={pickupRoadEta.eta}
									pickupAddressLabel={roadEtaStop?.addressLabel}
									title={roadEtaCopy.title}
									loadingLabel={roadEtaCopy.loading}
									reserveRightForHistory={reserveTopBannerRightLane}
								/>
							) : !embedded && showDeliveredLoadBanner ? (
								<DeliveredLoadBanner
									reserveRightForHistory={reserveTopBannerRightLane}
								/>
							) : null}
							<TrackingDeliveryMap
								driverData={mapLoadData}
								showEmptyMap
								forceLightMapBasemap
								enableBasemapModeSwitch
								basemapSwitchBelowBack={!embedded}
								initialZoom={4}
								selectedLoadHistoryPointIndex={
									isAuthenticated ? selectedHistoryPointIndex : null
								}
								editingLoadHistoryPointIndex={
									isAuthenticated && canEditLoadHistory
										? editingHistoryPointIndex
										: null
								}
								onLoadHistoryPointMarkerClick={
									isAuthenticated ? handleLoadHistoryPointMarkerClick : undefined
								}
								onMapBackgroundClick={
									isAuthenticated ? clearHistoryPointSelection : undefined
								}
								historyEditDragPosition={
									isAuthenticated && canEditLoadHistory ? historyDragDraft : null
								}
								onHistoryEditPointDragEnd={
									isAuthenticated && canEditLoadHistory
										? handleHistoryEditDragEnd
										: undefined
								}
								showDriverInHistoryPopup={isAuthenticated}
								pinnedHistoryPointIndices={pinnedHistoryPointIndices}
							/>
						</>
					)}
					{showLoadHistoryPanel && (
						<div
							className={`absolute right-4 top-4 z-[1000] flex max-h-[55vh] flex-col overflow-hidden rounded-[14px] bg-white font-[Manrope,sans-serif] shadow-[0_8px_24px_rgba(8,20,41,0.12)] ${
								embedded
									? "w-[min(320px,calc(100%-2rem))]"
									: "w-[363px] max-w-[calc(100%-2rem)]"
							}`}
						>
							<button
								type="button"
								className="flex w-full shrink-0 items-center justify-between gap-3 px-[18px] pb-4 pt-[14px] text-left"
								onClick={() => setIsHistoryOpen(value => !value)}
							>
								<span className="flex items-center gap-2 text-[13px] font-semibold leading-[18px] text-[#09172E]">
									Load history
									<span className="rounded-[9px] bg-[#E8EEFF] px-2 py-[3px] text-[10px] font-bold leading-[14px] text-[#3D6EF5]">
										{loadHistoryPanelCount}
									</span>
								</span>
								<span className="text-[13px] font-medium text-[#3D6EF5]">
									{isHistoryOpen ? "Hide" : "Show"}
								</span>
							</button>
							{isHistoryOpen && trackingDeviceHistoryGroups.length > 0 ? (
								<div className="shrink-0 px-[18px] pb-3">
									<div
										className="flex flex-wrap gap-2"
										role="tablist"
										aria-label="Tracking devices"
									>
										{trackingDeviceHistoryGroups.map(group => {
											const selectedDeviceKey =
												activeTrackingDeviceKey ??
												trackingDeviceHistoryGroups[0]?.key;
											const isActive = group.key === selectedDeviceKey;
											return (
												<button
													key={group.key}
													type="button"
													role="tab"
													aria-selected={isActive}
													className={`inline-flex max-w-full items-center gap-[7px] rounded-full px-3 py-2 text-[11px] font-semibold leading-[15px] transition-colors ${
														isActive
															? "bg-[#4477FF] text-white"
															: "bg-white text-[#4477FF] ring-1 ring-inset ring-[#4477FF]"
													}`}
													title={group.label}
													onClick={() => {
														if (group.key === activeTrackingDeviceKey)
															return;
														setActiveTrackingDeviceKey(group.key);
														setPinnedHistoryPointIndices([]);
														clearHistoryPointSelection();
														historyCardRefs.current = [];
													}}
												>
													<span className="truncate">{group.label}</span>
													<span
														className={`rounded-lg px-[7px] py-0.5 text-[9px] font-bold leading-[13px] ${
															isActive
																? "bg-[#6B94FF] text-white"
																: "bg-[rgba(107,148,255,0.35)] text-[#4477FF]"
														}`}
													>
														{group.points.length}
													</span>
												</button>
											);
										})}
									</div>
								</div>
							) : null}
							{isHistoryOpen && (
								<div
									className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4"
								>
									{hasLoadHistoryPanelItems ? (
										<ol className="space-y-3">
											{activeLoadHistoryDetails.map((point, index) => {
												const isEditingCard =
													editingHistoryPointIndex === index;
												const isSelectedCard =
													selectedHistoryPointIndex === index;
												const displayCoords =
													isEditingCard && historyDragDraft
														? historyDragDraft
														: point.position;

												const cardTone =
													isEditingCard || isSelectedCard
														? "bg-[#E8EEFF] ring-1 ring-[#4477FF]"
														: "bg-[#F7F9FC]";

												return (
													<li
														key={
															point.id ??
															`${point.position[0]}-${point.position[1]}-${point.createdAt ?? index}`
														}
														ref={el => {
															historyCardRefs.current[index] = el;
														}}
													>
														<div
															role="button"
															tabIndex={0}
															className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${cardTone}`}
															onClick={() => {
																applyHistoryPointSelection(index);
															}}
															onKeyDown={event => {
																if (
																	event.key === "Enter" ||
																	event.key === " "
																) {
																	event.preventDefault();
																	applyHistoryPointSelection(
																		index
																	);
																}
															}}
														>
															<div className="mb-1 flex items-start justify-between gap-2">
																<p className="text-[12px] font-bold leading-[17px] text-[#09172E]">
																	Step {index + 1}
																</p>
																{canEditLoadHistory ? (
																	<div className="flex items-center gap-2">
																		{isEditingCard &&
																		historyEditShowApplyCancel ? (
																			<>
																				<button
																					type="button"
																					className="rounded-full bg-[#4477FF] px-2.5 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
																					disabled={
																						Boolean(
																							savingHistoryPointId
																						) ||
																						!point.id
																					}
																					onClick={event => {
																						event.stopPropagation();
																						handleApplyHistoryPointEdit();
																					}}
																				>
																					Apply
																				</button>
																				<button
																					type="button"
																					className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#637899] ring-1 ring-[#DDE5F1] disabled:cursor-not-allowed disabled:opacity-60"
																					disabled={Boolean(
																						savingHistoryPointId
																					)}
																					onClick={event => {
																						event.stopPropagation();
																						handleCancelHistoryPointEdit();
																					}}
																				>
																					Cancel
																				</button>
																			</>
																		) : (
																			<>
																				<button
																					type="button"
																					className="inline-flex h-4 w-4 items-center justify-center"
																					aria-label="Edit history point"
																					onClick={event => {
																						event.stopPropagation();
																						setSelectedHistoryPointIndex(
																							index
																						);
																						setEditingHistoryPointIndex(
																							index
																						);
																					}}
																				>
																					<svg
																						width="16"
																						height="16"
																						viewBox="0 0 16 16"
																						fill="none"
																						aria-hidden="true"
																					>
																						<path
																							d="M14.0107 2.932L13.068 1.98933C12.3533 1.27467 11.19 1.27533 10.4753 1.98933L3.37734 9.08667C3.03134 9.43267 2.76667 9.86067 2.61267 10.324L2.08 11.9227C1.88934 12.4933 2.036 13.112 2.46134 13.5387C2.764 13.8407 3.16334 14.0013 3.574 14.0013C3.74134 14.0013 3.91134 13.9747 4.07667 13.9193L5.67534 13.3867C6.13934 13.232 6.56734 12.9673 6.91267 12.622L14.01 5.52467C14.7247 4.81 14.7247 3.64667 14.01 2.932H14.0107ZM3.76067 12.9713C3.552 13.0407 3.32467 12.988 3.16867 12.832C3.01267 12.676 2.95934 12.4487 3.02867 12.24L3.50467 10.8113L5.18867 12.4953L3.76067 12.9713ZM6.20667 11.9153C6.176 11.946 6.13667 11.9673 6.104 11.9967L4.004 9.89667C4.03267 9.864 4.054 9.82467 4.08534 9.794L9.41467 4.46467L11.536 6.586L6.20667 11.9153ZM13.304 4.818L12.2433 5.87867L10.122 3.75733L11.1827 2.69667C11.3453 2.534 11.5587 2.45333 11.772 2.45333C11.9853 2.45333 12.1987 2.53467 12.3613 2.69667L13.304 3.63933C13.6287 3.964 13.6287 4.49333 13.304 4.818Z"
																							fill="#4477FF"
																						/>
																					</svg>
																				</button>
																				<button
																					type="button"
																					className="inline-flex h-[18px] w-[18px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
																					aria-label="Delete history point"
																					disabled={
																						!point.id ||
																						deletingHistoryPointId ===
																							point.id
																					}
																					onClick={event => {
																						event.stopPropagation();
																						handleDeleteHistoryPoint(
																							point.id,
																							index
																						);
																					}}
																				>
																					<svg
																						width="18"
																						height="18"
																						viewBox="0 0 18 18"
																						fill="none"
																						aria-hidden="true"
																					>
																						<path
																							d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
																							stroke="#5C6E8C"
																							strokeLinecap="round"
																						/>
																					</svg>
																				</button>
																			</>
																		)}
																	</div>
																) : null}
															</div>
															<div className="text-[10px] font-medium leading-[14px] text-[#637899]">
																<p>
																	Coordinates: {displayCoords[0].toFixed(6)},{" "}
																	{displayCoords[1].toFixed(6)}
																</p>
																{point.driverName || point.externalDriverId ? (
																	<p>
																		Driver:{" "}
																		{point.driverName || point.externalDriverId}
																	</p>
																) : null}
																{point.placeLabel ? (
																	<p>Place: {point.placeLabel}</p>
																) : null}
																{point.deviceLabel ? (
																	<p>Device: {point.deviceLabel}</p>
																) : null}
																<p>Tracked: {formatHistoryDate(point.createdAt)}</p>
															</div>
														</div>
													</li>
												);
											})}
											{showCurrentLocationHistoryCard ? (
												<li key="current-location">
													<div className="w-full rounded-xl bg-[#E8EEFF] px-3 py-3 text-left">
														<p className="mb-1 text-[12px] font-bold leading-[17px] text-[#09172E]">
															Last location update
														</p>
														<div className="text-[10px] font-medium leading-[14px] text-[#637899]">
															<p>
																Coordinates: {currentDriverLatitude.toFixed(6)},{" "}
																{currentDriverLongitude.toFixed(6)}
															</p>
															{currentLocationPlaceLabel !== "N/A" ? (
																<p>Place: {currentLocationPlaceLabel}</p>
															) : null}
															<p>
																Tracked:{" "}
																{formatHistoryDate(
																	currentTrackingDriver?.lastLocationUpdateAt ??
																		null
																)}
															</p>
														</div>
													</div>
												</li>
											) : null}
										</ol>
									) : (
										<p className="text-[12px] font-medium text-[#637899]">
											No history points yet.
										</p>
									)}
								</div>
							)}
						</div>
					)}
					{!embedded &&
						isAuthenticated &&
						currentTrackingDriver &&
						!isLoadDelivered && (
						<div
							className={`absolute bottom-6 z-[1000] flex justify-center ${
								loadRouteDetails.trim()
									? "left-4 right-4"
									: "left-1/2 -translate-x-1/2"
							} ${
								loadRouteDetails.trim()
									? ""
									: getDriverInfoCardWidthClass(false)
							}`}
						>
							<DriverInfo
								driverData={driverCardData}
								loadId={loadId}
								loadNumber={loadReferenceNumber}
								loadStatusLabel={loadStatusLabel}
								loadStatus={normalizedLoadStatus}
								routeDetails={loadRouteDetails}
								routeTotalMiles={loadRouteTotalMiles}
								remainingMiles={busyOnLoad ? null : storedRoadEta?.remainingMiles ?? null}
								includeLocationUpdateMiles={!busyOnLoad}
								showLoadTrackingActions={mapUiMode !== "no_app"}
								staleLocationBanner={driverStaleLocationBanner}
								isRest={loadRest.isRest}
								restDate={loadRest.restDate}
								restStartedAt={loadRest.restStartedAt}
								onRestChanged={update => {
									queryClient.setQueryData(
										trackingLoadDetailsQueryKey,
										(current: LoadDetailsResponse | undefined) =>
											patchTrackingLoadDetailsRest(current, update)
									);
								}}
							/>
						</div>
					)}
					{embedded &&
						isAuthenticated &&
						currentTrackingDriver &&
						!isLoadDelivered &&
						showMapAndTrackingTools && (
							<EmbeddedTrackingDriverSheet
								isOpen={isDriverInfoOpen}
								onToggle={() => setIsDriverInfoOpen(prev => !prev)}
								toggleTopClassName="top-16"
								driver={{
									id: currentTrackingDriver.id,
									firstName: currentTrackingDriver.firstName,
									lastName: currentTrackingDriver.lastName,
									email: currentTrackingDriver.email,
									externalId: currentTrackingDriver.externalId,
									phone: currentTrackingDriver.phone,
									profilePhoto: currentTrackingDriver.profilePhoto,
									driverStatus: currentTrackingDriver.driverStatus,
									latitude: hasCurrentDriverCoordinates
										? currentDriverLatitude
										: null,
									longitude: hasCurrentDriverCoordinates
										? currentDriverLongitude
										: null,
									lastLocationUpdateAt:
										currentTrackingDriver.lastLocationUpdateAt,
									lastActiveApp: currentTrackingDriver.lastActiveApp,
									driverStatusLabel,
									loadStatusLabel,
									loadNumber: loadReferenceNumber,
									loadId,
									totalMiles: loadRouteTotalMiles,
									currentLocation:
										currentLocationPlaceLabel !== "N/A"
											? currentLocationPlaceLabel
											: null,
								}}
							/>
						)}
				</>
			)}
		</section>
	);
}
