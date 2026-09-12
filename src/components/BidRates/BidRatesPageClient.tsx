"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import type { BidRatesListScope } from "@/app-api/bidRates";
import { useCurrentUser } from "@/stores/userStore";
import { canCreateBidRates } from "@/utils/roleAccess";
import BidRatesList from "./BidRatesList";
import LeaveBidPlusIcon from "./LeaveBidPlusIcon";

const LeaveBidModal = dynamic(() => import("./LeaveBidModal"), {
	ssr: false,
});

export default function BidRatesPageClient() {
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const canLeaveBid = canCreateBidRates(currentUser?.role);
	const [isLeaveBidModalOpen, setIsLeaveBidModalOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<BidRatesListScope>("general");
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	return (
		<>
			<PageBreadcrumb pageTitle="Bid rates" />
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					disabled={!canLeaveBid}
					onClick={() => {
						if (!canLeaveBid) return;
						setIsLeaveBidModalOpen(true);
					}}
					startIcon={
						<LeaveBidPlusIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
					}
				>
					Leave bid
				</Button>
			</div>
			<div className="mb-4 max-w-xl">
				<Input
					type="text"
					placeholder="Origin / Destination / Broker name"
					value={searchInput}
					onChange={e => setSearchInput(e.target.value)}
					className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600"
				/>
			</div>
			<ComponentCard
				title="Bid rates"
				headerBesideTitle
				headerRight={
					<>
						<Button
							type="button"
							size="sm"
							variant={activeTab === "general" ? "primary" : "outline"}
							className="h-9 whitespace-nowrap"
							onClick={() => setActiveTab("general")}
						>
							General
						</Button>
						<Button
							type="button"
							size="sm"
							variant={activeTab === "my" ? "primary" : "outline"}
							className="h-9 whitespace-nowrap"
							onClick={() => setActiveTab("my")}
						>
							My bids
						</Button>
					</>
				}
			>
				<BidRatesList key={activeTab} scope={activeTab} search={debouncedSearch} />
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
