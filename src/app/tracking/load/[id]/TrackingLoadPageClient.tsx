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
};

type LoadTrackingPoint = {
	id?: string | null;
	externalDriverId?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	placeLabel?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type LocationUpdatePayload = {
	externalId?: string | null;
	trackingLoadId?: string | null;
};

type DriverTrackingPointCreatedPayload = {
	loadId?: string | null;
};

function formatHistoryDate(dateString: string | null) {
	if (!dateString) return "N/A";

	try {
		return new Date(dateString).toLocaleString();
	} catch {
		return dateString;
	}
}

/** Align with TMS / Nest: loaded-enroute → loaded_enroute */
function normalizeTrackingStatus(value: string | null | undefined): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/-/g, "_");
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

export default function TrackingLoadPageClient({ loadId }: TrackingLoadPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const canEditLoadHistory = canEditLoadTrackingHistory(currentUser?.role);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isAuthLoading, setIsAuthLoading] = useState(true);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

	const {
		data: loadDetails,
		isPending: isLoadDetailsPending,
		isError: isLoadDetailsError,
		error: loadDetailsError,
	} = useQuery({
		queryKey: ["tracking-load-details", loadId, isPublicView ? "public" : "auth"],
		queryFn: () => fetchTrackingLoadDetails(loadId, { publicView: isPublicView }),
		enabled: Boolean(loadId) && !isAuthLoading,
		staleTime: 10 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

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

	useEffect(() => {
		if (!loadId) return;

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
	}, [loadId, refreshLoadDetails]);

	const routeGeocodeFromApi = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.routeGeocode ?? details?.data?.routeGeocode ?? null;
	}, [loadDetails]);

	const loadMetaData = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.meta_data ?? details?.data?.meta_data ?? null;
	}, [loadDetails]);
	const normalizedLoadStatus = normalizeTrackingStatus(loadMetaData?.load_status ?? null);
	const loadStatusLabel = formatLoadStatusLabel(loadMetaData?.load_status ?? null);
	const isDeliveredLoad = normalizedLoadStatus === "delivered";
	const isLoadLoadedEnroute = normalizedLoadStatus === "loaded_enroute";

	const loadDrivers = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.drivers ?? details?.data?.drivers ?? [];
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

	const loadHistory = useMemo(() => {
		return sortedTrackingPoints
			.map(point => {
				const latitude = Number(point.latitude);
				const longitude = Number(point.longitude);
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					return null;
				}
				return [latitude, longitude] as [number, number];
			})
			.filter((point): point is [number, number] => point !== null);
	}, [sortedTrackingPoints]);

	const loadHistoryForMap = useMemo(() => {
		if (
			editingHistoryPointIndex === null ||
			historyDragDraft === null ||
			editingHistoryPointIndex >= loadHistory.length
		) {
			return loadHistory;
		}
		const next = [...loadHistory];
		next[editingHistoryPointIndex] = historyDragDraft;
		return next;
	}, [editingHistoryPointIndex, historyDragDraft, loadHistory]);

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
				};
			})
			.filter(
				(
					point
				): point is {
					id: string | null;
					position: [number, number];
					createdAt: string | null;
					updatedAt: string | null;
					externalDriverId: string | null;
					driverName: string | null;
					placeLabel: string | null;
				} => point !== null
			);
	}, [loadDrivers, sortedTrackingPoints]);

	const loadHistoryDetailsRef = useRef(loadHistoryDetails);
	loadHistoryDetailsRef.current = loadHistoryDetails;

	useEffect(() => {
		if (
			selectedHistoryPointIndex !== null &&
			selectedHistoryPointIndex >= loadHistoryDetails.length
		) {
			setSelectedHistoryPointIndex(null);
		}
		if (
			editingHistoryPointIndex !== null &&
			editingHistoryPointIndex >= loadHistoryDetails.length
		) {
			setEditingHistoryPointIndex(null);
		}
	}, [editingHistoryPointIndex, loadHistoryDetails.length, selectedHistoryPointIndex]);

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
		const pointId = loadHistoryDetails[idx]?.id;
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
		editingHistoryPointIndex,
		historyDragDraft,
		loadHistoryDetails,
		loadId,
		refreshLoadDetails,
		savingHistoryPointId,
	]);

	const currentTrackingDriver = useMemo(() => {
		// Active driver = last history point that names a driver (by externalId).
		// Scan backwards so a trailing point without externalDriverId does not hide the real active driver.
		if (sortedTrackingPoints.length > 0) {
			for (let i = sortedTrackingPoints.length - 1; i >= 0; i--) {
				const externalId = sortedTrackingPoints[i]?.externalDriverId?.trim();
				if (!externalId) continue;
				const fromHistory = loadDrivers.find(
					driver => driver.externalId?.trim() === externalId
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
	const showDriverLiveMarker =
		!isDeliveredLoad &&
		isLoadLoadedEnroute &&
		isDriverLoadedEnroute &&
		hasCurrentDriverCoordinates;

	const mapLoadData = useMemo(
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
			latitude: showDriverLiveMarker ? currentDriverLatitude : null,
			longitude: showDriverLiveMarker ? currentDriverLongitude : null,
			lastLocationUpdateAt: currentTrackingDriver?.lastLocationUpdateAt ?? null,
			pick_up_location: loadMetaData?.pick_up_location ?? null,
			delivery_location: loadMetaData?.delivery_location ?? null,
			routeGeocode:
				routeGeocodeFromApi?.pickup && routeGeocodeFromApi?.delivery
					? routeGeocodeFromApi
					: null,
			load_history: loadHistoryForMap,
			load_history_details: loadHistoryDetails,
		}),
		[
			currentDriverLatitude,
			currentDriverLongitude,
			currentTrackingDriver,
			showDriverLiveMarker,
			loadMetaData,
			routeGeocodeFromApi,
			loadHistoryForMap,
			loadHistoryDetails,
		]
	);

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

			{!isAuthLoading && isAuthenticated && (
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
					isAuthenticated && canEditLoadHistory ? editingHistoryPointIndex : null
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
			{isAuthenticated && (
			<div className="absolute right-4 top-4 z-[1000] w-[25vw] max-w-[25vw] max-h-[50vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
				<button
					type="button"
					className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 text-left dark:border-gray-800"
					onClick={() => setIsHistoryOpen(value => !value)}
				>
					<span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
						Load history
						<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
							{loadHistoryDetails.length}
						</span>
					</span>
					<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
						{isHistoryOpen ? "Hide" : "Show"}
					</span>
				</button>
				{isHistoryOpen && (
					<div className="max-h-[calc(50vh-45px)] overflow-y-auto px-4 py-3">
						{loadHistoryDetails.length > 0 ? (
							<ol className="space-y-3">
								{loadHistoryDetails.map((point, index) => {
									const isEditingCard = editingHistoryPointIndex === index;
									const isSelectedCard = selectedHistoryPointIndex === index;
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
														applyHistoryPointSelection(index);
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
																		) || !point.id
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
														<span className="font-medium">Place:</span>{" "}
														{point.placeLabel}
													</p>
												) : null}
												<p>
													<span className="font-medium">Tracked:</span>{" "}
													{formatHistoryDate(point.createdAt)}
												</p>
												<p>
													<span className="font-medium">Updated:</span>{" "}
													{formatHistoryDate(point.updatedAt)}
												</p>
											</div>
										</li>
									);
								})}
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
			{isAuthenticated && currentTrackingDriver && (
				<div className="absolute bottom-[50px] left-1/2 z-[1000] w-[min(calc(100vw-3rem),56rem)] -translate-x-1/2">
					<DriverInfo
						driverData={mapLoadData}
						loadId={loadId}
						loadStatusLabel={loadStatusLabel}
					/>
				</div>
			)}
				</>
			)}
		</section>
	);
}
