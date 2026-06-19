"use client";

import { fetchTrackingLoadDetails } from "@/lib/fetchTrackingLoadDetails";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { clientAuth } from "@/utils/auth";
import { canEditLoadTrackingHistory } from "@/utils/roleAccess";
import { useCurrentUser } from "@/stores/userStore";
import DriverInfo from "../../[id]/DriverInfo";
import DriverNotLoadedEnroutePanel from "@/components/logistics/DriverNotLoadedEnroutePanel";
import DeliveredLoadBanner from "@/components/logistics/DeliveredLoadBanner";
import LoadedEnrouteStaleLocationBanner from "@/components/logistics/LoadedEnrouteStaleLocationBanner";
import PickupRoadEtaBanner from "@/components/logistics/PickupRoadEtaBanner";
import { getStatusLabelForFilter } from "@/components/logistics/driversMapConstants";
import { usePickupRoadEta } from "@/hooks/usePickupRoadEta";
import { formatDriverLocationLine } from "@/utils/formatDriverLocation";
import { normalizeDriverExternalId, normalizeTrackingLoadDriver } from "@/utils/trackingLoadDriver";
import { useResolvedDriverLastActiveApp } from "@/hooks/useResolvedDriverLastActiveApp";
import { formatNyWallClockForDisplay, isLastLocationOlderThanNy } from "@/utils/nyWallClock";

const STALE_LOCATION_THRESHOLD: { hours?: number; minutes?: number } = { hours: 3 };

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

/** Load statuses where stale-location map hide applies (at / before pickup). */
const LOAD_STATUSES_STALE_TRACKING = new Set(["waiting_on_pu_date", "at_pu"]);

/** Load statuses where live driver location is appended to history list. */
const LOAD_STATUSES_SHOW_CURRENT_LOCATION = new Set(["loaded_enroute", "at_del"]);

type LoadTrackingPoint = {
	id?: string | null;
	externalDriverId?: string | null;
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
	externalId?: string | null;
	trackingLoadId?: string | null;
};

type DriverTrackingPointCreatedPayload = {
	loadId?: string | null;
};

