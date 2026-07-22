import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import AppLogsPageClient from "@/components/tables/DataTables/AppLogsTable/AppLogsPageClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "App Logs | Odysseia Web",
	description: "Application audit logs (administrators only)",
};

export default function AppLogsPage() {
	return (
		<div>
			<PageBreadcrumb pageTitle="App Logs" />
			<AppLogsPageClient />
		</div>
	);
}
