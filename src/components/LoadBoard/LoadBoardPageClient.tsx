"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import type { LoadBoardShipment } from "@/app-api/loadBoardShipments";
import NewShipmentPlusIcon from "./NewShipmentPlusIcon";
import ShipmentCreatedSuccessModal from "./ShipmentCreatedSuccessModal";
import LoadBoardTable from "./LoadBoardTable";

const NewShipmentModal = dynamic(() => import("./NewShipmentModal"), {
	ssr: false,
});

export default function LoadBoardPageClient() {
	const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
	const [editingShipment, setEditingShipment] = useState<LoadBoardShipment | null>(
		null,
	);
	const [prefillShipment, setPrefillShipment] = useState<LoadBoardShipment | null>(
		null,
	);
	const [isSuccessOpen, setIsSuccessOpen] = useState(false);
	const [successMode, setSuccessMode] = useState<"create" | "edit">("create");
	const [tableRefreshKey, setTableRefreshKey] = useState(0);

	const openCreate = () => {
		setEditingShipment(null);
		setPrefillShipment(null);
		setIsShipmentModalOpen(true);
	};

	const openEdit = (shipment: LoadBoardShipment) => {
		setPrefillShipment(null);
		setEditingShipment(shipment);
		setIsShipmentModalOpen(true);
	};

	const openDuplicate = (shipment: LoadBoardShipment) => {
		setEditingShipment(null);
		setPrefillShipment(shipment);
		setIsShipmentModalOpen(true);
	};

	const closeShipmentModal = () => {
		setIsShipmentModalOpen(false);
		setEditingShipment(null);
		setPrefillShipment(null);
	};

	return (
		<div>
			<PageBreadcrumb pageTitle="Load board" />
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					onClick={openCreate}
					startIcon={
						<NewShipmentPlusIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
					}
				>
					New Shipment
				</Button>
			</div>

			<LoadBoardTable
				refreshKey={tableRefreshKey}
				onEditShipment={openEdit}
				onDuplicateShipment={openDuplicate}
			/>

			<NewShipmentModal
				isOpen={isShipmentModalOpen}
				shipment={editingShipment}
				prefillShipment={prefillShipment}
				onClose={closeShipmentModal}
				onSuccess={mode => {
					setSuccessMode(mode);
					setIsSuccessOpen(true);
					setTableRefreshKey(prev => prev + 1);
				}}
			/>
			<ShipmentCreatedSuccessModal
				isOpen={isSuccessOpen}
				mode={successMode}
				onClose={() => setIsSuccessOpen(false)}
			/>
		</div>
	);
}
