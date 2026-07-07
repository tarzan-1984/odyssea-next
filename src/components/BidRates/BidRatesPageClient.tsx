"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import LeaveBidPlusIcon from "./LeaveBidPlusIcon";

export default function BidRatesPageClient() {
	return (
		<>
			<PageBreadcrumb pageTitle="Bid rates" />
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					startIcon={
						<LeaveBidPlusIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
					}
				>
					Leave bid
				</Button>
			</div>
			<ComponentCard title="Bid rates">
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Bid rates content will be added here.
				</p>
			</ComponentCard>
		</>
	);
}
