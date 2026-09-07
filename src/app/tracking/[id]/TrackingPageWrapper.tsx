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

		const onChange = () => checkAuth();
		window.addEventListener("focus", onChange);
		window.addEventListener("storage", onChange);
		document.addEventListener("visibilitychange", onChange);
		return () => {
			window.removeEventListener("focus", onChange);
			window.removeEventListener("storage", onChange);
			document.removeEventListener("visibilitychange", onChange);
		};
	}, []);

	// Use h-full for authenticated users, h-screen for unauthenticated
	const heightClass = !isLoading && isAuthenticated ? "h-full" : "h-screen";

	return <main className={`${heightClass} w-full relative overflow-hidden`}>{children}</main>;
}
