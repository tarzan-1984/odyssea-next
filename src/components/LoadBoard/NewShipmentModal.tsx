"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Radio from "@/components/form/input/Radio";
import MultiSelect from "@/components/form/MultiSelect";
import TimePicker from "@/components/form/TimePicker";
import Button from "@/components/ui/button/Button";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";
import { ChevronDownIcon } from "@/icons";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { createLoadBoardShipment, updateLoadBoardShipment, type LoadBoardShipment } from "@/app-api/loadBoardShipments";
import BidRateRouteBuilder, {
	bidRouteRowsToPayload,
	createBidRouteRow,
	initialBidRouteRows,
	validateBidRouteRows,
	type BidRouteRow,
} from "@/components/BidRates/BidRateRouteBuilder";
import ShipmentDatePicker from "./ShipmentDatePicker";
import { getLoadBoardPickupPastError } from "./loadBoardTableUtils";
import {
	EQUIPMENT_OPTIONS,
	NEW_SHIPMENT_TABS,
	SPECIAL_INSTRUCTION_OPTIONS,
	type EquipmentType,
	type LoadType,
	type NewShipmentTabId,
} from "./newShipmentConstants";

type NewShipmentModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (mode: "create" | "edit") => void;
	/** When set, modal opens in edit mode with prefilled values. */
	shipment?: LoadBoardShipment | null;
	/** Prefill create form (Duplicate) without switching to edit mode. */
	prefillShipment?: LoadBoardShipment | null;
};

type NewShipmentForm = {
	pickupEarliest: string;
	pickupLatest: string;
	pickupHours: string;
	dropOffHours: string;
	weight: string;
	commodity: string;
	specialInstructions: string[];
	loadType: LoadType;
	equipment: EquipmentType;
	equipmentLength: string;
	equipmentWeight: string;
	comments: string;
	referenceId: string;
	rate: string;
};

const EMPTY_FORM: NewShipmentForm = {
	pickupEarliest: "",
	pickupLatest: "",
	pickupHours: "",
	dropOffHours: "",
	weight: "",
	commodity: "",
	specialInstructions: [],
	loadType: "full",
	equipment: "cargo_van",
	equipmentLength: "",
	equipmentWeight: "",
	comments: "",
	referenceId: "",
	rate: "",
};

function shipmentToRouteRows(shipment: LoadBoardShipment): BidRouteRow[] {
	const route = Array.isArray(shipment.route) ? shipment.route : [];
	if (route.length < 2) return initialBidRouteRows();
	return route.map((point, index) => {
		const isFirstPickup =
			point.type === "pick_up_location" &&
			route.findIndex(p => p.type === "pick_up_location") === index;
		const isLastDelivery =
			point.type === "delivery_location" &&
			[...route]
				.map((p, i) => ({ p, i }))
				.reverse()
				.find(entry => entry.p.type === "delivery_location")?.i === index;

		const latitude =
			typeof point.latitude === "number"
				? point.latitude
				: isFirstPickup && shipment.pickupLat != null
					? shipment.pickupLat
					: isLastDelivery && shipment.deliveryLat != null
						? shipment.deliveryLat
						: null;
		const longitude =
			typeof point.longitude === "number"
				? point.longitude
				: isFirstPickup && shipment.pickupLng != null
					? shipment.pickupLng
					: isLastDelivery && shipment.deliveryLng != null
						? shipment.deliveryLng
						: null;

		return {
			...createBidRouteRow(
				point.type === "pick_up_location" ? "pickup" : "delivery",
			),
			location: point.location?.trim() || "",
			latitude,
			longitude,
		};
	});
}

