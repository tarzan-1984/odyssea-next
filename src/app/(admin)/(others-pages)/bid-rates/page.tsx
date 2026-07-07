import BidRatesPageClient from "@/components/BidRates/BidRatesPageClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Bid rates | Odysseia Web",
	description: "Bid rates overview",
};

export default function BidRatesPage() {
	return (
		<div>
			<BidRatesPageClient />
		</div>
	);
}
