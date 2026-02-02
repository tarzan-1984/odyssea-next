"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { clientAuth } from "@/utils/auth";
import React, { useEffect, useState } from "react";

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
	const { isExpanded, isHovered, isMobileOpen } = useSidebar();
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

	// Dynamic class for main content margin based on sidebar state
	const mainContentMargin = isMobileOpen
		? "ml-0"
		: isExpanded || isHovered
			? "xl:ml-[240px]"
			: "xl:ml-[90px]";

	// If not authenticated, render without layout (just the content)
	if (!isLoading && !isAuthenticated) {
		return <>{children}</>;
	}

	// If authenticated, render with admin layout (sidebar + header)
	if (!isLoading && isAuthenticated) {
		return (
			<div className="min-h-screen xl:flex">
				{/* Sidebar and Backdrop */}
				<AppSidebar />
				<Backdrop />
				{/* Main Content Area */}
				<div
					className={`flex-1 transition-all duration-300 ease-in-out overflow-hidden ${mainContentMargin}`}
				>
					{/* Header */}
					<AppHeader />
					{/* Page Content - full-width map without padding */}
					<div className="relative h-[calc(100vh-64px)] overflow-hidden">{children}</div>
				</div>
			</div>
		);
	}

	// Loading state - show content without layout to avoid flash
	return <>{children}</>;
}