function shipmentToForm(shipment: LoadBoardShipment): NewShipmentForm {
	const special = Array.isArray(shipment.specialInstructions)
		? shipment.specialInstructions.filter(
				(item): item is string => typeof item === "string" && item.trim().length > 0,
			)
		: [];
	const equipment =
		shipment.equipment === "box_truck" ||
		shipment.equipment === "dry_van" ||
		shipment.equipment === "cargo_van"
			? shipment.equipment
			: "cargo_van";

	return {
		pickupEarliest: shipment.pickupEarliest?.trim() || "",
		pickupLatest: shipment.pickupLatest?.trim() || "",
		pickupHours: shipment.pickupHours?.trim() || "",
		dropOffHours: shipment.dropOffHours?.trim() || "",
		weight:
			shipment.weight != null && Number.isFinite(shipment.weight)
				? String(shipment.weight)
				: "",
		commodity: shipment.commodity?.trim() || "",
		specialInstructions: special,
		loadType: shipment.loadType === "partial" ? "partial" : "full",
		equipment,
		equipmentLength:
			shipment.equipmentLength != null && Number.isFinite(shipment.equipmentLength)
				? String(shipment.equipmentLength)
				: "",
		equipmentWeight:
			shipment.equipmentWeight != null && Number.isFinite(shipment.equipmentWeight)
				? String(shipment.equipmentWeight)
				: "",
		comments: shipment.comments?.trim() || "",
		referenceId: shipment.referenceId?.trim() || "",
		rate:
			shipment.rate != null && Number.isFinite(shipment.rate)
				? String(shipment.rate)
				: "",
	};
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h5 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
			{children}
		</h5>
	);
}

