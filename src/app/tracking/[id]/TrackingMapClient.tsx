"use client";

import { useEffect, useState, useRef, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";
import dynamic from "next/dynamic";

const TrackingDeliveryMap = dynamic(() => import("@/components/logistics/TrackingDeliveryMap"), {
	ssr: false,
});

interface TrackingMapClientProps {
	driverId: string;
	onDriverDataChange?: (data: DriverData | null) => void;
}

interface DriverData {
	firstName: string;
	lastName: string;
	phone: string;
	profilePhoto: string | null;
	driverStatus: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	latitude: number | null;
	longitude: number | null;
	lastLocationUpdateAt: string | null;
	trackingLoadId?: string | null;
	pick_up_location?: string | null;
	delivery_location?: string | null;
	load_history?: [number, number][];
}

interface LocationUpdatePayload {
	userId: string;
	externalId?: string | null;
	latitude: number | null;
	longitude: number | null;
	location?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	lastLocationUpdateAt?: string | null;
}

export default function TrackingMapClient({
	driverId,
	onDriverDataChange,
}: TrackingMapClientProps) {
	const [driverData, setDriverData] = useState<DriverData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<Socket | null>(null);

	// Fetch initial driver data
	useEffect(() => {
		const fetchDriverData = async () => {
			if (!driverId) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				const response = await fetch(`/api/users/external/${driverId}/public`);

				if (!response.ok) {
					const errorMessage = `Failed to fetch driver data: ${response.status} ${response.statusText}`;
					console.error(errorMessage);
					setError(errorMessage);
					setIsLoading(false);
					return;
				}

				const rawData = await response.json();

				// Handle both direct response and wrapped response
				const data: DriverData = rawData.data || rawData;

				// Save data to state
				const newDriverData = {
					firstName: data.firstName || "",
					lastName: data.lastName || "",
					phone: data.phone || "",
					profilePhoto: data.profilePhoto || null,
					driverStatus: (data as any).driverStatus ?? null,
					city: data.city || null,
					state: data.state || null,
					zip: data.zip || null,
					latitude: data.latitude || null,
					longitude: data.longitude || null,
					lastLocationUpdateAt: data.lastLocationUpdateAt || null,
					trackingLoadId: data.trackingLoadId || null,
					pick_up_location: data.pick_up_location || null,
					delivery_location: data.delivery_location || null,
					load_history: Array.isArray(data.load_history) ? data.load_history : [],
				};
				setDriverData(newDriverData);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error occurred";
				console.error("Error fetching driver data:", error);
				setError(errorMessage);
			} finally {
				setIsLoading(false);
			}
		};

		fetchDriverData();
	}, [driverId]);

	// Notify parent component when driverData changes (after state update)
	useEffect(() => {
		if (driverData && onDriverDataChange) {
			onDriverDataChange(driverData);
		}
	}, [driverData, onDriverDataChange]);

	// Connect to public WebSocket for real-time location updates
	useEffect(() => {
		if (!driverId) return;

		// Build base URL for socket.io connection
		let baseUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL ||
			process.env.NEXT_PUBLIC_WS_URL ||
			"http://localhost:3000";

		// If NEXT_PUBLIC_WS_URL is already ws:// or wss://, convert to http/https
		if (baseUrl.startsWith("ws://")) {
			baseUrl = baseUrl.replace("ws://", "http://");
		} else if (baseUrl.startsWith("wss://")) {
			baseUrl = baseUrl.replace("wss://", "https://");
		}

		// Remove trailing slash if present
		const cleanBaseUrl = baseUrl.replace(/\/$/, "");

		// Connect to base WebSocket server (no authentication, no namespace)
		// Same approach as main WebSocketContext but without auth token
		const socket = io(cleanBaseUrl, {
			transports: ["websocket", "polling"],
			timeout: 20000,
			forceNew: true,
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
		});

		socketRef.current = socket;

		socket.on("connect_error", error => {
			console.error("❌ [Tracking] WebSocket connection error:", error);
		});

		// Listen for user location updates
		socket.on("userLocationUpdate", (payload: LocationUpdatePayload) => {
			// Check if the update is for our driver (by externalId)
			if (payload.externalId && payload.externalId === driverId) {
				// Update driver data with new coordinates
				setDriverData(prevData => {
					if (!prevData) return prevData;

					const updatedDriverData = {
						...prevData,
						latitude: payload.latitude ?? prevData.latitude,
						longitude: payload.longitude ?? prevData.longitude,
						city: payload.city ?? prevData.city,
						state: payload.state ?? prevData.state,
						zip: payload.zip ?? prevData.zip,
						lastLocationUpdateAt:
							payload.lastLocationUpdateAt ?? prevData.lastLocationUpdateAt,
					};
					return updatedDriverData;
				});
			}
		});

		// Cleanup on unmount
		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};
	}, [driverId]);

	return (
		<div className="w-full h-full">
			<TrackingDeliveryMap driverId={driverId} driverData={driverData} />
		</div>
	);
}
