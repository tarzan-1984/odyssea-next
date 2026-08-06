"use client";

import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

type ShipmentCreatedSuccessModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mode?: "create" | "edit";
};

export default function ShipmentCreatedSuccessModal({
	isOpen,
	onClose,
	mode = "create",
}: ShipmentCreatedSuccessModalProps) {
	const isEdit = mode === "edit";
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900 sm:m-0"
		>
			<div className="text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
					<svg
						className="h-6 w-6 text-green-600 dark:text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
						aria-hidden
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
					{isEdit ? "Shipment updated" : "Shipment created"}
				</h3>
				<p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
					{isEdit
						? "Your shipment was updated successfully."
						: "Your shipment was created successfully."}
				</p>
				<Button type="button" size="sm" variant="primary" onClick={onClose} className="w-full">
					OK
				</Button>
			</div>
		</Modal>
	);
}
