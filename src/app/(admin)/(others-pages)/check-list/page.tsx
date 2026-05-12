import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CheckListTable from "@/components/tables/DataTables/CheckListTable/CheckListTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Check list | Odysseia Web",
	description: "Drivers with stale location (NY) for loaded en route / available",
};

export default function CheckListPage() {
	return (
		<div>
			<PageBreadcrumb pageTitle="Check list" />
			<ComponentCard title="Check list">
				<p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
					ACTIVE drivers (loaded en route or available) whose last location update is older than 3
					hours. Default sort is oldest location first; use the &quot;Last location update&quot;
					column header to toggle. Timestamps use America/New_York wall time in YYYY-MM-DD HH:mm:ss
					form.
				</p>
				<CheckListTable />
			</ComponentCard>
		</div>
	);
}
