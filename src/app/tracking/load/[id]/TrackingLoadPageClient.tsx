"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import DriverInfo from "../../[id]/DriverInfo";

const TrackingDeliveryMap = dynamic(
	() => import("@/components/logistics/TrackingDeliveryMap"),
	{ ssr: false }
);

interface TrackingLoadPageClientProps {
	loadId: string;
}

type LoadDetailsResponse = {
	data?: {
		data?: {
			meta_data?: {
				pick_up_location?: string | null;
				delivery_location?: string | null;
			};
			drivers?: LoadDriver[];
			trackingPoints?: LoadTrackingPoint[];
		};
		meta_data?: {
			pick_up_location?: string | null;
			delivery_location?: string | null;
		};
		drivers?: LoadDriver[];
		trackingPoints?: LoadTrackingPoint[];
	};
};

type LoadDriver = {
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
	externalDriverId?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
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

export default function TrackingLoadPageClient({ loadId }: TrackingLoadPageClientProps) {
	const queryClient = useQueryClient();
	const { data: loadDetails } = useQuery({
		queryKey: ["tracking-load-details", loadId],
		queryFn: async () => {
			const response = await fetch(`/api/tms/load/${encodeURIComponent(loadId)}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch load details: ${response.status}`);
			}
			return response.json();
		},
		enabled: Boolean(loadId),
		staleTime: 10 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	useEffect(() => {
		if (loadDetails) {
			console.log("[TrackingLoadPage] Load details:", loadDetails);
		}
	}, [loadDetails]);

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

		const refreshLoadDetails = () => {
			void queryClient.invalidateQueries({
				queryKey: ["tracking-load-details", loadId],
			});
		};

		socket.on("connect_error", error => {
			console.error("❌ [TrackingLoadPage] WebSocket connection error:", error);
		});

		socket.on("userLocationUpdate", (payload: LocationUpdatePayload) => {
			if (payload.trackingLoadId?.trim() === loadId) {
				refreshLoadDetails();
			}
		});

		socket.on(
			"driverTrackingPointCreated",
			(payload: DriverTrackingPointCreatedPayload) => {
				if (payload.loadId?.trim() === loadId) {
					refreshLoadDetails();
				}
			}
		);

		return () => {
			socket.disconnect();
		};
	}, [loadId, queryClient]);

	const loadMetaData = useMemo(() => {
		const details = loadDetails as LoadDetailsResponse | undefined;
		return details?.data?.data?.meta_data ?? details?.data?.meta_data ?? null;
	}, [loadDetails]);

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
			.map((point) => {
				const latitude = Number(point.latitude);
				const longitude = Number(point.longitude);
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					return null;
				}
				return [latitude, longitude] as [number, number];
			})
			.filter((point): point is [number, number] => point !== null);
	}, [sortedTrackingPoints]);

	const loadHistoryDetails = useMemo(() => {
		return sortedTrackingPoints
			.map((point) => {
				const latitude = Number(point.latitude);
				const longitude = Number(point.longitude);
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					return null;
				}
				const externalDriverId = point.externalDriverId?.trim() || null;
				const driver = externalDriverId
					? loadDrivers.find((item) => item.externalId?.trim() === externalDriverId)
					: null;
				const driverName = [driver?.firstName, driver?.lastName]
					.filter(Boolean)
					.join(" ")
					.trim();
				return {
					position: [latitude, longitude] as [number, number],
					createdAt: point.createdAt ?? null,
					updatedAt: point.updatedAt ?? null,
					externalDriverId,
					driverName: driverName || null,
				};
			})
			.filter(
				(
					point
				): point is {
					position: [number, number];
					createdAt: string | null;
					updatedAt: string | null;
					externalDriverId: string | null;
					driverName: string | null;
				} => point !== null
			);
	}, [loadDrivers, sortedTrackingPoints]);

	const currentTrackingDriver = useMemo(() => {
		const lastTrackingPoint = sortedTrackingPoints[sortedTrackingPoints.length - 1];
		const externalDriverId = lastTrackingPoint?.externalDriverId?.trim();
		if (!externalDriverId) return null;

		return (
			loadDrivers.find((driver) => driver.externalId?.trim() === externalDriverId) ??
			null
		);
	}, [loadDrivers, sortedTrackingPoints]);

	const currentDriverLatitude = Number(currentTrackingDriver?.latitude);
	const currentDriverLongitude = Number(currentTrackingDriver?.longitude);
	const hasCurrentDriverCoordinates =
		Number.isFinite(currentDriverLatitude) && Number.isFinite(currentDriverLongitude);

	const mapLoadData = useMemo(() => ({
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
		pick_up_location: loadMetaData?.pick_up_location ?? null,
		delivery_location: loadMetaData?.delivery_location ?? null,
		load_history: loadHistory,
		load_history_details: loadHistoryDetails,
	}), [
		currentDriverLatitude,
		currentDriverLongitude,
		currentTrackingDriver,
		hasCurrentDriverCoordinates,
		loadMetaData,
		loadHistory,
		loadHistoryDetails,
	]);

	return (
		<section className="absolute inset-0 w-full h-full" data-load-id={loadId}>
			<TrackingDeliveryMap
				driverData={mapLoadData}
				showEmptyMap
				initialZoom={4}
			/>
			{currentTrackingDriver && (
				<div className="absolute bottom-[50px] left-1/2 transform -translate-x-1/2 z-[1000]">
					<DriverInfo driverData={mapLoadData} />
				</div>
			)}
		</section>
	);
}
