import type { Metadata } from "next";
import { DriversMapPageClient } from "./DriversMapPageClient";

export const metadata: Metadata = {
	title: "Drivers Map - Odysseia",
	description: "Drivers map overview for Odysseia platform.",
};

export default function DriversMapPage() {
	return <DriversMapPageClient />;
}
