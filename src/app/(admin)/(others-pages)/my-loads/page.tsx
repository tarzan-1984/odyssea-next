import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "My Loads | TailAdmin - Next.js Dashboard Template",
	description: "My Loads page for TailAdmin Dashboard Template",
};

export default function MyLoadsPage() {
	return (
		<div>
			<PageBreadcrumb pageTitle="My Loads" />
			<div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
				<div className="mx-auto w-full max-w-[630px] text-center">
					<h3 className="mb-4 font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
						Coming Soon
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
						My Loads functionality will be available soon. This page is under
						development.
					</p>
				</div>
			</div>
		</div>
	);
}
