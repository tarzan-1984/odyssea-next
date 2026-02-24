"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import MultiSelect from "@/components/form/MultiSelect";
import offers from "@/app-api/offers";
import createOfferIcon from "@/icons/create_offer_icon.png";

export interface CreateOfferModalProps {
	isOpen: boolean;
	onClose: () => void;
	externalId: string;
	selectedDriverIds: string[];
	onSubmit?: (values: CreateOfferFormValues) => void;
}

export interface CreateOfferFormValues {
	externalId: string;
	driverIds: string;
	pickUpLocation: string;
	deliveryLocation: string;
	pickUpTime: string;
	deliveryTime: string;
	weight: string;
	commodity: string;
	specialRequirements: string[];
	notes: string;
}

const initialFormState: Omit<CreateOfferFormValues, "externalId" | "driverIds"> = {
	pickUpLocation: "",
	deliveryLocation: "",
	pickUpTime: "",
	deliveryTime: "",
	weight: "",
	commodity: "",
	specialRequirements: [],
	notes: "",
};

/** Additional pick-up rows (location + time) added via "Add Pick Up" */
type PickUpRow = { location: string; time: string };
const initialPickUpRow = (): PickUpRow => ({ location: "", time: "" });

/** Additional delivery rows (location + time) added via "Add Delivery" */
type DeliveryRow = { location: string; time: string };
const initialDeliveryRow = (): DeliveryRow => ({ location: "", time: "" });

const REQUIRED_FIELDS: (keyof typeof initialFormState)[] = [
	"pickUpLocation",
	"deliveryLocation",
	"pickUpTime",
	"deliveryTime",
	"weight",
];

