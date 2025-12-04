"use client";

import { useEffect, useState, useRef, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";
import dynamic from "next/dynamic";

const TrackingDeliveryMap = dynamic(
  () => import("@/components/logistics/TrackingDeliveryMap"),
  { ssr: false },
);

interface TrackingMapClientProps {
  driverId: string;
  onDriverDataChange?: (data: DriverData | null) => void;
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

export default function TrackingMapClient({ driverId, onDriverDataChange }: TrackingMapClientProps) {
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
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          lastLocationUpdateAt: data.lastLocationUpdateAt || null,
        };
        setDriverData(newDriverData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
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
    let baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

    // If NEXT_PUBLIC_WS_URL is already ws:// or wss://, convert to http/https
    if (baseUrl.startsWith('ws://')) {
      baseUrl = baseUrl.replace('ws://', 'http://');
    } else if (baseUrl.startsWith('wss://')) {
      baseUrl = baseUrl.replace('wss://', 'https://');
    }

    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    // Connect to base WebSocket server (same as main chat, but without auth)
    // No namespace - use base URL like the main WebSocket connection
    console.log('🔌 [Tracking] Connecting to public WebSocket');

    // Connect to base WebSocket server (no authentication, no namespace)
    // Same approach as main WebSocketContext but without auth token
    const socket = io(cleanBaseUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [Tracking] WebSocket connected for real-time location updates');
      console.log('✅ [Tracking] Socket ID:', socket.id);
    });

    socket.on('connected', (data: any) => {
      if (data.public) {
        console.log('✅ [Tracking] Public connection confirmed by server');
      } else {
        console.log('✅ [Tracking] Authenticated connection confirmed');
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ [Tracking] WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ [Tracking] WebSocket connection error:', error);
    });

    // Listen for user location updates
    socket.on('userLocationUpdate', (payload: LocationUpdatePayload) => {
      console.log('📍 [Tracking] Received location update');

      // Check if the update is for our driver (by externalId)
      if (payload.externalId && payload.externalId === driverId) {
        console.log('✅ [Tracking] Location update matches our driver, updating coordinates');

        // Update driver data with new coordinates
        setDriverData((prevData) => {
          if (!prevData) return prevData;

          return {
            ...prevData,
            latitude: payload.latitude ?? prevData.latitude,
            longitude: payload.longitude ?? prevData.longitude,
            city: payload.city ?? prevData.city,
            state: payload.state ?? prevData.state,
            zip: payload.zip ?? prevData.zip,
            lastLocationUpdateAt: payload.lastLocationUpdateAt ?? prevData.lastLocationUpdateAt,
          };
        });
      } else {
        console.log('⏭️ [Tracking] Location update is for different driver, ignoring');
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 [Tracking] Disconnecting WebSocket');
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

