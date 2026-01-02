import React from "react";
import { Outfit } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import UserInitializer from "@/components/common/UserInitializer";
import NotificationsInitializer from "@/components/common/NotificationsInitializer";
import { ToastNotificationManager } from "@/components/notifications/ToastNotificationManager";
import ChatSyncInitializer from "@/components/common/ChatSyncInitializer";

const outfit = Outfit({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "Odysseia Web Application",
	icons: {
		icon: "/icon.png",
		apple: "/icon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${outfit.className} dark:bg-gray-900`}>
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
			</body>
		</html>
	);
}