export default function CreateOfferModal({
	isOpen,
	onClose,
	externalId,
	selectedDriverIds,
	onSubmit,
}: CreateOfferModalProps) {
	const [formValues, setFormValues] = useState(initialFormState);
	const [extraPickUps, setExtraPickUps] = useState<PickUpRow[]>([]);
	const [extraDeliveries, setExtraDeliveries] = useState<DeliveryRow[]>([]);
	const [errors, setErrors] = useState<Partial<Record<keyof typeof initialFormState, string>>>(
		{}
	);
	const [submitError, setSubmitError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Reset form and errors when modal opens
	useEffect(() => {
		if (isOpen) {
			setFormValues({ ...initialFormState });
			setExtraPickUps([]);
			setExtraDeliveries([]);
			setErrors({});
			setSubmitError("");
		}
	}, [isOpen]);

	const addPickUpRow = () => {
		setExtraPickUps(prev => [...prev, initialPickUpRow()]);
	};

	const updateExtraPickUp = (index: number, field: "location" | "time", value: string) => {
		setExtraPickUps(prev => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	};

	const removeExtraPickUp = (index: number) => {
		setExtraPickUps(prev => prev.filter((_, i) => i !== index));
	};

	const addDeliveryRow = () => {
		setExtraDeliveries(prev => [...prev, initialDeliveryRow()]);
	};

	const updateExtraDelivery = (index: number, field: "location" | "time", value: string) => {
		setExtraDeliveries(prev => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	};

	const removeExtraDelivery = (index: number) => {
		setExtraDeliveries(prev => prev.filter((_, i) => i !== index));
	};

	const validate = (): Partial<Record<keyof typeof initialFormState, string>> => {
		const next: Partial<Record<keyof typeof initialFormState, string>> = {};
		for (const field of REQUIRED_FIELDS) {
			const value = formValues[field];
			const str = typeof value === "string" ? value.trim() : "";
			if (str === "") {
				next[field] = "This field is required";
			}
		}
		return next;
	};

	const driverIdsValue = selectedDriverIds.join(",");

	const handleChange = (field: keyof typeof formValues, value: string | string[]) => {
		setFormValues(prev => ({ ...prev, [field]: value }));
		if (errors[field]) {
			setErrors(prev => ({ ...prev, [field]: undefined }));
		}
	};

	const parseWeight = (v: string): number | undefined => {
		const n = parseFloat(String(v).replace(/,/g, "").trim());
		return Number.isNaN(n) ? undefined : n;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const validationErrors = validate();
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			return;
		}
		setErrors({});
		setSubmitError("");
		setIsSubmitting(true);
		try {
			const payload = {
				externalId,
				driverIds: selectedDriverIds,
				pickUpLocation: formValues.pickUpLocation.trim(),
				pickUpTime: formValues.pickUpTime.trim(),
				deliveryLocation: formValues.deliveryLocation.trim(),
				deliveryTime: formValues.deliveryTime.trim(),
				weight: parseWeight(formValues.weight),
				commodity: formValues.commodity.trim() || undefined,
				specialRequirements:
					formValues.specialRequirements.length > 0
						? formValues.specialRequirements
						: undefined,
				notes: formValues.notes.trim() || undefined,
			};
			const result = await offers.createOffer(payload);
			if (result.success) {
				onSubmit?.({
					externalId,
					driverIds: driverIdsValue,
					...formValues,
				});
				onClose();
			} else {
				setSubmitError(result.error ?? "Failed to create offer");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto p-6 sm:p-8 m-5 sm:m-0 rounded-3xl bg-white dark:bg-gray-900 shadow-sm"
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
					Create Offer
				</h4>

				{/* Hidden: externalId */}
				<input type="hidden" name="externalId" value={externalId} readOnly />

				{/* Hidden: selected driver IDs (comma-separated) */}
				<input type="hidden" name="driverIds" value={driverIdsValue} readOnly />

				{/* Row 1: Pick up location, Pick up time + Add Pick Up button below right */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="min-w-0">
						<Label>Pick up location</Label>
						<Input
							type="text"
							value={formValues.pickUpLocation}
							onChange={e => handleChange("pickUpLocation", e.target.value)}
							placeholder="Enter pick up location"
							className="dark:bg-gray-900"
							error={!!errors.pickUpLocation}
							hint={errors.pickUpLocation}
						/>
					</div>
					<div className="min-w-0">
						<Label>Pick up time</Label>
						<Input
							type="text"
							value={formValues.pickUpTime}
							onChange={e => handleChange("pickUpTime", e.target.value)}
							placeholder="Enter pick up time"
							className="dark:bg-gray-900"
							error={!!errors.pickUpTime}
							hint={errors.pickUpTime}
						/>
					</div>
				</div>

				{/* Additional Pick up rows (added via Add Pick Up) — above the button */}
				{extraPickUps.map((row, index) => (
					<div
						key={index}
						className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end mt-2"
					>
						<div className="min-w-0">
							<Label>Pick up location</Label>
							<Input
								type="text"
								value={row.location}
								onChange={e => updateExtraPickUp(index, "location", e.target.value)}
								placeholder="Enter pick up location"
								className="dark:bg-gray-900"
							/>
						</div>
						<div className="min-w-0">
							<Label>Pick up time</Label>
							<Input
								type="text"
								value={row.time}
								onChange={e => updateExtraPickUp(index, "time", e.target.value)}
								placeholder="Enter pick up time"
								className="dark:bg-gray-900"
							/>
						</div>
						<div className="flex items-center self-end mt-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="!p-0 shrink-0 w-11 h-11 flex items-center justify-center min-w-0 text-lg"
								onClick={() => removeExtraPickUp(index)}
								aria-label="Remove pick up row"
							>
								−
							</Button>
						</div>
					</div>
				))}

				<div className="flex justify-end -mt-1">
					<Button
						type="button"
						variant="primary"
						size="sm"
						className="!py-1.5 !px-3 text-xs"
						onClick={addPickUpRow}
					>
						Add Pick Up
					</Button>
				</div>

				{/* Row 2: Delivery location, Delivery time */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
					<div className="min-w-0">
						<Label>Delivery location</Label>
						<Input
							type="text"
							value={formValues.deliveryLocation}
							onChange={e => handleChange("deliveryLocation", e.target.value)}
							placeholder="Enter delivery location"
							className="dark:bg-gray-900"
							error={!!errors.deliveryLocation}
							hint={errors.deliveryLocation}
						/>
					</div>
					<div className="min-w-0">
						<Label>Delivery time</Label>
						<Input
							type="text"
							value={formValues.deliveryTime}
							onChange={e => handleChange("deliveryTime", e.target.value)}
							placeholder="Enter delivery time"
							className="dark:bg-gray-900"
							error={!!errors.deliveryTime}
							hint={errors.deliveryTime}
						/>
					</div>
				</div>

				{/* Additional Delivery rows (added via Add Delivery) — above the button */}
				{extraDeliveries.map((row, index) => (
					<div
						key={index}
						className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end mt-2"
					>
						<div className="min-w-0">
							<Label>Delivery location</Label>
							<Input
								type="text"
								value={row.location}
								onChange={e =>
									updateExtraDelivery(index, "location", e.target.value)
								}
								placeholder="Enter delivery location"
								className="dark:bg-gray-900"
							/>
						</div>
						<div className="min-w-0">
							<Label>Delivery time</Label>
							<Input
								type="text"
								value={row.time}
								onChange={e => updateExtraDelivery(index, "time", e.target.value)}
								placeholder="Enter delivery time"
								className="dark:bg-gray-900"
							/>
						</div>
						<div className="flex items-center self-end mt-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="!p-0 shrink-0 w-11 h-11 flex items-center justify-center min-w-0 text-lg"
								onClick={() => removeExtraDelivery(index)}
								aria-label="Remove delivery row"
							>
								−
							</Button>
						</div>
					</div>
				))}

				<div className="flex justify-end -mt-1 mt-2">
					<Button
						type="button"
						variant="primary"
						size="sm"
						className="!py-1.5 !px-3 text-xs"
						onClick={addDeliveryRow}
					>
						Add Delivery
					</Button>
				</div>

				{/* Row 4: Weight, Commodity */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<Label>Weight</Label>
						<Input
							type="text"
							value={formValues.weight}
							onChange={e => handleChange("weight", e.target.value)}
							placeholder="e.g. 1,000 lbs"
							className="dark:bg-gray-900"
							error={!!errors.weight}
							hint={errors.weight}
						/>
					</div>
					<div>
						<Label>Commodity</Label>
						<Input
							type="text"
							value={formValues.commodity}
							onChange={e => handleChange("commodity", e.target.value)}
							placeholder="Enter commodity"
							className="dark:bg-gray-900"
						/>
					</div>
				</div>

				{/* Row 5: Special requirements (full width) */}
				<div className="w-full">
					<div className="flex flex-col gap-1">
						<MultiSelect
							label="Special requirements"
							options={[
								{ value: "hazmat", text: "Hazmat", selected: false },
								{ value: "tanker-end", text: "Tanker End.", selected: false },
								{ value: "driver-assist", text: "Driver assist", selected: false },
								{ value: "liftgate", text: "Liftgate", selected: false },
								{ value: "pallet-jack", text: "Pallet Jack", selected: false },
								{ value: "dock-high", text: "Dock High", selected: false },
								{ value: "true-team", text: "True team", selected: false },
								{ value: "fake-team", text: "Fake team", selected: false },
								{ value: "tsa", text: "TSA", selected: false },
								{ value: "twic", text: "TWIC", selected: false },
								{ value: "airport", text: "Airport", selected: false },
								{ value: "round-trip", text: "Round trip", selected: false },
								{ value: "alcohol", text: "Alcohol", selected: false },
								{
									value: "temperature-control",
									text: "Temperature control",
									selected: false,
								},
								{ value: "ace", text: "ACE", selected: false },
								{ value: "aci", text: "ACI", selected: false },
								{ value: "mexico", text: "Mexico", selected: false },
								{ value: "military-base", text: "Military base", selected: false },
								{
									value: "blind-shipment",
									text: "Blind shipment",
									selected: false,
								},
								{ value: "partial", text: "Partial", selected: false },
								{
									value: "white-glove-service",
									text: "White glove service",
									selected: false,
								},
								{
									value: "high-value-freight",
									text: "High value freight",
									selected: false,
								},
								{ value: "fragile", text: "Fragile", selected: false },
								{ value: "hemp-product", text: "Hemp product", selected: false },
							]}
							defaultSelected={formValues.specialRequirements}
							onChange={values => handleChange("specialRequirements", values)}
							triggerClassName="min-h-11 py-2"
						/>
					</div>
				</div>

				{/* Notes */}
				<div className="w-full">
					<Label>Notes</Label>
					<TextArea
						rows={2}
						value={formValues.notes}
						onChange={v => handleChange("notes", v)}
						placeholder="Enter notes"
						className="w-full dark:bg-gray-900"
					/>
				</div>

				{submitError && (
					<p className="text-sm text-red-500 dark:text-red-400">{submitError}</p>
				)}
				<div className="relative flex items-center justify-end gap-3 pt-4">
					{isSubmitting && (
						<div className="animate-create-offer-drive absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
							<Image
								src={createOfferIcon}
								alt=""
								width={127}
								height={99}
								className="object-contain"
							/>
						</div>
					)}
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" size="sm" disabled={isSubmitting}>
						{isSubmitting ? "Creating…" : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
