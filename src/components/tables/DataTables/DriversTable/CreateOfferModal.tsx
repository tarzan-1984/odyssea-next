"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import MultiSelect from "@/components/form/MultiSelect";

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
	loadedMiles: string;
	emptyMiles: string;
	totalMiles: string;
	weight: string;
	commodity: string;
	specialRequirements: string[];
}

const initialFormState: Omit<CreateOfferFormValues, "externalId" | "driverIds"> = {
	pickUpLocation: "",
	deliveryLocation: "",
	pickUpTime: "",
	deliveryTime: "",
	loadedMiles: "",
	emptyMiles: "",
	totalMiles: "",
	weight: "",
	commodity: "",
	specialRequirements: [],
};

export default function CreateOfferModal({
	isOpen,
	onClose,
	externalId,
	selectedDriverIds,
	onSubmit,
}: CreateOfferModalProps) {
	const [formValues, setFormValues] = useState(initialFormState);

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setFormValues({ ...initialFormState });
		}
	}, [isOpen]);

	const driverIdsValue = selectedDriverIds.join(",");

	const parseMiles = (v: string): number => {
		const n = parseFloat(String(v).trim());
		return Number.isNaN(n) ? 0 : n;
	};

	const handleChange = (field: keyof typeof formValues, value: string | string[]) => {
		setFormValues(prev => {
			const next = { ...prev, [field]: value };
			if (field === "loadedMiles" || field === "emptyMiles") {
				const loaded = field === "loadedMiles" ? parseMiles(value as string) : parseMiles(prev.loadedMiles);
				const empty = field === "emptyMiles" ? parseMiles(value as string) : parseMiles(prev.emptyMiles);
				next.totalMiles = String(loaded + empty);
			}
			return next;
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit?.({
			externalId,
			driverIds: driverIdsValue,
			...formValues,
		});
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative w-full max-w-2xl p-6 sm:p-8 m-5 sm:m-0 rounded-3xl bg-white dark:bg-gray-900 shadow-sm"
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
					Create Offer
				</h4>

				{/* Hidden: externalId */}
				<input type="hidden" name="externalId" value={externalId} readOnly />

				{/* Hidden: selected driver IDs (comma-separated) */}
				<input type="hidden" name="driverIds" value={driverIdsValue} readOnly />

				{/* Row 1: Pick up location, Delivery location */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<Label>Pick up location</Label>
						<Input
							type="text"
							value={formValues.pickUpLocation}
							onChange={e => handleChange("pickUpLocation", e.target.value)}
							placeholder="Enter pick up location"
							className="dark:bg-gray-900"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label>Delivery location</Label>
						<Input
							type="text"
							value={formValues.deliveryLocation}
							onChange={e => handleChange("deliveryLocation", e.target.value)}
							placeholder="Enter delivery location"
							className="dark:bg-gray-900"
						/>
					</div>
				</div>

				{/* Row 2: Pick up time, Delivery time */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<Label>Pick up time</Label>
						<Input
							type="text"
							value={formValues.pickUpTime}
							onChange={e => handleChange("pickUpTime", e.target.value)}
							placeholder="Enter pick up time"
							className="dark:bg-gray-900"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label>Delivery time</Label>
						<Input
							type="text"
							value={formValues.deliveryTime}
							onChange={e => handleChange("deliveryTime", e.target.value)}
							placeholder="Enter delivery time"
							className="dark:bg-gray-900"
						/>
					</div>
				</div>

				{/* Row 3: Loaded miles, Empty miles, Total miles */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="flex flex-col gap-1">
						<Label>Loaded miles</Label>
						<Input
							type="number"
							value={formValues.loadedMiles}
							onChange={e => handleChange("loadedMiles", e.target.value)}
							placeholder="0"
							className="dark:bg-gray-900"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label>Empty miles</Label>
						<Input
							type="number"
							value={formValues.emptyMiles}
							onChange={e => handleChange("emptyMiles", e.target.value)}
							placeholder="0"
							className="dark:bg-gray-900"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label>Total miles</Label>
						<Input
							type="number"
							value={formValues.totalMiles}
							disabled
							placeholder="0"
							className="dark:bg-gray-900"
						/>
					</div>
				</div>

				{/* Row 4: Weight, Special requirements */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<Label>Weight</Label>
						<Input
							type="text"
							value={formValues.weight}
							onChange={e => handleChange("weight", e.target.value)}
							placeholder="e.g. 1,000 lbs"
							className="dark:bg-gray-900"
						/>
					</div>
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
								{ value: "blind-shipment", text: "Blind shipment", selected: false },
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
							triggerClassName="h-11"
						/>
					</div>
				</div>

				{/* Row 5: Commodity (full width) */}
				<div className="flex flex-col gap-1">
					<Label>Commodity</Label>
					<TextArea
						rows={3}
						value={formValues.commodity}
						onChange={v => handleChange("commodity", v)}
						placeholder="Enter commodity"
						className="dark:bg-gray-900"
					/>
				</div>

				<div className="flex items-center justify-end gap-3 pt-4">
					<Button type="button" size="sm" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" size="sm">
						Create
					</Button>
				</div>
			</form>
		</Modal>
	);
}
