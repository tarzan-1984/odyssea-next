import InvoiceMain from "@/components/invoice/InvoiceMain";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "This is Next.js E-commerce  Single Invoice TailAdmin Dashboard Template",
};

export default function SingleInvoicePage() {
	return (
		<div>
			<InvoiceMain />
		</div>
	);
}
