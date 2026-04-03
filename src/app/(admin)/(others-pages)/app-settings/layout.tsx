import type { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "App settings | Odysseia Web",
	description: "Application-wide location and mobile client settings",
};

export default function AppSettingsLayout({ children }: { children: ReactNode }) {
	return children;
}
