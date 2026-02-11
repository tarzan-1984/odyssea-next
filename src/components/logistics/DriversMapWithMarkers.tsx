"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/context/ThemeContext";
import { useDriversForMap, type DriverForMap } from "@/hooks/useDriversForMap";
import users from "@/app-api/users";
import chatRoomsApi from "@/app-api/chatRooms";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import type { ChatRoom } from "@/app-api/chatApi";
import type { TMSDriverResponse } from "@/app-api/api-types";
import DriverInfoModal from "./DriverInfoModal";
import { DRIVER_STATUS_LABELS } from "./driversMapConstants";

const MapContainer = dynamic(
	() => import("react-leaflet").then((mod) => mod.MapContainer),
	{ ssr: false }
);

const TileLayer = dynamic(
	() => import("react-leaflet").then((mod) => mod.TileLayer),
	{ ssr: false }
);

const Marker = dynamic(
	() => import("react-leaflet").then((mod) => mod.Marker),
	{ ssr: false }
);

const MapRefSetter = dynamic(
	() =>
		import("react-leaflet").then((mod) => {
			const { useMap } = mod;
			return function MapRefSetterComponent({
				mapRef,
			}: {
				mapRef: React.MutableRefObject<L.Map | null>;
			}) {
				const map = useMap();
				useEffect(() => {
					if (map) {
						mapRef.current = map;
						map.whenReady(() => {
							if (mapRef.current !== map) mapRef.current = map;
						});
					}
				}, [map, mapRef]);
				return null;
			};
		}),
	{ ssr: false }
);

// Fix for default marker icon in Next.js
if (typeof window !== "undefined") {
	delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
	L.Icon.Default.mergeOptions({
		iconRetinaUrl:
			"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
		iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
		shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
	});
}

// Same status colors as mobile app (OSMMapView)
const STATUS_COLORS: Record<string, string> = {
	available: "#00d200",
	available_on: "#cefece",
	loaded_enroute: "#cefece",
	available_off: "#e06665",
	banned: "#ffb261",
	no_interview: "#d60000",
	expired_documents: "#d60000",
	blocked: "#d60000",
	on_vocation: "#ffb4d3",
	on_hold: "#b2b2b2",
	need_update: "#f1cfcf",
	no_updates: "#ff3939",
	unknown: "#808080",
};

function getStatusColor(status: string | null | undefined): string {
	if (!status) return "#808080";
	return STATUS_COLORS[status.toLowerCase()] ?? "#808080";
}

// Same marker SVG path as mobile app
const MARKER_SVG_PATH =
	"M49.1,122.34a2.75,2.75,0,0,1-3.12.1A109.7,109.7,0,0,1,19,98.35C9.15,86,3,72.33.83,59.16-1.33,45.79.69,32.94,7.34,22.49A45.14,45.14,0,0,1,17.39,11.35C26.77,3.87,37.49-.08,48.16,0c10.29.08,20.43,3.92,29.2,11.91a43,43,0,0,1,7.79,9.49c7.15,11.77,8.69,26.8,5.55,42a92.52,92.52,0,0,1-41.6,58.92Zm-3-98.58a23,23,0,1,1-22.94,23A23,23,0,0,1,46.13,23.76Z";

function createDriverMarkerIcon(driver: DriverForMap): L.DivIcon {
	const statusColor = getStatusColor(driver.driverStatus);
	const svgHtml = `<svg width="34" height="46" viewBox="0 0 92.25 122.88" xmlns="http://www.w3.org/2000/svg"><path d="${MARKER_SVG_PATH}" fill="${statusColor}" stroke="#1E3A5F" stroke-width="2" fill-rule="evenodd"/><circle cx="46.13" cy="46.76" r="12" fill="#F5D5D5" stroke="#1E3A5F" stroke-width="1.5"/></svg>`;
	return L.divIcon({
		className: "custom-driver-marker",
		html: `<div style="width:34px;height:46px;position:relative;">${svgHtml}</div>`,
		iconSize: [34, 46],
		iconAnchor: [17, 46],
	});
}

const DEFAULT_CENTER: [number, number] = [39.2904, -76.6122];
const DEFAULT_ZOOM = 6;

