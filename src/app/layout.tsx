import React from "react";
import { Outfit } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import Providers from "@/app/Providers";

const outfit = Outfit({
	subsets: ["latin"],
});



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
			<body className={`${outfit.className} dark:bg-gray-900`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
