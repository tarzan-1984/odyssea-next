"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import UserInitializer from "@/components/common/UserInitializer";
import ChatSyncInitializer from "@/components/common/ChatSyncInitializer";
import NotificationsInitializer from "@/components/common/NotificationsInitializer";
import { ToastNotificationManager } from "@/components/notifications/ToastNotificationManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
const queryClient = new QueryClient()
const Providers = ({ children }: { children: React.ReactNode }) => {
	return (
		<QueryClientProvider client={queryClient}>
			<ReactQueryDevtools initialIsOpen={false} />
			<ThemeProvider>
				<SidebarProvider>
					<WebSocketProvider>
						<UserInitializer />
						<ChatSyncInitializer />
						<NotificationsInitializer />
						<ToastNotificationManager />
						{children}
					</WebSocketProvider>
				</SidebarProvider>
			</ThemeProvider>
		</QueryClientProvider>
	)
}

export default Providers;