export default function NewShipmentModal({
	isOpen,
	onClose,
	onSuccess,
	shipment = null,
	prefillShipment = null,
}: NewShipmentModalProps) {
	const isEdit = shipment != null;
	const [activeTab, setActiveTab] = useState<NewShipmentTabId>("load-details");
	const [routeRows, setRouteRows] = useState<BidRouteRow[]>(initialBidRouteRows);
	const [form, setForm] = useState<NewShipmentForm>(EMPTY_FORM);
	const [formKey, setFormKey] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		setActiveTab("load-details");
		const source = shipment ?? prefillShipment;
		if (source) {
			setRouteRows(shipmentToRouteRows(source));
			setForm(shipmentToForm(source));
		} else {
			setRouteRows(initialBidRouteRows());
			setForm(EMPTY_FORM);
		}
		setFormKey(prev => prev + 1);
		setError(null);
		setSubmitting(false);
	}, [isOpen, shipment, prefillShipment]);

	function updateField<K extends keyof NewShipmentForm>(key: K, value: NewShipmentForm[K]) {
		setForm(prev => ({ ...prev, [key]: value }));
	}

	const showEquipmentSizeFields =
		form.equipment === "box_truck" || form.equipment === "dry_van";

	async function handleSubmit() {
		setError(null);

		const routeError = validateBidRouteRows(routeRows);
		if (routeError) {
			setActiveTab("load-details");
			setError(routeError);
			return;
		}

		if (!form.pickupEarliest.trim()) {
			setActiveTab("load-details");
			setError("Pick up earliest is required.");
			return;
		}

		const pickupPastError = getLoadBoardPickupPastError({
			pickupEarliest: form.pickupEarliest,
			pickupLatest: form.pickupLatest,
			pickupHours: form.pickupHours,
		});
		if (pickupPastError) {
			setActiveTab("load-details");
			setError(pickupPastError);
			return;
		}

		const weight = Number(form.weight.replace(/,/g, "").trim());
		if (!form.weight.trim() || !Number.isFinite(weight) || weight < 0) {
			setActiveTab("freight-details");
			setError("Please enter a valid weight.");
			return;
		}

		const commodity = form.commodity.trim();
		if (!commodity) {
			setActiveTab("freight-details");
			setError("Commodity is required.");
			return;
		}

		setSubmitting(true);
		try {
			const needsEquipmentSize = showEquipmentSizeFields;
			const equipmentLengthRaw = form.equipmentLength.replace(/,/g, "").trim();
			const equipmentWeightRaw = form.equipmentWeight.replace(/,/g, "").trim();
			const rateRaw = form.rate.replace(/,/g, "").trim();
			const rate = rateRaw ? Number(rateRaw) : undefined;
			if (rateRaw && (!Number.isFinite(rate) || (rate ?? 0) < 0)) {
				setActiveTab("additional-information");
				setError("Please enter a valid rate.");
				setSubmitting(false);
				return;
			}

			const payload = {
				route: bidRouteRowsToPayload(routeRows),
				pickupEarliest: form.pickupEarliest.trim(),
				pickupLatest: form.pickupLatest.trim() || undefined,
				pickupHours: form.pickupHours.trim() || undefined,
				dropOffHours: form.dropOffHours.trim() || undefined,
				weight,
				commodity,
				specialInstructions:
					form.specialInstructions.length > 0
						? form.specialInstructions
						: undefined,
				loadType: form.loadType,
				equipment: form.equipment,
				equipmentLength:
					needsEquipmentSize && equipmentLengthRaw
						? Number(equipmentLengthRaw)
						: undefined,
				equipmentWeight:
					needsEquipmentSize && equipmentWeightRaw
						? Number(equipmentWeightRaw)
						: undefined,
				comments: form.comments.trim() || undefined,
				referenceId: form.referenceId.trim() || undefined,
				rate,
				...(isEdit && shipment?.status ? { status: shipment.status } : {}),
			};

			if (isEdit && shipment) {
				await updateLoadBoardShipment(shipment.id, payload);
			} else {
				await createLoadBoardShipment(payload);
			}
			onClose();
			onSuccess?.(isEdit ? "edit" : "create");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: isEdit
						? "Failed to update shipment."
						: "Failed to create shipment.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			isFullscreen
			containScroll
			closeOnEscape={!submitting}
			className="flex h-full w-full flex-col overflow-hidden bg-white p-0 dark:bg-gray-900"
		>
			<div className="relative flex h-full min-h-0 flex-col overflow-hidden">
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable] sm:p-8 lg:p-10">
					<div className="mx-auto w-full max-w-3xl space-y-5">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
						{isEdit
							? "Edit Shipment"
							: prefillShipment
								? "Duplicate Shipment"
								: "New Shipment"}
					</h4>

					<div className="border-b border-gray-200 dark:border-gray-800">
						<nav className="-mb-px flex space-x-2 overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
							{NEW_SHIPMENT_TABS.map(tab => (
								<TabButton
									key={tab.id}
									id={tab.id}
									label={tab.label}
									isActive={activeTab === tab.id}
									onClick={() => setActiveTab(tab.id)}
								/>
							))}
						</nav>
					</div>

					{activeTab === "load-details" && (
						<div className="space-y-5">
							<div>
								<h4 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
									Load Details
								</h4>
								<SectionTitle>Location & Timing</SectionTitle>
							</div>

							<BidRateRouteBuilder rows={routeRows} onChange={setRouteRows} />

							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<ShipmentDatePicker
									key={`pickup-earliest-${formKey}`}
									id="shipment-pickup-earliest"
									label="Pick up earliest"
									required
									value={form.pickupEarliest}
									onChange={v => updateField("pickupEarliest", v)}
								/>
								<ShipmentDatePicker
									key={`pickup-latest-${formKey}`}
									id="shipment-pickup-latest"
									label="Pick up latest"
									value={form.pickupLatest}
									onChange={v => updateField("pickupLatest", v)}
								/>
							</div>

							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<TimePicker
									id="shipment-pickup-hours"
									label="Pick up hours"
									value={form.pickupHours}
									onChange={v => updateField("pickupHours", v)}
									className="dark:bg-gray-900"
								/>
								<TimePicker
									id="shipment-dropoff-hours"
									label="Drop off hours"
									value={form.dropOffHours}
									onChange={v => updateField("dropOffHours", v)}
									className="dark:bg-gray-900"
								/>
							</div>
						</div>
					)}

					{activeTab === "freight-details" && (
						<div className="space-y-5">
							<h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
								Freight details
							</h4>

							<div>
								<Label htmlFor="shipment-weight">
									Weight <span className="text-error-500">*</span>
								</Label>
								<div className="mt-1.5">
									<Input
										id="shipment-weight"
										type="number"
										min="0"
										step={1}
										inputMode="numeric"
										value={form.weight}
										onChange={e => updateField("weight", e.target.value)}
										placeholder="Weight in lbs"
										className="dark:bg-gray-900"
									/>
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="shipment-commodity">
										Commodity <span className="text-error-500">*</span>
									</Label>
									<span className="text-xs text-gray-400">
										{form.commodity.length}/100
									</span>
								</div>
								<div className="mt-1.5">
									<Input
										id="shipment-commodity"
										type="text"
										value={form.commodity}
										onChange={e =>
											updateField("commodity", e.target.value.slice(0, 100))
										}
										placeholder="Describe the freight"
										className="dark:bg-gray-900"
									/>
								</div>
							</div>

							<div className="w-full">
								<MultiSelect
									key={`special-${formKey}`}
									label="Special instructions"
									options={[...SPECIAL_INSTRUCTION_OPTIONS]}
									defaultSelected={form.specialInstructions}
									onChange={values => updateField("specialInstructions", values)}
									triggerClassName="min-h-11 py-2"
								/>
							</div>
						</div>
					)}

					{activeTab === "equipment-details" && (
						<div className="space-y-5">
							<h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
								Equipment details
							</h4>

							<div>
								<Label>Load type</Label>
								<div className="mt-3 flex flex-wrap items-center gap-6">
									<Radio
										id="shipment-load-full"
										name="shipment-load-type"
										value="full"
										checked={form.loadType === "full"}
										label="Full"
										onChange={v => updateField("loadType", v as LoadType)}
									/>
									<Radio
										id="shipment-load-partial"
										name="shipment-load-type"
										value="partial"
										checked={form.loadType === "partial"}
										label="Partial"
										onChange={v => updateField("loadType", v as LoadType)}
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="shipment-equipment">
									Equipment <span className="text-error-500">*</span>
								</Label>
								<div className="relative mt-1.5">
									<select
										id="shipment-equipment"
										value={form.equipment}
										onChange={e =>
											updateField("equipment", e.target.value as EquipmentType)
										}
										className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
									>
										{EQUIPMENT_OPTIONS.map(option => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
									<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
										<ChevronDownIcon />
									</span>
								</div>
							</div>

							{showEquipmentSizeFields && (
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div>
										<Label htmlFor="shipment-equipment-length">Length (ft)</Label>
										<div className="mt-1.5">
											<Input
												id="shipment-equipment-length"
												type="number"
												min="0"
												step={1}
												inputMode="numeric"
												value={form.equipmentLength}
												onChange={e =>
													updateField("equipmentLength", e.target.value)
												}
												placeholder="Length in feet"
												className="dark:bg-gray-900"
											/>
										</div>
									</div>
									<div>
										<Label htmlFor="shipment-equipment-weight">Weight (lbs)</Label>
										<div className="mt-1.5">
											<Input
												id="shipment-equipment-weight"
												type="number"
												min="0"
												step={1}
												inputMode="numeric"
												value={form.equipmentWeight}
												onChange={e =>
													updateField("equipmentWeight", e.target.value)
												}
												placeholder="Weight in lbs"
												className="dark:bg-gray-900"
											/>
										</div>
									</div>
								</div>
							)}
						</div>
					)}

					{activeTab === "additional-information" && (
						<div className="space-y-5">
							<h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
								Additional information
							</h4>

							<div>
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="shipment-comments">Comments</Label>
									<span className="text-xs text-gray-400">
										{form.comments.length}/140
									</span>
								</div>
								<div className="mt-1.5">
									<TextArea
										id="shipment-comments"
										rows={3}
										value={form.comments}
										onChange={v => updateField("comments", v.slice(0, 140))}
										placeholder="Any comments about the load"
										className="dark:bg-gray-900"
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="shipment-reference-id">Reference ID</Label>
								<div className="mt-1.5">
									<Input
										id="shipment-reference-id"
										type="text"
										value={form.referenceId}
										onChange={e => updateField("referenceId", e.target.value)}
										placeholder="Load reference number"
										className="dark:bg-gray-900"
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="shipment-rate">Rate</Label>
								<div className="mt-1.5">
									<Input
										id="shipment-rate"
										type="number"
										min="0"
										step={1}
										inputMode="decimal"
										value={form.rate}
										onChange={e => updateField("rate", e.target.value)}
										placeholder="Estimated rate (optional)"
										className="dark:bg-gray-900"
									/>
								</div>
							</div>
						</div>
					)}

					{error ? (
						<p className="text-sm text-red-500 dark:text-red-400">{error}</p>
					) : null}
					</div>
				</div>

				<div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800 sm:px-8">
					{submitting && (
						<div className="mr-1 flex items-center" aria-hidden>
							<SpinnerOne />
						</div>
					)}
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onClose}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						variant="primary"
						onClick={handleSubmit}
						disabled={submitting}
					>
						{isEdit ? "Save" : "Post"}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
