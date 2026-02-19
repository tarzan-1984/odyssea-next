"use client";

import { Modal } from "@/components/ui/modal";
import WheelLoader from "@/app/(admin)/(ui-elements)/spinners/WheelLoader";
import DriversListTable from "./DriversListTable";

export interface AddDriversModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** Offer id to add drivers to (for future API call). */
	offerId: string;
	/** Driver IDs already in this offer (blocked from selecting again). */
	existingDriverIds?: string[];
	/** True while the add-drivers API request is in progress. */
	isSubmitting?: boolean;
	/** Called when user clicks "Add drivers" with selected driver IDs. */
	onAddDrivers?: (offerId: string, selectedDriverIds: string[]) => void | Promise<void>;
}

export default function AddDriversModal({
	isOpen,
	onClose,
	offerId,
	existingDriverIds = [],
	isSubmitting = false,
	onAddDrivers,
}: AddDriversModalProps) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-lg"
			showCloseButton={false}
			closeOnBackdropClick={false}
		>
			<div className="relative flex flex-1 flex-col min-h-0">
				<div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/[0.05]">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
							Add drivers
						</h2>
						<p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400" title={offerId}>
							Offer ID: <span className="font-mono text-gray-700 dark:text-gray-300">{offerId}</span>
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:h-10 sm:w-10"
						aria-label="Close"
					>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="shrink-0"
						>
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
								fill="currentColor"
							/>
						</svg>
					</button>
				</div>
				<div className="flex-1 overflow-auto min-h-0">
					<DriversListTable
					showActionsInHeader={false}
					existingDriverIds={existingDriverIds}
					footerButton={{
						label: "Add drivers",
						icon: (
							<img
								src="/images/add_icon.png"
								alt=""
								width={24}
								height={24}
								className="shrink-0"
							/>
						),
						isLoading: isSubmitting,
						onClick: async (selectedDriverIds) => {
							await onAddDrivers?.(offerId, selectedDriverIds);
							onClose();
						},
					}}
				/>
				</div>
				{isSubmitting && (
					<div
						className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-white/10"
						aria-hidden
					>
						<WheelLoader size={160} />
					</div>
				)}
			</div>
		</Modal>
	);
}
