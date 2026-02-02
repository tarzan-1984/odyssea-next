"use client";

import React from "react";

const STATUS_MAP: Record<string, string> = {
	available: "Available",
	available_on: "Available on",
	available_off: "Not available",
	loaded_enroute: "Loaded & Enroute",
	banned: "Out of service",
	on_vocation: "On vacation",
	no_updates: "No updates",
	blocked: "Blocked",
	expired_documents: "Expired documents",
	no_interview: "No Interview",
	on_hold: "On hold",
	need_update: "Need update",
	unknown: "Unknown",
};

function formatDriverStatus(status: string | null | undefined): string {
	if (!status) return "Unknown";
	return STATUS_MAP[status.toLowerCase()] ?? status;
}

interface DriverInfoModalProps {
	visible: boolean;
	onClose: () => void;
	driverData: Record<string, unknown> | null;
	isLoading?: boolean;
	showChatButton?: boolean;
	onChatPress?: () => void;
	isChatActionLoading?: boolean;
	isDriverActive?: boolean;
}

export default function DriverInfoModal({
	visible,
	onClose,
	driverData,
	isLoading = false,
	showChatButton = false,
	onChatPress,
	isChatActionLoading = false,
	isDriverActive = true,
}: DriverInfoModalProps) {
	if (!visible) return null;

	const organized = driverData?.organized_data as Record<string, unknown> | undefined;
	const contactData = organized?.contact as Record<string, unknown> | undefined;
	const locationData = organized?.current_location as Record<string, unknown> | undefined;
	const vehicleData = organized?.vehicle as Record<string, unknown> | undefined;
	const documentsData = organized?.documents as Record<string, unknown> | undefined;
	const equipmentData = vehicleData?.equipment as Record<string, unknown> | undefined;

	const driverId = (driverData?.id as string) || "N/A";
	const driverName = (contactData?.driver_name as string) || "N/A";
	const driverPhone = (contactData?.driver_phone as string) || "N/A";
	const driverStatus =
		(locationData?.status as string) || (driverData?.driverStatus as string) || null;
	const city = (locationData?.city as string) || "";
	const state = (locationData?.state as string) || "";
	const location = city && state ? `${city}, ${state}` : city || state || "N/A";

	const dimensions =
		(vehicleData?.overall_dimensions as string) ||
		(vehicleData?.cargo_space_dimensions as string) ||
		"N/A";
	const payload = (vehicleData?.payload as string) || "N/A";
	const vehicleType =
		((vehicleData?.type as Record<string, string>)?.label as string) ||
		(vehicleData?.type as string) ||
		"N/A";

	const additionalDetails: string[] = [];
	if (equipmentData && typeof equipmentData === "object") {
		Object.keys(equipmentData).forEach(key => {
			const value = equipmentData[key];
			if (
				value &&
				(typeof value === "boolean" ||
					(typeof value === "string" && (value as string).trim() !== ""))
			) {
				const formattedKey = key
					.split("_")
					.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
					.join(" ");
				additionalDetails.push(formattedKey);
			}
		});
	}
	if (documentsData?.real_id) additionalDetails.push("Real ID");
	if (equipmentData?.printer) additionalDetails.push("Printer");
	if (equipmentData?.ppe) additionalDetails.push("PPE");
	const additionalDetailsText =
		additionalDetails.length > 0 ? additionalDetails.join(", ") : "N/A";

	const isPhoneAvailable = !!driverPhone && driverPhone !== "N/A";

	const handlePhoneClick = () => {
		if (isPhoneAvailable) {
			const phoneNumber = driverPhone.replace(/[^\d+]/g, "");
			window.location.href = `tel:${phoneNumber}`;
		}
	};

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
			onClick={onClose}
			role="presentation"
		>
			<div
				className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
				onClick={e => e.stopPropagation()}
				role="dialog"
				aria-modal
			>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						Unit #{driverId}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-2xl leading-none text-gray-500 hover:text-gray-700 dark:text-gray-400"
					>
						×
					</button>
				</div>

				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-10">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
						<p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
							Loading driver data...
						</p>
					</div>
				) : driverData ? (
					<div className="space-y-0 divide-y divide-gray-200 dark:divide-gray-700">
						<InfoRow label="Name" value={driverName} />
						<InfoRow
							label="Phone"
							value={
								<button
									type="button"
									onClick={handlePhoneClick}
									disabled={!isPhoneAvailable}
									className={
										isPhoneAvailable
											? "font-medium text-brand-600 underline hover:text-brand-700"
											: "text-gray-500"
									}
								>
									{driverPhone}
								</button>
							}
						/>
						<InfoRow label="Location" value={location} />
						<InfoRow label="Dimensions" value={dimensions} />
						<InfoRow label="Payload" value={payload} />
						<InfoRow label="Vehicle Type" value={vehicleType} />
						<InfoRow label="Additional Details" value={additionalDetailsText} />
						<InfoRow label="Status" value={formatDriverStatus(driverStatus)} />
					</div>
				) : (
					<p className="py-8 text-center text-sm text-red-600 dark:text-red-400">
						Failed to load driver data
					</p>
				)}

				{showChatButton && (
					<div className="mt-4">
						{isDriverActive ? (
							<button
								type="button"
								onClick={() => onChatPress?.()}
								disabled={isChatActionLoading}
								className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
							>
								{isChatActionLoading ? (
									<>
										<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
										Loading...
									</>
								) : (
									"Go to chat"
								)}
							</button>
						) : (
							<p className="text-center text-sm text-amber-600 dark:text-amber-500">
								Driver is not using the app
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex justify-between gap-4 py-3">
			<span className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
				{label}:
			</span>
			<span className="min-w-0 flex-1 text-right text-sm text-gray-900 dark:text-white">
				{value}
			</span>
		</div>
	);
}
