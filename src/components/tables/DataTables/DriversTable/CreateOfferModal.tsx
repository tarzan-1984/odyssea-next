"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import MultiSelect from "@/components/form/MultiSelect";
import offers from "@/app-api/offers";
import createOfferIcon from "@/icons/create_offer_icon.png";

const DND_EXTRA_ROW_TYPE = "CREATE_OFFER_EXTRA_ROW";

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

/** Additional rows (pickup or delivery) added in order between main rows */
type ExtraRow = { id: string; type: "pickup" | "delivery"; location: string; time: string };
const initialExtraRow = (type: "pickup" | "delivery"): ExtraRow => ({
	id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
	type,
	location: "",
	time: "",
});

const REQUIRED_FIELDS: (keyof typeof initialFormState)[] = [
	"pickUpLocation",
	"deliveryLocation",
	"pickUpTime",
	"deliveryTime",
	"weight",
];

/** Draggable wrapper for an extra row (used between main Pick up and Delivery rows) */
function DraggableExtraRow({
	row,
	index,
	updateExtraRow,
	removeExtraRow,
	moveRow,
}: {
	row: ExtraRow;
	index: number;
	updateExtraRow: (index: number, field: "location" | "time", value: string) => void;
	removeExtraRow: (index: number) => void;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);

	const [{ isDragging }, drag] = useDrag({
		type: DND_EXTRA_ROW_TYPE,
		item: () => ({ index }),
		collect: monitor => ({ isDragging: monitor.isDragging() }),
	});

	const [, drop] = useDrop({
		accept: DND_EXTRA_ROW_TYPE,
		hover: (item: { index: number }, monitor) => {
			if (!ref.current) return;
			const dragIndex = item.index;
			const hoverIndex = index;
			if (dragIndex === hoverIndex) return;
			const hoverBoundingRect = ref.current.getBoundingClientRect();
			const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
			const clientOffset = monitor.getClientOffset();
			if (!clientOffset) return;
			const hoverClientY = clientOffset.y - hoverBoundingRect.top;
			if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
			if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
			moveRow(dragIndex, hoverIndex);
			item.index = hoverIndex;
		},
	});

	drag(drop(ref));

	return (
		<div
			ref={ref}
			className={`grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end mt-2 cursor-move ${isDragging ? "opacity-50" : ""}`}
		>
			<div className="min-w-0">
				<Label>
					{row.type === "pickup" ? "Pick up location" : "Delivery location"}
				</Label>
				<Input
					type="text"
					value={row.location}
					onChange={e => updateExtraRow(index, "location", e.target.value)}
					placeholder={
						row.type === "pickup"
							? "Enter pick up location"
							: "Enter delivery location"
					}
					className="dark:bg-gray-900"
				/>
			</div>
			<div className="min-w-0">
				<Label>
					{row.type === "pickup" ? "Pick up time" : "Delivery time"}
				</Label>
				<Input
					type="text"
					value={row.time}
					onChange={e => updateExtraRow(index, "time", e.target.value)}
					placeholder={
						row.type === "pickup"
							? "Enter pick up time"
							: "Enter delivery time"
					}
					className="dark:bg-gray-900"
				/>
			</div>
			<div className="flex items-center self-end mt-1.5">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="!p-0 shrink-0 w-11 h-11 flex items-center justify-center min-w-0 text-lg"
					onClick={() => removeExtraRow(index)}
					aria-label={row.type === "pickup" ? "Remove pick up row" : "Remove delivery row"}
				>
					−
				</Button>
			</div>
		</div>
	);
}

export default function CreateOfferModal({
	isOpen,
	onClose,
	externalId,
	selectedDriverIds,
	onSubmit,
}: CreateOfferModalProps) {
	const [formValues, setFormValues] = useState(initialFormState);
	const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
	const [errors, setErrors] = useState<Partial<Record<keyof typeof initialFormState, string>>>(
		{}
	);
	const [submitError, setSubmitError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Reset form and errors when modal opens
	useEffect(() => {
		if (isOpen) {
			setFormValues({ ...initialFormState });
			setExtraRows([]);
			setErrors({});
			setSubmitError("");
		}
	}, [isOpen]);

	const addPickUpRow = () => {
		setExtraRows(prev => [...prev, initialExtraRow("pickup")]);
	};

	const addDeliveryRow = () => {
		setExtraRows(prev => [...prev, initialExtraRow("delivery")]);
	};

	const updateExtraRow = (index: number, field: "location" | "time", value: string) => {
		setExtraRows(prev => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	};

	const removeExtraRow = (index: number) => {
		setExtraRows(prev => prev.filter((_, i) => i !== index));
	};

	const moveExtraRow = (dragIndex: number, hoverIndex: number) => {
		setExtraRows(prev => {
			const next = [...prev];
			const [removed] = next.splice(dragIndex, 1);
			next.splice(hoverIndex, 0, removed);
			return next;
		});
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

				{/* Additional rows (in order) between main Pick up and main Delivery — draggable */}
				<DndProvider backend={HTML5Backend}>
					{extraRows.map((row, index) => (
						<DraggableExtraRow
							key={row.id}
							row={row}
							index={index}
							updateExtraRow={updateExtraRow}
							removeExtraRow={removeExtraRow}
							moveRow={moveExtraRow}
						/>
					))}
				</DndProvider>

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

				{/* Add Pick Up and Add Delivery — one row at the end of Pick up / Delivery fields */}
				<div className="flex justify-end gap-2 -mt-1 mt-2">
					<Button
						type="button"
						variant="primary"
						size="sm"
						className="!py-1.5 !px-3 text-xs"
						onClick={addPickUpRow}
					>
						Add Pick Up
					</Button>
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
