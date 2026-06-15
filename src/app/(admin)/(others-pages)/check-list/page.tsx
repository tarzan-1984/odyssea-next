import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CheckListPageClient from "@/components/tables/DataTables/CheckListTable/CheckListPageClient";
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
			<CheckListPageClient />
		</div>
	);
}
