"use client";

import { useState, useEffect } from "react";
import TrackingMapClient from "./TrackingMapClient";
import DriverInfo from "./DriverInfo";
import { clientAuth } from "@/utils/auth";

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

interface TrackingPageClientProps {
	driverId: string;
}

export default function TrackingPageClient({ driverId }: TrackingPageClientProps) {
	const [driverData, setDriverData] = useState<DriverData | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Check authentication status on client side
		const checkAuth = () => {
			const authenticated = clientAuth.isAuthenticated();
			setIsAuthenticated(authenticated);
			setIsLoading(false);
		};

		checkAuth();

		// Re-check auth status periodically (in case user logs in/out in another tab)
		const interval = setInterval(checkAuth, 1000);

		return () => clearInterval(interval);
	}, []);

	return (
		<>
			{/* Map takes full screen */}
			<section className="absolute inset-0 w-full h-full">
				<TrackingMapClient driverId={driverId} onDriverDataChange={setDriverData} />
			</section>

			{/* Header overlay - only show for unauthenticated users */}
			{!isLoading && !isAuthenticated && (
				<header className="absolute top-0 left-1/2 transform -translate-x-1/2 z-[1000] mt-4 px-6 py-3 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
					<div className="space-y-1 text-center">
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Live Tracking Delivery
						</h1>
						<p className="text-sm text-slate-500 dark:text-gray-400">
							Public map with real‑time location updates.
						</p>
					</div>
				</header>
			)}

			{/* Driver info overlay - centered at bottom with white background */}
			<div className="absolute bottom-[50px] left-1/2 transform -translate-x-1/2 z-[1000]">
				<DriverInfo driverData={driverData} />
			</div>
		</>
	);
}
