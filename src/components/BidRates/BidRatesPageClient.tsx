"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import BidRatesList from "./BidRatesList";
import LeaveBidPlusIcon from "./LeaveBidPlusIcon";

const LeaveBidModal = dynamic(() => import("./LeaveBidModal"), {
	ssr: false,
});

export default function BidRatesPageClient() {
	const queryClient = useQueryClient();
	const [isLeaveBidModalOpen, setIsLeaveBidModalOpen] = useState(false);

	return (
		<>
			<PageBreadcrumb pageTitle="Bid rates" />
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					onClick={() => setIsLeaveBidModalOpen(true)}
					startIcon={
						<LeaveBidPlusIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
					}
				>
					Leave bid
				</Button>
			</div>
			<ComponentCard title="Bid rates">
				<BidRatesList />
			</ComponentCard>
			{isLeaveBidModalOpen ? (
				<LeaveBidModal
					isOpen={isLeaveBidModalOpen}
					onClose={() => {
						setIsLeaveBidModalOpen(false);
						queryClient
							.invalidateQueries({ queryKey: ["bid-rates-list"] })
							.catch(() => undefined);
					}}
				/>
			) : null}
		</>
	);
}
