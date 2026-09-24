import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import Providers from "@/app/Providers";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "Odysseia Web Application",
	icons: {
		icon: [
			{ url: "/icon.png", type: "image/png" },
			{ url: "/favicon.ico", type: "image/x-icon" },
		],
		apple: "/icon.png",
		shortcut: "/favicon.ico",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body className="font-outfit dark:bg-gray-900">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
