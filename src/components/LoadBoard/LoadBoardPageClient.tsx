"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import NewShipmentPlusIcon from "./NewShipmentPlusIcon";
import ShipmentCreatedSuccessModal from "./ShipmentCreatedSuccessModal";
import LoadBoardTable from "./LoadBoardTable";

const NewShipmentModal = dynamic(() => import("./NewShipmentModal"), {
	ssr: false,
});

export default function LoadBoardPageClient() {
	const [isNewShipmentOpen, setIsNewShipmentOpen] = useState(false);
	const [isSuccessOpen, setIsSuccessOpen] = useState(false);
	const [tableRefreshKey, setTableRefreshKey] = useState(0);

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

			<LoadBoardTable refreshKey={tableRefreshKey} />

			<NewShipmentModal
				isOpen={isNewShipmentOpen}
				onClose={() => setIsNewShipmentOpen(false)}
				onSuccess={() => {
					setIsSuccessOpen(true);
					setTableRefreshKey(prev => prev + 1);
				}}
			/>
			<ShipmentCreatedSuccessModal
				isOpen={isSuccessOpen}
				onClose={() => setIsSuccessOpen(false)}
			/>
		</div>
	);
}
