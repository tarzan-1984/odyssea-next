import React from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import UserInitializer from "@/components/common/UserInitializer";

const outfit = Outfit({
	subsets: ["latin"],
});

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
							{children}
						</WebSocketProvider>
					</SidebarProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
