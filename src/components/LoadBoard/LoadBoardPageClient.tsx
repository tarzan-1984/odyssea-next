"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import NewShipmentPlusIcon from "./NewShipmentPlusIcon";

const NewShipmentModal = dynamic(() => import("./NewShipmentModal"), {
	ssr: false,
});

export default function LoadBoardPageClient() {
	const [isNewShipmentOpen, setIsNewShipmentOpen] = useState(false);

	return (
		<div>
			<PageBreadcrumb pageTitle="Load board" />
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					onClick={() => setIsNewShipmentOpen(true)}
					startIcon={
						<NewShipmentPlusIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
					}
				>
					New Shipment
				</Button>
			</div>
			<div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
				<p className="text-gray-500 dark:text-gray-400">Load board</p>
			</div>

			<NewShipmentModal
				isOpen={isNewShipmentOpen}
				onClose={() => setIsNewShipmentOpen(false)}
			/>
		</div>
	);
}
