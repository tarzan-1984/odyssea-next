import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import NewsUpdatesPageClient from "@/components/news-updates/NewsUpdatesPageClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "News/Updates | Odysseia Web",
	description: "Company news and updates",
};

export default function NewsUpdatesPage() {
	return (
		<div>
			<PageBreadcrumb pageTitle="News/Updates" />
			<NewsUpdatesPageClient />
		</div>
	);
}
