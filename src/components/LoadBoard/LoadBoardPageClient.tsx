"use client";

import React from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function LoadBoardPageClient() {
	return (
		<div>
			<PageBreadcrumb pageTitle="Load board" />
			<div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
				<p className="text-gray-500 dark:text-gray-400">Load board</p>
			</div>
		</div>
	);
}
