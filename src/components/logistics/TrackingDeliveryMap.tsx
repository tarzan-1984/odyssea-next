"use client";

import { useMemo } from "react";

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

export default function TrackingDeliveryMap({ driverId, driverData }: TrackingDeliveryMapProps = {}) {
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

	// Generate Google Maps embed URL with marker if coordinates are available
	const mapUrl = useMemo(() => {
		if (hasValidCoordinates && driverData) {
			const lat = driverData.latitude;
			const lng = driverData.longitude;
			
			// Use Google Maps embed URL with coordinates (no API key required)
			// This format shows a marker at the specified coordinates
			// Format: https://www.google.com/maps?q=latitude,longitude&output=embed
			// z=18 is a high zoom level for detailed street view
			return `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=18&output=embed`;
		}
		
		// Default map (fallback)
		return "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3650.5145053176284!2d90.42105717591272!3d23.800296778636472!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c7e9f37a5a3d%3A0x41d7d1d02e1ed0e4!2sPimjo!5e0!3m2!1sen!2sbd!4v1751871078440!5m2!1sen!2sbd";
	}, [hasValidCoordinates, driverData]);

	return (
		<div className="w-full h-full bg-white dark:bg-gray-900 relative">
			{hasValidCoordinates ? (
				<iframe
					key={`${driverData?.latitude}-${driverData?.longitude}`}
					src={mapUrl}
					width="100%"
					height="100%"
					loading="lazy"
					referrerPolicy="no-referrer-when-downgrade"
					className="w-full h-full border-0 grayscale"
					allowFullScreen
				></iframe>
			) : (
				<div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
					<div className="text-center p-4">
						<p className="text-gray-600 dark:text-gray-400 text-sm">
							{driverData ? "Location data not available" : "Loading driver location..."}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
