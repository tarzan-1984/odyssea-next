import LoadBoardPageClient from "@/components/LoadBoard/LoadBoardPageClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Load board | Odysseia Web",
	description: "Load board overview",
};

export default function LoadBoardPage() {
	return (
		<div>
			<LoadBoardPageClient />
		</div>
	);
}
