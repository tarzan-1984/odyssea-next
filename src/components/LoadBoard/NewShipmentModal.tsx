"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Radio from "@/components/form/input/Radio";
import Checkbox from "@/components/form/input/Checkbox";
import MultiSelect from "@/components/form/MultiSelect";
import TimePicker from "@/components/form/TimePicker";
import Button from "@/components/ui/button/Button";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";
import { ChevronDownIcon, EditLoadedMilesIcon } from "@/icons";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import {
	createLoadBoardShipment,
	updateLoadBoardShipment,
	type LoadBoardShipment,
} from "@/app-api/loadBoardShipments";
import offers from "@/app-api/offers";
import BidRateRouteBuilder, {
	bidRouteRowsToPayload,
	createBidRouteRow,
	geocodeBidRouteRows,
	initialBidRouteRows,
	validateBidRouteRows,
	type BidRouteRow,
} from "@/components/BidRates/BidRateRouteBuilder";
import { isValidLocationFormat } from "@/utils/offerLocationFormat";
import ShipmentDatePicker from "./ShipmentDatePicker";
import { getLoadBoardPickupPastError } from "./loadBoardTableUtils";
import {
	CARGO_VAN_MAX_WEIGHT_LBS,
	EQUIPMENT_OPTIONS,
	NEW_SHIPMENT_TABS,
	SPECIAL_INSTRUCTION_OPTIONS,
	getCargoVanWeightLimitError,
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
	deliveryEarliest: string;
	deliveryLatest: string;
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
	deliveryEarliest: "",
	deliveryLatest: "",
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
	return route.map((point) => {
		const latitude =
			typeof point.latitude === "number" && Number.isFinite(point.latitude)
				? point.latitude
				: null;
		const longitude =
			typeof point.longitude === "number" && Number.isFinite(point.longitude)
				? point.longitude
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
		deliveryEarliest: shipment.deliveryEarliest?.trim() || "",
		deliveryLatest: shipment.deliveryLatest?.trim() || "",
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

	const [committedLocations, setCommittedLocations] = useState<string[]>([]);
	const [manualLoadedMiles, setManualLoadedMiles] = useState<number | null>(null);
	const [editFallbackLoadedMiles, setEditFallbackLoadedMiles] = useState<number | null>(
		null,
	);
	const [isEditMilesModalOpen, setIsEditMilesModalOpen] = useState(false);
	const [editMilesInput, setEditMilesInput] = useState("");
	const [editMilesError, setEditMilesError] = useState<string | null>(null);
	const [editMilesConfirmed, setEditMilesConfirmed] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		setActiveTab("load-details");
		const source = shipment ?? prefillShipment;
		if (source) {
			const rows = shipmentToRouteRows(source);
			setRouteRows(rows);
			setForm(shipmentToForm(source));
			const locs = rows
				.map(row => row.location.trim())
				.filter(loc => loc !== "" && isValidLocationFormat(loc));
			setCommittedLocations(locs.length >= 2 ? locs : []);
			setEditFallbackLoadedMiles(
				source.loadedMiles != null && Number.isFinite(source.loadedMiles)
					? source.loadedMiles
					: null,
			);
			setManualLoadedMiles(null);
		} else {
			setRouteRows(initialBidRouteRows());
			setForm(EMPTY_FORM);
			setCommittedLocations([]);
			setEditFallbackLoadedMiles(null);
			setManualLoadedMiles(null);
		}
		setFormKey(prev => prev + 1);
		setError(null);
		setSubmitting(false);
		setIsEditMilesModalOpen(false);
		setEditMilesError(null);
		setEditMilesConfirmed(false);
	}, [isOpen, shipment, prefillShipment]);

	function updateField<K extends keyof NewShipmentForm>(key: K, value: NewShipmentForm[K]) {
		setForm(prev => ({ ...prev, [key]: value }));
	}

	const showEquipmentSizeFields =
		form.equipment === "box_truck" || form.equipment === "dry_van";

	const allLocationsFilledAndValid = (locs: string[]) =>
		locs.length >= 2 &&
		locs.every(loc => loc.trim() !== "" && isValidLocationFormat(loc.trim()));

	const {
		data: routeDistanceData,
		isFetching: isCalculatingRoute,
		error: routeDistanceQueryError,
	} = useQuery({
		queryKey: ["load-board-route-distance", committedLocations],
		queryFn: () => offers.calculateRouteDistance(committedLocations),
		enabled:
			manualLoadedMiles == null && allLocationsFilledAndValid(committedLocations),
		staleTime: 20 * 60 * 1000,
		retry: 1,
	});

	const loadedMiles =
		manualLoadedMiles ?? routeDistanceData?.loadedMiles ?? editFallbackLoadedMiles;
	const routeDistanceError =
		manualLoadedMiles != null
			? null
			: routeDistanceQueryError
				? routeDistanceQueryError instanceof Error
					? routeDistanceQueryError.message
					: "Could not calculate route distance"
				: null;
	const showLoadedMilesEditIcon =
		!isCalculatingRoute &&
		(manualLoadedMiles != null ||
			(allLocationsFilledAndValid(committedLocations) &&
				(routeDistanceData?.loadedMiles != null ||
					routeDistanceQueryError != null ||
					editFallbackLoadedMiles != null)));

	const handleLocationsCommit = useCallback((locations: string[]) => {
		setCommittedLocations(locations);
		setManualLoadedMiles(null);
		setEditFallbackLoadedMiles(null);
	}, []);

	const openEditMilesModal = () => {
		setEditMilesInput(
			loadedMiles != null && Number.isFinite(loadedMiles)
				? String(Math.round(loadedMiles))
				: "",
		);
		setEditMilesError(null);
		setEditMilesConfirmed(false);
		setIsEditMilesModalOpen(true);
	};

	const handleChangeMiles = () => {
		const trimmed = editMilesInput.replace(/,/g, "").trim();
		if (!trimmed) {
			setEditMilesError("Enter a value");
			return;
		}
		const parsed = Number.parseFloat(trimmed);
		if (Number.isNaN(parsed)) {
			setEditMilesError("Enter a valid number");
			return;
		}
		if (parsed <= 0) {
			setEditMilesError("Must be greater than zero");
			return;
		}
		setManualLoadedMiles(Math.round(parsed));
		setIsEditMilesModalOpen(false);
		setEditMilesError(null);
	};

	async function handleSubmit() {
		setError(null);
		setSubmitting(true);

		const { rows: geocodedRows, error: geocodeError } = await geocodeBidRouteRows(routeRows);
		setRouteRows(geocodedRows);
		if (geocodeError) {
			setActiveTab("load-details");
			setError(geocodeError);
			setSubmitting(false);
			return;
		}

		const routeError = validateBidRouteRows(geocodedRows);
		if (routeError) {
			setActiveTab("load-details");
			setError(routeError);
			setSubmitting(false);
			return;
		}

		if (!form.pickupEarliest.trim()) {
			setActiveTab("load-details");
			setError("Pick up earliest is required.");
			setSubmitting(false);
			return;
		}

		const pickupPastError = getLoadBoardPickupPastError({
			pickupEarliest: form.pickupEarliest,
			pickupLatest: form.pickupLatest,
			pickupHours: form.pickupHours,
			deliveryEarliest: form.deliveryEarliest,
			deliveryLatest: form.deliveryLatest,
			dropOffHours: form.dropOffHours,
		});
		if (pickupPastError) {
			setActiveTab("load-details");
			setError(pickupPastError);
			setSubmitting(false);
			return;
		}

		const weight = Number(form.weight.replace(/,/g, "").trim());
		if (!form.weight.trim() || !Number.isFinite(weight) || weight < 0) {
			setActiveTab("freight-details");
			setError("Please enter a valid weight.");
			setSubmitting(false);
			return;
		}

		const cargoVanWeightError = getCargoVanWeightLimitError(form.equipment, weight);
		if (cargoVanWeightError) {
			setActiveTab("freight-details");
			setError(cargoVanWeightError);
			setSubmitting(false);
			return;
		}

		const commodity = form.commodity.trim();
		if (!commodity) {
			setActiveTab("freight-details");
			setError("Commodity is required.");
			setSubmitting(false);
			return;
		}

		if (isCalculatingRoute) {
			setActiveTab("load-details");
			setError("Please wait for route distance calculation to complete.");
			setSubmitting(false);
			return;
		}

		if (loadedMiles == null || !Number.isFinite(loadedMiles) || loadedMiles <= 0) {
			setActiveTab("load-details");
			setError(
				routeDistanceError ||
					"Loaded miles could not be calculated. Fill all addresses and blur, or enter miles manually.",
			);
			setSubmitting(false);
			return;
		}

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
				route: bidRouteRowsToPayload(geocodedRows),
				pickupEarliest: form.pickupEarliest.trim(),
				pickupLatest: form.pickupLatest.trim() || undefined,
				deliveryEarliest: form.deliveryEarliest.trim() || undefined,
				deliveryLatest: form.deliveryLatest.trim() || undefined,
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
				loadedMiles: Math.round(loadedMiles),
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
		<>
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

							<BidRateRouteBuilder
								rows={routeRows}
								onChange={setRouteRows}
								onLocationsCommit={handleLocationsCommit}
							/>

							<div className="relative max-w-md">
								<Label htmlFor="shipment-loaded-miles">Loaded miles</Label>
								<div className="relative mt-1.5">
									<Input
										id="shipment-loaded-miles"
										type="text"
										readOnly
										value={
											loadedMiles != null && Number.isFinite(loadedMiles)
												? String(Math.round(loadedMiles))
												: ""
										}
										placeholder="Fill all addresses and blur to calculate"
										className={`cursor-not-allowed dark:bg-gray-900 ${
											showLoadedMilesEditIcon ? "pr-11" : ""
										}`}
									/>
									{showLoadedMilesEditIcon && (
										<button
											type="button"
											onClick={openEditMilesModal}
											className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
											aria-label="Edit loaded miles"
										>
											<EditLoadedMilesIcon className="h-5 w-5" />
										</button>
									)}
									{isCalculatingRoute && (
										<div
											className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-900/80"
											aria-hidden
										>
											<SpinnerOne />
										</div>
									)}
								</div>
								{routeDistanceError ? (
									<p className="mt-1.5 text-sm text-red-500 dark:text-red-400">
										{routeDistanceError}
									</p>
								) : null}
							</div>

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
								<ShipmentDatePicker
									key={`delivery-earliest-${formKey}`}
									id="shipment-delivery-earliest"
									label="Delivery earliest"
									value={form.deliveryEarliest}
									onChange={v => updateField("deliveryEarliest", v)}
								/>
								<ShipmentDatePicker
									key={`delivery-latest-${formKey}`}
									id="shipment-delivery-latest"
									label="Delivery latest"
									value={form.deliveryLatest}
									onChange={v => updateField("deliveryLatest", v)}
								/>
							</div>

							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<TimePicker
									key={`pickup-hours-${formKey}`}
									id="shipment-pickup-hours"
									label="Pick up hours"
									value={form.pickupHours}
									onChange={v => updateField("pickupHours", v)}
									allowTimeRange
									className="dark:bg-gray-900"
								/>
								<TimePicker
									key={`dropoff-hours-${formKey}`}
									id="shipment-dropoff-hours"
									label="Drop off hours"
									value={form.dropOffHours}
									onChange={v => updateField("dropOffHours", v)}
									allowTimeRange
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
										max={
											form.equipment === "cargo_van"
												? String(CARGO_VAN_MAX_WEIGHT_LBS)
												: undefined
										}
										step={1}
										inputMode="numeric"
										value={form.weight}
										onChange={e => updateField("weight", e.target.value)}
										placeholder="Weight in lbs"
										hint={
											form.equipment === "cargo_van"
												? `Maximum ${CARGO_VAN_MAX_WEIGHT_LBS.toLocaleString("en-US")} lbs for Cargo van`
												: undefined
										}
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

		<Modal
			isOpen={isEditMilesModalOpen}
			onClose={() => {
				setIsEditMilesModalOpen(false);
				setEditMilesError(null);
				setEditMilesConfirmed(false);
			}}
			className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
		>
			<h4 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
				Change loaded miles
			</h4>
			<div className="space-y-4">
				<div>
					<Label htmlFor="edit-shipment-loaded-miles">Loaded miles</Label>
					<Input
						id="edit-shipment-loaded-miles"
						type="text"
						inputMode="numeric"
						value={editMilesInput}
						onChange={e => {
							setEditMilesInput(e.target.value);
							if (editMilesError) setEditMilesError(null);
						}}
						placeholder="Enter miles"
						className="dark:bg-gray-900"
						error={Boolean(editMilesError)}
						hint={editMilesError ?? undefined}
					/>
				</div>
				<Checkbox
					id="edit-shipment-loaded-miles-confirm"
					checked={editMilesConfirmed}
					onChange={setEditMilesConfirmed}
					label="I am sure I am entering the correct value"
				/>
				<div className="flex justify-end gap-3 pt-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => {
							setIsEditMilesModalOpen(false);
							setEditMilesError(null);
							setEditMilesConfirmed(false);
						}}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleChangeMiles}
						disabled={!editMilesConfirmed}
					>
						Change miles
					</Button>
				</div>
			</div>
		</Modal>
		</>
	);
}
