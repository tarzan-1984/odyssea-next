import DeliveryActivityTable from "@/components/logistics/DeliveriesActivityTable";
import LogisticsMetrics from "@/components/logistics/LogisticsMetrics";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Next.js Logistics Dashboard | TailAdmin - Next.js Dashboard Template",
	description:
		"This is Next.js Logistics Dashboard for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function DashboardPage() {
	return (
		<div className="space-y-6">
			<LogisticsMetrics />
			<DeliveryActivityTable />
		</div>
	);
}