function formatHistoryDate(dateString: string | null) {
	return formatNyWallClockForDisplay(dateString);
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

export default function TrackingLoadPageClient({ loadId }: TrackingLoadPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const canEditLoadHistory = canEditLoadTrackingHistory(currentUser?.role);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isAuthLoading, setIsAuthLoading] = useState(true);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [activeTrackingDeviceKey, setActiveTrackingDeviceKey] = useState<string | null>(null);
	const [selectedHistoryPointIndex, setSelectedHistoryPointIndex] = useState<number | null>(null);
	const [editingHistoryPointIndex, setEditingHistoryPointIndex] = useState<number | null>(null);
	const [historyDragDraft, setHistoryDragDraft] = useState<[number, number] | null>(null);
	const [historyEditShowApplyCancel, setHistoryEditShowApplyCancel] = useState(false);
	const [savingHistoryPointId, setSavingHistoryPointId] = useState<string | null>(null);
	const historyCardRefs = useRef<(HTMLLIElement | null)[]>([]);

	useEffect(() => {
		const checkAuth = () => {
			setIsAuthenticated(clientAuth.isAuthenticated());
			setIsAuthLoading(false);
		};
		checkAuth();
		const interval = setInterval(checkAuth, 1000);
		return () => clearInterval(interval);
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
		staleTime: 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: !isLoadDeliveredFromCache,
		refetchOnReconnect: !isLoadDeliveredFromCache,
	});

	useEffect(() => {
		if (!loadId || isAuthLoading || !isAuthenticated) return;
		queryClient
			.invalidateQueries({
				queryKey: ["tracking-load-details", loadId],
			})
			.catch(() => {});
	}, [loadId, isAuthLoading, isAuthenticated, queryClient]);

	const isPageLoading = isAuthLoading || isLoadDetailsPending;
	const isPageReady = !isPageLoading && Boolean(loadDetails);

	const refreshLoadDetails = useCallback(() => {
		return queryClient
			.invalidateQueries({
				queryKey: ["tracking-load-details", loadId],
			})
			.catch(error => {
				console.error("[TrackingLoadPage] Failed to refresh load details:", error);
			});
	}, [loadId, queryClient]);

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
			if (payload.trackingLoadId?.trim() === loadId) {
				refreshLoadDetails();
			}
		});

		socket.on("driverTrackingPointCreated", (payload: DriverTrackingPointCreatedPayload) => {
			if (payload.loadId?.trim() === loadId) {
				refreshLoadDetails();
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [isLoadDelivered, isPageReady, loadId, refreshLoadDetails]);

	const loadDrivers = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		const raw = details?.data?.data?.drivers ?? details?.data?.drivers ?? [];
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
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
				const driverName = [driver?.firstName, driver?.lastName]
					.filter(Boolean)
					.join(" ")
					.trim();
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

	const currentDriverLatitude = Number(currentTrackingDriver?.latitude);
	const currentDriverLongitude = Number(currentTrackingDriver?.longitude);
	const hasCurrentDriverCoordinates =
		Number.isFinite(currentDriverLatitude) && Number.isFinite(currentDriverLongitude);
	const isDriverLoadedEnroute =
		normalizeTrackingStatus(currentTrackingDriver?.driverStatus ?? null) === "loaded_enroute";
	const hasLastLocationUpdate = hasValidLastLocationUpdate(
		currentTrackingDriver?.lastLocationUpdateAt
	);
	const showDriverLiveMarker =
		isDriverLoadedEnroute &&
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
		isDriverLoadedEnroute &&
		loadQualifiesForStaleTrackingCheck &&
		hasLastLocationUpdate &&
		isLastLocationOlderThanNy(
			currentTrackingDriver.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		)
	);

	const driverStatusLabel = getStatusLabelForFilter(currentTrackingDriver?.driverStatus ?? null);

	const mapUiMode: "map" | "no_app" | "driver_not_loaded_enroute" | "stale_location" = (() => {
		if (currentTrackingDriver && !driverUsesMobileApp) return "no_app";
		if (
			currentTrackingDriver &&
			driverUsesMobileApp &&
			!isDriverLoadedEnroute &&
			!isLoadDelivered
		) {
			return "driver_not_loaded_enroute";
		}
		if (showStaleLocationMessage) return "stale_location";
		return "map";
	})();

	const showMapAndTrackingTools = mapUiMode === "map";
	const showLoadHistoryPanel = Boolean(
		isAuthenticated &&
		showMapAndTrackingTools &&
		(isDriverLoadedEnroute || isLoadDelivered) &&
		!LOAD_STATUSES_STALE_TRACKING.has(normalizedLoadStatus)
	);
	const showCurrentLocationHistoryCard = Boolean(
		showLoadHistoryPanel &&
		isDriverLoadedEnroute &&
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
		isAuthenticated &&
		(mapUiMode === "map" ||
			mapUiMode === "stale_location" ||
			mapUiMode === "driver_not_loaded_enroute");

	const pickupGeocode = routeGeocodeFromApi?.pickup ?? null;
	const hasFreshLastLocationUpdate =
		hasLastLocationUpdate &&
		!isLastLocationOlderThanNy(
			currentTrackingDriver?.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		);
	const showPickupRoadEta = Boolean(
		showMapAndTrackingTools &&
		isDriverLoadedEnroute &&
		normalizedLoadStatus === "waiting_on_pu_date" &&
		hasCurrentDriverCoordinates &&
		hasFreshLastLocationUpdate &&
		pickupGeocode &&
		Number.isFinite(Number(pickupGeocode.lat)) &&
		Number.isFinite(Number(pickupGeocode.lng))
	);

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
		if (!showPickupRoadEta || !pickupGeocode) return null;
		const lat = Number(pickupGeocode.lat);
		const lng = Number(pickupGeocode.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		return { lat, lng };
	}, [showPickupRoadEta, pickupGeocode?.lat, pickupGeocode?.lng]);

	const pickupRoadEta = usePickupRoadEta({
		enabled: showPickupRoadEta,
		driver: pickupEtaDriver,
		pickup: pickupEtaPickup,
	});

	const showLoadedEnrouteStaleTopBanner = Boolean(
		isAuthenticated &&
		showMapAndTrackingTools &&
		currentTrackingDriver &&
		driverUsesMobileApp &&
		isDriverLoadedEnroute &&
		normalizedLoadStatus === "loaded_enroute" &&
		hasLastLocationUpdate &&
		isLastLocationOlderThanNy(
			currentTrackingDriver.lastLocationUpdateAt,
			STALE_LOCATION_THRESHOLD
		)
	);
	const showDeliveredLoadBanner = Boolean(showMapAndTrackingTools && isLoadDelivered);

	return (
		<section className="absolute inset-0 w-full h-full" data-load-id={loadId}>
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
					className="absolute left-14 top-4 z-[1000] inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-medium leading-none text-white transition-colors hover:bg-brand-600 dark:border-brand-400 dark:bg-brand-400 dark:hover:bg-brand-500"
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
						<div className="absolute inset-0 z-[500] flex items-start justify-center bg-white px-6 pt-[min(18vh,8rem)] dark:bg-gray-950">
							<div className="max-w-md text-center">
								<p className="text-lg font-semibold text-gray-900 dark:text-white">
									Driver is not using the mobile app
								</p>
								<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
									Map, load history, and live tracking are unavailable until the
									driver opens the mobile application at least once.
								</p>
							</div>
						</div>
					)}
					{mapUiMode === "driver_not_loaded_enroute" && (
						<DriverNotLoadedEnroutePanel
							driverStatusLabel={driverStatusLabel}
							driverExternalId={currentTrackingDriver?.externalId}
						/>
					)}
					{mapUiMode === "stale_location" && (
						<div className="absolute inset-0 z-[500] bg-white dark:bg-gray-950">
							<div className="absolute inset-x-0 top-20 z-[600] flex justify-center px-6 pointer-events-none">
								<div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 text-center shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40">
									<p className="text-base font-semibold text-amber-950 dark:text-amber-100">
										No driver updates in the last {formatStaleThresholdLabel()}
									</p>
									<p className="mt-1.5 text-sm text-amber-900/80 dark:text-amber-200/90">
										The driver&apos;s last location update is older than{" "}
										{formatStaleThresholdLabel()} (Eastern Time). Map and load
										history are hidden until a new update is received.
									</p>
								</div>
							</div>
						</div>
					)}
					{showMapAndTrackingTools && (
						<>
							{showPickupRoadEta ? (
								<PickupRoadEtaBanner
									status={pickupRoadEta.status}
									eta={pickupRoadEta.eta}
									pickupAddressLabel={pickupGeocode?.addressLabel}
									reserveRightForHistory={reserveTopBannerRightLane}
								/>
							) : showLoadedEnrouteStaleTopBanner ? (
								<LoadedEnrouteStaleLocationBanner
									thresholdLabel={formatStaleThresholdLabel()}
									reserveRightForHistory={reserveTopBannerRightLane}
								/>
							) : showDeliveredLoadBanner ? (
								<DeliveredLoadBanner
									reserveRightForHistory={reserveTopBannerRightLane}
								/>
							) : null}
							<TrackingDeliveryMap
								driverData={mapLoadData}
								showEmptyMap
								forceLightMapBasemap
								enableBasemapModeSwitch
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
							/>
						</>
					)}
					{showLoadHistoryPanel && (
						<div className="absolute right-4 top-4 z-[1000] w-[25vw] max-w-[25vw] max-h-[50vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
							<button
								type="button"
								className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 text-left dark:border-gray-800"
								onClick={() => setIsHistoryOpen(value => !value)}
							>
								<span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
									Load history
									<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
										{loadHistoryPanelCount}
									</span>
								</span>
								<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
									{isHistoryOpen ? "Hide" : "Show"}
								</span>
							</button>
							{isHistoryOpen && trackingDeviceHistoryGroups.length > 0 ? (
								<div className="border-b border-gray-200 px-4 py-2 dark:border-gray-800">
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
													className={`inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
														isActive
															? "border-brand-500 bg-brand-500 text-white shadow-sm"
															: "border-gray-200 bg-gray-50 text-gray-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-brand-500 dark:hover:bg-gray-800"
													}`}
													title={group.label}
													onClick={() => {
														if (group.key === activeTrackingDeviceKey)
															return;
														setActiveTrackingDeviceKey(group.key);
														clearHistoryPointSelection();
														historyCardRefs.current = [];
													}}
												>
													<span className="truncate">{group.label}</span>
													<span
														className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
															isActive
																? "bg-white/20 text-white"
																: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
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
									className={`overflow-y-auto px-4 py-3 ${
										trackingDeviceHistoryGroups.length > 0
											? "max-h-[calc(50vh-93px)]"
											: "max-h-[calc(50vh-45px)]"
									}`}
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

												let cardTone: string;
												if (isEditingCard) {
													cardTone =
														"border-blue-700 bg-blue-100 text-blue-950 shadow-md ring-2 ring-blue-500/50 ring-offset-1 ring-offset-white dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-400/35 dark:ring-offset-gray-900";
												} else if (isSelectedCard) {
													cardTone =
														"border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-100";
												} else {
													cardTone =
														"border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300";
												}

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
															className={`w-full rounded-md border p-3 text-left text-xs transition-colors ${cardTone}`}
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
															<div className="mb-2 flex items-center justify-between gap-2">
																<p
																	className={`font-semibold ${
																		isEditingCard
																			? "text-blue-900 dark:text-blue-50"
																			: "text-gray-900 dark:text-white"
																	}`}
																>
																	Step {index + 1}
																</p>
																{canEditLoadHistory ? (
																	<div className="flex items-center gap-2">
																		{isEditingCard &&
																		historyEditShowApplyCancel ? (
																			<>
																				<button
																					type="button"
																					className="rounded border border-blue-600 bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
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
																					className="rounded border border-gray-400 bg-white px-2 py-1 text-[11px] font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
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
																					className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-blue-100 bg-white p-0 text-blue-600 shadow-sm transition hover:scale-110 hover:border-blue-600 hover:bg-blue-600 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-blue-900 dark:bg-gray-900 dark:text-blue-400 dark:hover:border-blue-500 dark:hover:bg-blue-500 dark:hover:text-white"
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
																						className="h-full w-full"
																						xmlns="http://www.w3.org/2000/svg"
																						viewBox="0 0 122.88 122.88"
																						aria-hidden="true"
																					>
																						<path
																							fill="currentColor"
																							fillRule="evenodd"
																							clipRule="evenodd"
																							d="M14.1,0h94.67c7.76,0,14.1,6.35,14.1,14.1v94.67c0,7.75-6.35,14.1-14.1,14.1H14.1c-7.75,0-14.1-6.34-14.1-14.1 V14.1C0,6.34,6.34,0,14.1,0L14.1,0z M81.35,28.38L94.1,41.14c1.68,1.68,1.68,4.44,0,6.11l-7.06,7.06L68.17,35.44l7.06-7.06 C76.91,26.7,79.66,26.7,81.35,28.38L81.35,28.38z M52.34,88.98c-5.1,1.58-10.21,3.15-15.32,4.74c-12.01,3.71-11.95,6.18-8.68-5.37 l5.16-18.2l0,0l-0.02-0.02L64.6,39.01l18.87,18.87l-31.1,31.11L52.34,88.98L52.34,88.98z M36.73,73.36l12.39,12.39 c-3.35,1.03-6.71,2.06-10.07,3.11c-7.88,2.42-7.84,4.05-5.7-3.54L36.73,73.36L36.73,73.36z"
																						/>
																					</svg>
																				</button>
																				<button
																					type="button"
																					className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-red-200 bg-white p-0 text-red-600 shadow-sm transition hover:scale-110 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 dark:border-red-900 dark:bg-gray-900 dark:text-red-400 dark:hover:border-red-500 dark:hover:bg-red-500 dark:hover:text-white"
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
																						className="h-full w-full"
																						xmlns="http://www.w3.org/2000/svg"
																						viewBox="0 0 122.88 122.88"
																						aria-hidden="true"
																					>
																						<path
																							fill="currentColor"
																							d="M7.513,0h107.854c2.066,0,3.944,0.845,5.306,2.207s2.207,3.24,2.207,5.306v107.854c0,2.066-0.846,3.944-2.207,5.306 c-1.361,1.362-3.239,2.207-5.306,2.207H7.513c-2.066,0-3.945-0.845-5.306-2.207C0.845,119.312,0,117.434,0,115.367V7.513 c0-2.066,0.845-3.945,2.207-5.306S5.447,0,7.513,0L7.513,0z M35.018,38.629c0,0.924,0.353,1.848,1.057,2.553l20.164,20.164 l0.094,0.095l-0.094,0.094L36.075,81.698c-0.705,0.705-1.057,1.629-1.057,2.553s0.353,1.849,1.057,2.554 c0.705,0.704,1.629,1.058,2.553,1.058c0.924,0,1.848-0.354,2.553-1.058l20.163-20.164l0.095-0.095l0.095,0.095l20.163,20.164 c0.705,0.704,1.63,1.058,2.554,1.058s1.849-0.354,2.553-1.058c0.705-0.705,1.058-1.63,1.058-2.554s-0.353-1.848-1.058-2.553 L66.641,61.534l-0.095-0.094l0.095-0.095l20.163-20.164c0.705-0.705,1.058-1.629,1.058-2.553s-0.353-1.848-1.058-2.553 c-0.704-0.705-1.629-1.057-2.553-1.057s-1.849,0.353-2.554,1.057L61.534,56.239l-0.095,0.095l-0.095-0.095L41.182,36.076 c-0.705-0.705-1.629-1.057-2.553-1.057c-0.924,0-1.848,0.353-2.553,1.057C35.371,36.781,35.018,37.705,35.018,38.629L35.018,38.629 z"
																						/>
																					</svg>
																				</button>
																			</>
																		)}
																	</div>
																) : null}
															</div>
															<p>
																<span className="font-medium">
																	Coordinates:
																</span>{" "}
																{displayCoords[0].toFixed(6)},{" "}
																{displayCoords[1].toFixed(6)}
															</p>
															{point.placeLabel ? (
																<p>
																	<span className="font-medium">
																		Place:
																	</span>{" "}
																	{point.placeLabel}
																</p>
															) : null}
															{point.deviceLabel ? (
																<p>
																	<span className="font-medium">
																		Device:
																	</span>{" "}
																	{point.deviceLabel}
																	{point.deviceId ? (
																		<span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
																			(
																			{point.deviceId.slice(
																				0,
																				8
																			)}
																			…)
																		</span>
																	) : null}
																</p>
															) : null}
															<p>
																<span className="font-medium">
																	Tracked:
																</span>{" "}
																{formatHistoryDate(point.createdAt)}
															</p>
															<p>
																<span className="font-medium">
																	Updated:
																</span>{" "}
																{formatHistoryDate(point.updatedAt)}
															</p>
														</div>
													</li>
												);
											})}
											{showCurrentLocationHistoryCard ? (
												<li key="current-location">
													<div className="w-full rounded-md border border-gray-100 bg-gray-50 p-3 text-left text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
														<div className="mb-2">
															<p className="font-semibold text-gray-900 dark:text-white">
																Last location update
															</p>
														</div>
														<p>
															<span className="font-medium">
																Coordinates:
															</span>{" "}
															{currentDriverLatitude.toFixed(6)},{" "}
															{currentDriverLongitude.toFixed(6)}
														</p>
														{currentLocationPlaceLabel !== "N/A" ? (
															<p>
																<span className="font-medium">
																	Place:
																</span>{" "}
																{currentLocationPlaceLabel}
															</p>
														) : null}
														<p>
															<span className="font-medium">
																Tracked:
															</span>{" "}
															{formatHistoryDate(
																currentTrackingDriver?.lastLocationUpdateAt ??
																	null
															)}
														</p>
													</div>
												</li>
											) : null}
										</ol>
									) : (
										<p className="text-sm text-gray-500 dark:text-gray-400">
											No history points yet.
										</p>
									)}
								</div>
							)}
						</div>
					)}
					{isAuthenticated && currentTrackingDriver && !isLoadDelivered && (
						<div className="absolute bottom-[50px] left-1/2 z-[1000] w-[min(calc(100vw-3rem),56rem)] -translate-x-1/2">
							<DriverInfo
								driverData={driverCardData}
								loadId={loadId}
								loadStatusLabel={loadStatusLabel}
								showLoadTrackingActions={mapUiMode !== "no_app"}
							/>
						</div>
					)}
				</>
			)}
		</section>
	);
}