/** Distance between two points in miles (Haversine formula) */
function getDistanceMiles(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 3959; // Earth radius in miles
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function findDirectChatWithUser(
	rooms: ChatRoom[],
	myUserId: string,
	otherUserId: string
): ChatRoom | undefined {
	return rooms.find((r) => {
		if (r.type !== "DIRECT") return false;
		const hasOther = r.participants?.some((p) => p.user?.id === otherUserId);
		const hasMe = r.participants?.some((p) => p.user?.id === myUserId);
		return Boolean(hasOther && hasMe);
	});
}

interface DriversMapWithMarkersProps {
	driverStatusFilter?: string;
	onDriverStatusFilterChange?: (value: string) => void;
	zipFilter?: string;
	onZipFilterChange?: (value: string) => void;
	/** When true, filter is rendered elsewhere (e.g. page header); hide internal filter bar */
	hideFilterBar?: boolean;
	/** When provided, use these drivers instead of fetching (avoids duplicate requests when filter is in header) */
	drivers?: DriverForMap[];
	isLoading?: boolean;
	isFetching?: boolean;
	error?: Error | null;
	refetch?: () => void;
	centerCoordinates?: { lat: number; lng: number } | null;
	/** When set with centerCoordinates, only drivers within this radius (miles) are shown */
	radiusMiles?: number | null;
}

export default function DriversMapWithMarkers({
	driverStatusFilter: driverStatusFilterProp,
	onDriverStatusFilterChange,
	zipFilter: zipFilterProp,
	onZipFilterChange,
	hideFilterBar = false,
	drivers: driversProp,
	isLoading: isLoadingProp,
	isFetching: isFetchingProp,
	error: errorProp,
	refetch: refetchProp,
	centerCoordinates,
	radiusMiles: radiusMilesProp,
}: DriversMapWithMarkersProps = {}) {
	const router = useRouter();
	const { theme } = useTheme();
	const [isDark, setIsDark] = useState(false);
	const mapRef = useRef<L.Map | null>(null);
	const hasFitBoundsRef = useRef(false);

	const [internalFilter, setInternalFilter] = useState<string>("all");
	const [internalZipFilter, setInternalZipFilter] = useState<string>("");
	const driverStatusFilter = driverStatusFilterProp ?? internalFilter;
	const setDriverStatusFilter = onDriverStatusFilterChange ?? setInternalFilter;
	const zipFilter = zipFilterProp ?? internalZipFilter;
	const setZipFilter = onZipFilterChange ?? setInternalZipFilter;

	const [selectedDriverUserId, setSelectedDriverUserId] = useState<string | null>(null);
	const [selectedDriverStatus, setSelectedDriverStatus] = useState<string | null>(null); // users.status from our DB (ACTIVE/INACTIVE)
	const [selectedDriverTMS, setSelectedDriverTMS] = useState<Record<string, unknown> | null>(null);
	const [isPopupVisible, setIsPopupVisible] = useState(false);
	const [isLoadingDriverData, setIsLoadingDriverData] = useState(false);
	const [isChatActionLoading, setIsChatActionLoading] = useState(false);

	const queryResult = useDriversForMap();
	const drivers = driversProp ?? queryResult.drivers;
	const isLoading = isLoadingProp ?? queryResult.isLoading;
	const isFetching = isFetchingProp ?? queryResult.isFetching;
	const error = errorProp ?? queryResult.error;
	const refetch = refetchProp ?? queryResult.refetch;
	const currentUser = useCurrentUser();
	const addChatRoom = useChatStore((s) => s.addChatRoom);
	const chatRooms = useChatStore((s) => s.chatRooms);
	const { loadChatRooms } = useWebSocketChatSync();

	const handleMarkerClick = useCallback(
		async (driver: DriverForMap) => {
			if (!driver.externalId) return;
			setSelectedDriverUserId(driver.id);
			setSelectedDriverStatus(driver.status ?? null); // From our backend drivers/map response (users.status)
			setIsLoadingDriverData(true);
			setIsPopupVisible(true);
			setSelectedDriverTMS(null);
			try {
				const res = (await users.getDriverById(
					driver.externalId
				)) as TMSDriverResponse | Record<string, unknown>;
				const payload =
					(res as TMSDriverResponse)?.data ??
					(res as Record<string, unknown>);
				setSelectedDriverTMS(payload as Record<string, unknown>);
			} catch {
				setSelectedDriverTMS(null);
			} finally {
				setIsLoadingDriverData(false);
			}
		},
		[]
	);

	const handleGoToChat = useCallback(async () => {
		const myUserId = currentUser?.id;
		const driverUserId = selectedDriverUserId;
		if (!myUserId || !driverUserId) return;
		if (isChatActionLoading) return;
		setIsChatActionLoading(true);
		try {
			let rooms = useChatStore.getState().chatRooms;
			if (rooms.length === 0) {
				await loadChatRooms();
				rooms = useChatStore.getState().chatRooms;
			}
			const found = findDirectChatWithUser(rooms, myUserId, driverUserId);
			if (found) {
				setIsPopupVisible(false);
				router.push(`/chat?room=${found.id}`);
				return;
			}
			const contact = (selectedDriverTMS?.organized_data as Record<string, unknown>)
				?.contact as Record<string, unknown> | undefined;
			const driverName = contact?.driver_name ? String(contact.driver_name) : "Driver";
			const result = await chatRoomsApi.createChatRoom({
				name: driverName,
				type: "DIRECT",
				loadId: "",
				participantIds: [myUserId, driverUserId],
			});
			if (result.success && result.data) {
				const chatData = result.data;
				const chatRoom: ChatRoom = {
					...chatData,
					isArchived: false,
					updatedAt: chatData.createdAt,
					participants: (
					(chatData.participants || []) as Array<{
						id?: string;
						user?: {
							id?: string;
							firstName?: string;
							lastName?: string;
							profilePhoto?: string;
							avatar?: string;
							role?: string;
						};
					}>
				).map((p) => ({
					id: `participant_${p.id ?? ""}_${chatData.id}`,
					chatRoomId: chatData.id,
					userId: p.user?.id ?? p.id ?? "",
					joinedAt: chatData.createdAt,
					user: {
						id: p.user?.id ?? p.id ?? "",
						firstName: p.user?.firstName ?? "",
						lastName: p.user?.lastName ?? "",
						avatar: p.user?.profilePhoto ?? p.user?.avatar ?? "",
						role: p.user?.role ?? "USER",
					},
				})),
				};
				addChatRoom(chatRoom);
				await indexedDBChatService.addChatRoom(chatRoom);
				setIsPopupVisible(false);
				router.push(`/chat?room=${chatRoom.id}`);
			}
		} catch {
			// Error - user can retry
		} finally {
			setIsChatActionLoading(false);
		}
	}, [
		currentUser?.id,
		selectedDriverUserId,
		selectedDriverTMS,
		isChatActionLoading,
		loadChatRooms,
		addChatRoom,
		router,
	]);

	const handleClosePopup = useCallback(() => {
		if (!isChatActionLoading) {
			setSelectedDriverUserId(null);
			setSelectedDriverStatus(null);
		}
		setIsPopupVisible(false);
		setSelectedDriverTMS(null);
	}, [isChatActionLoading]);

	useEffect(() => {
		setIsDark(theme === "dark");
		const checkDark = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};
		checkDark();
		const observer = new MutationObserver(checkDark);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, [theme]);

	// Fit map to bounds when drivers load (once)
	useEffect(() => {
		if (!mapRef.current || drivers.length === 0 || hasFitBoundsRef.current) return;

		const valid = drivers.filter(
			(d) =>
				typeof d.latitude === "number" &&
				typeof d.longitude === "number" &&
				!Number.isNaN(d.latitude) &&
				!Number.isNaN(d.longitude)
		);
		if (valid.length === 0) return;

		const bounds = L.latLngBounds(
			valid.map((d) => [d.latitude, d.longitude] as [number, number])
		);
		mapRef.current.whenReady(() => {
			if (mapRef.current && !hasFitBoundsRef.current) {
				mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
				hasFitBoundsRef.current = true;
			}
		});
	}, [drivers]);

	// Center map on coordinates provided from filters
	useEffect(() => {
		if (!mapRef.current || !centerCoordinates) return;

		const { lat, lng } = centerCoordinates;
		if (
			typeof lat !== "number" ||
			typeof lng !== "number" ||
			Number.isNaN(lat) ||
			Number.isNaN(lng)
		) {
			return;
		}

		hasFitBoundsRef.current = true;
		// Keep current zoom (scale) when centering; only pan to the new coordinates
		const zoom = mapRef.current.getZoom();
		mapRef.current.setView([lat, lng], zoom);
	}, [centerCoordinates]);

	const tileLayerAttribution =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

	// Unique driverStatus values from data for filter options
	const driverStatusOptions = Array.from(
		new Set(
			drivers
				.map((d) => d.driverStatus)
				.filter((s): s is string => Boolean(s))
				.sort()
		)
	);

	const filteredByStatus =
		driverStatusFilter === "all" || !driverStatusFilter
			? drivers
			: drivers.filter(
					(d) =>
						d.driverStatus?.toLowerCase() === driverStatusFilter.toLowerCase()
				);

	const filteredByZip =
		!zipFilter || !zipFilter.trim()
			? filteredByStatus
			: filteredByStatus.filter((d) => {
					const driverZip = (d.zip ?? "").toString().toLowerCase().trim();
					const searchZip = zipFilter.toLowerCase().trim();
					return driverZip.includes(searchZip);
				});

	// Filter by radius (miles) from center when address filter was applied
	const filteredDrivers =
		centerCoordinates &&
		typeof radiusMilesProp === "number" &&
		radiusMilesProp > 0
			? filteredByZip.filter((d) => {
					if (
						typeof d.latitude !== "number" ||
						typeof d.longitude !== "number" ||
						Number.isNaN(d.latitude) ||
						Number.isNaN(d.longitude)
					) {
						return false;
					}
					const distance = getDistanceMiles(
						centerCoordinates.lat,
						centerCoordinates.lng,
						d.latitude,
						d.longitude
					);
					return distance <= radiusMilesProp;
				})
			: filteredByZip;

	if (error) {
		return (
			<div className="flex h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
				<div className="text-center p-4">
					<p className="text-gray-600 dark:text-gray-400 text-sm">
						Failed to load drivers.{" "}
						<button
							type="button"
							onClick={() => refetch()}
							className="text-brand-600 hover:underline"
						>
							Retry
						</button>
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
			{/* Filter bar (hidden when filter is rendered in page header) */}
			{!hideFilterBar && (
				<div className="flex shrink-0 items-center gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<label
						htmlFor="driver-status-filter"
						className="text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Status:
					</label>
					<select
						id="driver-status-filter"
						value={driverStatusFilter}
						onChange={(e) => setDriverStatusFilter(e.target.value)}
						className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					>
						<option value="all">{DRIVER_STATUS_LABELS.all}</option>
						{driverStatusOptions.map((status) => (
							<option key={status} value={status}>
								{DRIVER_STATUS_LABELS[status.toLowerCase()] ?? status}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Map area */}
			<div className="relative flex-1 min-h-0">
				{(isLoading || isFetching) && (
					<div className="absolute left-4 top-4 z-[1000] rounded-md bg-white/90 px-3 py-2 text-sm shadow dark:bg-gray-800/90">
						{isLoading ? "Loading drivers..." : "Loading more drivers..."}
					</div>
				)}
				<MapContainer
					center={DEFAULT_CENTER}
					zoom={DEFAULT_ZOOM}
					style={{ height: "100%", width: "100%" }}
					scrollWheelZoom
					key={`drivers-map-${isDark ? "dark" : "light"}`}
				>
					<MapRefSetter mapRef={mapRef} />
					<TileLayer
						attribution={tileLayerAttribution}
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					{filteredDrivers.map((driver, index) => {
						if (
							typeof driver.latitude !== "number" ||
							typeof driver.longitude !== "number" ||
							Number.isNaN(driver.latitude) ||
							Number.isNaN(driver.longitude)
						) {
							return null;
						}
						const position: [number, number] = [driver.latitude, driver.longitude];
						const icon = createDriverMarkerIcon(driver);
						// Используем составной ключ, чтобы избежать дубликатов
						const key = `${driver.externalId ?? driver.id}-${index}`;
						return (
							<Marker
								key={key}
								position={position}
								icon={icon}
								eventHandlers={{
									click: () => handleMarkerClick(driver),
								}}
							/>
						);
					})}
				</MapContainer>
			</div>

			<DriverInfoModal
				visible={isPopupVisible}
				onClose={handleClosePopup}
				driverData={selectedDriverTMS}
				isLoading={isLoadingDriverData}
				showChatButton={Boolean(selectedDriverUserId)}
				onChatPress={handleGoToChat}
				isChatActionLoading={isChatActionLoading}
				isDriverActive={selectedDriverStatus === "ACTIVE"}
			/>
		</div>
	);
}
