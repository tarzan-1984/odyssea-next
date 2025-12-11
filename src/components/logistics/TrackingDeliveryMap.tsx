"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/context/ThemeContext";

// Dynamically import react-leaflet components (client-side only)
// This prevents SSR issues since Leaflet uses window object
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), {
	ssr: false,
});

const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });

const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });

const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

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

	// Custom car marker icon (similar to mobile app)
	const carIcon = useMemo(() => {
		return L.divIcon({
			className: "custom-car-marker",
			html: `
				<div style="width:40px;height:40px;position:relative;">
					<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
						<path d="M20 2C15.26 2 11.4 5.86 11.4 10.6C11.4 12.92 12.69 15.19 14.87 17.37L20 22.5L25.13 17.37C27.31 15.19 28.6 12.92 28.6 10.6C28.6 5.86 24.74 2 20 2Z" fill="#F73E3E" stroke="#000" stroke-width="0.5"/>
						<path d="M12 28L28 28L28 32L12 32Z" fill="#F73E3E" stroke="#000" stroke-width="0.5"/>
						<path d="M10 26L30 26L30 28L10 28Z" fill="#F73E3E" stroke="#000" stroke-width="0.5"/>
						<circle cx="15" cy="30" r="2" fill="#2F4859"/>
						<circle cx="25" cy="30" r="2" fill="#2F4859"/>
					</svg>
				</div>
			`,
			iconSize: [40, 40],
			iconAnchor: [20, 40],
		});
	}, []);

	// Get tile layer URL based on theme
	const tileLayerUrl = useMemo(() => {
		// Use OpenStreetMap for both themes - we'll apply CSS filters for dark theme
		// This ensures text labels remain visible
		return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
	}, []);

	// Get tile layer attribution
	const tileLayerAttribution = useMemo(() => {
		return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
	}, []);

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
				<TileLayer
					key={`tiles-${isDark ? "dark" : "light"}`}
					attribution={tileLayerAttribution}
					url={tileLayerUrl}
				/>
				{markerPosition && (
					<Marker
						position={markerPosition}
						icon={carIcon}
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
