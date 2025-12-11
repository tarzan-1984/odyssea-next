"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clientAuth } from "@/utils/auth";

interface TrackingPageWrapperProps {
	children: ReactNode;
}

export default function TrackingPageWrapper({ children }: TrackingPageWrapperProps) {
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

	// Use h-full for authenticated users, h-screen for unauthenticated
	const heightClass = !isLoading && isAuthenticated ? "h-full" : "h-screen";

	return <main className={`${heightClass} w-full relative overflow-hidden`}>{children}</main>;
}
