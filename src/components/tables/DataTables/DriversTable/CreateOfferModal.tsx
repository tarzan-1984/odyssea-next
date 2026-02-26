"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import MultiSelect from "@/components/form/MultiSelect";
import offers, { type CreateOfferRoutePoint } from "@/app-api/offers";
import createOfferIcon from "@/icons/create_offer_icon.png";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";

const DND_EXTRA_ROW_TYPE = "CREATE_OFFER_EXTRA_ROW";

export interface CreateOfferModalProps {
	isOpen: boolean;
	onClose: () => void;
	externalId: string;
	selectedDriverIds: string[];
	/** Map driverId -> empty_miles (rounded). Passed to backend for rate_offers. */
	driverEmptyMiles?: Record<string, number>;
	onSubmit?: (values: CreateOfferFormValues) => void;
}

export interface CreateOfferFormValues {
	externalId: string;
	driverIds: string;
	route: RouteRow[];
	weight: string;
	commodity: string;
	specialRequirements: string[];
	notes: string;
}

/** Single row in the route UI (pickup or delivery) */
type RouteRow = { id: string; type: "pickup" | "delivery"; location: string; time: string };

const initialFormState: Omit<CreateOfferFormValues, "externalId" | "driverIds" | "route"> = {
	weight: "",
	commodity: "",
	specialRequirements: [],
	notes: "",
};

/** Create a new empty route row */
const initialRouteRow = (type: "pickup" | "delivery"): RouteRow => ({
	id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
	type,
	location: "",
	time: "",
});

const REQUIRED_FIELDS: (keyof typeof initialFormState)[] = ["weight"];

/** ZIP pattern: 5 digits, optionally +4 */
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/** City, State format: "City, State" or "City, State (ZIP)" */
const CITY_STATE_PATTERN = /^[^,]+\s*,\s*[^,]+$/;

function isValidLocationFormat(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return true; // Empty is handled elsewhere
	const normalized = trimmed.replace(/\s/g, "");
	if (ZIP_PATTERN.test(normalized)) return true;
	return CITY_STATE_PATTERN.test(trimmed);
}

const LOCATION_FORMAT_ERROR = "Use format: City, State (e.g. Los Angeles, CA) or ZIP code";

/** Draggable wrapper for a route row (pickup or delivery) */
function DraggableExtraRow({
	row,
	index,
	updateExtraRow,
	removeExtraRow,
	moveRow,
	pendingDropRef,
	onAddressBlur,
	onLocationChange,
	locationError,
	canRemove = true,
	rowCount,
}: {
	row: RouteRow;
	index: number;
	updateExtraRow: (index: number, field: "location" | "time", value: string) => void;
	removeExtraRow: (index: number) => void;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
	pendingDropRef: React.MutableRefObject<number | null>;
	onAddressBlur?: (index: number, value: string, rowId: string) => void | Promise<void>;
	onLocationChange?: (rowId: string) => void;
	locationError?: string;
	/** When false, hide the remove button (e.g. only one row of this type remains) */
	canRemove?: boolean;
	rowCount: number;
}) {
	const ref = useRef<HTMLDivElement>(null);

	const [{ isDragging }, drag] = useDrag({
		type: DND_EXTRA_ROW_TYPE,
		item: () => ({ index, type: row.type }),
		collect: monitor => ({ isDragging: monitor.isDragging() }),
	});

	const [{ isOver, dragIndex }, drop] = useDrop({
		accept: DND_EXTRA_ROW_TYPE,
		collect: monitor => {
			const item = monitor.getItem() as { index: number; type?: "pickup" | "delivery" } | null;
			return {
				isOver: monitor.isOver(),
				dragIndex: item?.index ?? null,
			};
		},
		hover: (item: { index: number; type?: "pickup" | "delivery" }, monitor) => {
			if (!ref.current) return;
			const dragIndex = item.index;
			const hoverIndex = index;
			if (dragIndex === hoverIndex) return;
			// Prevent Delivery from being first, Pick up from being last
			const draggedType = item.type;
			if (draggedType === "delivery" && hoverIndex === 0) return;
			if (draggedType === "pickup" && hoverIndex === rowCount - 1) return;
			const hoverBoundingRect = ref.current.getBoundingClientRect();
			const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
			const clientOffset = monitor.getClientOffset();
			if (!clientOffset) return;
			const hoverClientY = clientOffset.y - hoverBoundingRect.top;
			if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
			if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
			// Store target index for drop; do NOT move array during drag
			pendingDropRef.current = hoverIndex;
		},
		drop: (item: { index: number; type?: "pickup" | "delivery" }) => {
			const dragIndex = item.index;
			const dropIndex = pendingDropRef.current ?? index;
			pendingDropRef.current = null;
			// Prevent invalid moves: Delivery first or Pick up last
			const draggedType = item.type;
			if (draggedType === "delivery" && dropIndex === 0) return;
			if (draggedType === "pickup" && dropIndex === rowCount - 1) return;
			if (dragIndex !== dropIndex) {
				moveRow(dragIndex, dropIndex);
			}
		},
	});

	drag(drop(ref));

	return (
		<div
			ref={ref}
			className="relative grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end mt-2 cursor-move"
			style={{
				opacity: isDragging ? 0 : 1,
				pointerEvents: isDragging ? "none" : undefined,
			}}
		>
			{/* Blue insertion line when hovering over this row */}
			{isOver && (
				<div
					className={`absolute left-0 right-0 h-1 bg-blue-500 rounded-full z-10 ${
						dragIndex != null && dragIndex < index ? "bottom-0 translate-y-1" : "-top-1"
					}`}
					aria-hidden
				/>
			)}
			<div className="min-w-0 relative">
				<Label>
					{row.type === "pickup" ? "Pick up location" : "Delivery location"}
				</Label>
				<Input
					type="text"
					value={row.location}
					onChange={e => {
						updateExtraRow(index, "location", e.target.value);
						onLocationChange?.(row.id);
					}}
					onBlur={() => onAddressBlur?.(index, row.location, row.id)}
					placeholder={
						row.type === "pickup"
							? "Enter pick up location"
							: "Enter delivery location"
					}
					className="dark:bg-gray-900"
					error={Boolean(locationError)}
				/>
				{locationError && (
					<p className="absolute left-0 top-full mt-1 text-xs text-red-500 dark:text-red-400 whitespace-nowrap">
						{locationError}
					</p>
				)}
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
			{canRemove && (
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
			)}
		</div>
	);
}

export default function CreateOfferModal({
	isOpen,
	onClose,
	externalId,
	selectedDriverIds,
	driverEmptyMiles = {},
	onSubmit,
}: CreateOfferModalProps) {
	const [formValues, setFormValues] = useState(initialFormState);
	const [routeRows, setRouteRows] = useState<RouteRow[]>([]);
	const [errors, setErrors] = useState<Partial<Record<keyof typeof initialFormState, string>>>(
		{}
	);
	const [routeError, setRouteError] = useState<string | null>(null);
	/** Location format errors keyed by row.id */
	const [routeRowLocationErrors, setRouteRowLocationErrors] = useState<Record<string, string>>(
		{}
	);
	const [submitError, setSubmitError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [loadedMiles, setLoadedMiles] = useState<number | null>(null);
	const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
	const [routeDistanceError, setRouteDistanceError] = useState<string | null>(null);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const routeRowsRef = useRef(routeRows);

	useEffect(() => {
		routeRowsRef.current = routeRows;
	}, [routeRows]);

	// Reset form and errors when modal opens
	useEffect(() => {
		if (isOpen) {
			setFormValues({ ...initialFormState });
			// Initialize route with one pickup and one delivery row
			setRouteRows([initialRouteRow("pickup"), initialRouteRow("delivery")]);
			setErrors({});
			setRouteError(null);
			setRouteRowLocationErrors({});
			setSubmitError("");
			setLoadedMiles(null);
			setRouteDistanceError(null);
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
		}
	}, [isOpen]);

	// Reset loaded miles when route structure changes (add/remove rows)
	useEffect(() => {
		setLoadedMiles(null);
		setRouteDistanceError(null);
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
	}, [routeRows.length]);

	const addPickUpRow = () => {
		setRouteRows(prev => [...prev, initialRouteRow("pickup")]);
	};

	const addDeliveryRow = () => {
		setRouteRows(prev => [...prev, initialRouteRow("delivery")]);
	};

	const updateExtraRow = (index: number, field: "location" | "time", value: string) => {
		setRouteRows(prev => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	};

	const removeExtraRow = (index: number) => {
		setRouteRows(prev => prev.filter((_, i) => i !== index));
	};

	// Ref to store target index during drag; move happens only on drop
	const pendingDropRef = useRef<number | null>(null);

	const runRouteDistanceCalculationWithLocations = useCallback(
		async (locations: string[]) => {
			if (locations.length < 2) {
				setLoadedMiles(null);
				setRouteDistanceError(null);
				return;
			}
			setRouteDistanceError(null);
			setIsCalculatingRoute(true);
			try {
				const { loadedMiles: miles } = await offers.calculateRouteDistance(locations);
				setLoadedMiles(miles);
			} catch (err) {
				setLoadedMiles(null);
				setRouteDistanceError(
					err instanceof Error ? err.message : "Could not calculate route distance"
				);
			} finally {
				setIsCalculatingRoute(false);
			}
		},
		[]
	);

	const scheduleRouteRecalculation = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}
		debounceTimerRef.current = setTimeout(() => {
			debounceTimerRef.current = null;
			const rows = routeRowsRef.current;
			const locations = rows.map(r => r.location.trim()).filter(Boolean);
			const allFilled = rows.every(r => r.location.trim() !== "");
			const allValidFormat = rows
				.filter(r => r.location.trim() !== "")
				.every(r => isValidLocationFormat(r.location.trim()));
			if (locations.length >= 2 && allFilled && allValidFormat) {
				runRouteDistanceCalculationWithLocations(locations);
			} else if (locations.length < 2 || !allValidFormat) {
				setLoadedMiles(null);
				setRouteDistanceError(null);
			}
		}, 1000);
	}, [runRouteDistanceCalculationWithLocations]);

	const handleAddressBlur = useCallback(
		async (index: number, value: string, rowId: string) => {
			const trimmed = value.trim();
			if (!trimmed) {
				setRouteRowLocationErrors(prev => {
					const next = { ...prev };
					delete next[rowId];
					return next;
				});
				return;
			}

			// Validate format: must be ZIP or "City, State"
			if (!isValidLocationFormat(trimmed)) {
				setRouteRowLocationErrors(prev => ({ ...prev, [rowId]: LOCATION_FORMAT_ERROR }));
				return;
			}

			setRouteRowLocationErrors(prev => {
				const next = { ...prev };
				delete next[rowId];
				return next;
			});

			// Geocode ZIP to "City, State (ZIP)" format
			if (ZIP_PATTERN.test(trimmed.replace(/\s/g, ""))) {
				try {
					const formatted = await offers.geocodeToFormattedAddress(trimmed);
					if (formatted && formatted !== trimmed) {
						setRouteRows(prev => {
							const next = [...prev];
							if (next[index]) {
								next[index] = { ...next[index], location: formatted };
							}
							return next;
						});
					}
				} catch {
					// Keep original value on error
				}
			}

			scheduleRouteRecalculation();
		},
		[scheduleRouteRecalculation]
	);

	const moveExtraRow = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			setRouteRows(prev => {
				const next = [...prev];
				const [removed] = next.splice(dragIndex, 1);
				next.splice(hoverIndex, 0, removed);
				return next;
			});
			scheduleRouteRecalculation();
		},
		[scheduleRouteRecalculation]
	);

	const validate = (): {
		fieldErrors: Partial<Record<keyof typeof initialFormState, string>>;
		routeError: string | null;
	} => {
		const fieldErrors: Partial<Record<keyof typeof initialFormState, string>> = {};
		for (const field of REQUIRED_FIELDS) {
			const value = formValues[field];
			const str = typeof value === "string" ? value.trim() : "";
			if (str === "") {
				fieldErrors[field] = "This field is required";
			}
		}

		let routeError: string | null = null;
		const trimmedRoute = routeRows.map(row => ({
			...row,
			location: row.location.trim(),
			time: row.time.trim(),
		}));

		const pickups = trimmedRoute.filter(
			row => row.type === "pickup" && row.location !== "" && row.time !== ""
		);
		const deliveries = trimmedRoute.filter(
			row => row.type === "delivery" && row.location !== "" && row.time !== ""
		);

		if (trimmedRoute.length === 0) {
			routeError = "Add at least one Pick up and one Delivery";
		} else if (pickups.length === 0 || deliveries.length === 0) {
			routeError = "At least one Pick up and one Delivery are required";
		} else {
			const incompleteRow = trimmedRoute.some(
				row =>
					(row.location === "" && row.time !== "") ||
					(row.location !== "" && row.time === "")
			);
			if (incompleteRow) {
				routeError = "Each stop must have both location and time";
			} else {
				const first = trimmedRoute[0];
				const last = trimmedRoute[trimmedRoute.length - 1];
				if (first.type !== "pickup") {
					routeError = "The first stop in route must be Pick up";
				} else if (last.type !== "delivery") {
					routeError = "The last stop in route must be Delivery";
				} else {
					// Validate location format for filled rows
					const invalidLocation = trimmedRoute.some(
						row => row.location !== "" && !isValidLocationFormat(row.location)
					);
					if (invalidLocation) {
						routeError = LOCATION_FORMAT_ERROR;
					}
				}
			}
		}

		return { fieldErrors, routeError };
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
		const { fieldErrors, routeError: nextRouteError } = validate();
		if (Object.keys(fieldErrors).length > 0 || nextRouteError) {
			setErrors(fieldErrors);
			setRouteError(nextRouteError);
			return;
		}
		setErrors({});
		setRouteError(null);
		setSubmitError("");
		setRouteDistanceError(null);

		// Ensure route distance is calculated before submit
		let milesToSend = loadedMiles;
		if (milesToSend == null && !isCalculatingRoute) {
			const locations = routeRows.map(r => r.location.trim()).filter(Boolean);
			if (locations.length >= 2) {
				setIsCalculatingRoute(true);
				try {
					const { loadedMiles: miles } = await offers.calculateRouteDistance(locations);
					milesToSend = miles;
					setLoadedMiles(miles);
				} catch (err) {
					setRouteDistanceError(
						err instanceof Error ? err.message : "Could not calculate route distance"
					);
					setIsCalculatingRoute(false);
					return;
				}
				setIsCalculatingRoute(false);
			}
		} else if (isCalculatingRoute) {
			setSubmitError("Please wait for route distance calculation to complete");
			return;
		}

		if (milesToSend == null) {
			setRouteDistanceError("Route distance could not be calculated");
			return;
		}

		setIsSubmitting(true);
		try {
			const routePayload: CreateOfferRoutePoint[] = routeRows.map(row => ({
				type: (row.type === "pickup"
					? "pick_up_location"
					: "delivery_location") as CreateOfferRoutePoint["type"],
				location: row.location.trim(),
				time: row.time.trim(),
			}));

			const payload = {
				externalId,
				driverIds: selectedDriverIds,
				route: routePayload,
				loadedMiles: Math.round(milesToSend),
				driverEmptyMiles:
					Object.keys(driverEmptyMiles).length > 0 ? driverEmptyMiles : undefined,
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
					route: routeRows,
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
			className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto p-6 sm:p-8 m-5 sm:m-0 rounded-3xl bg-white dark:bg-gray-900 shadow-sm"
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
					Create Offer
				</h4>

				{/* Hidden: externalId */}
				<input type="hidden" name="externalId" value={externalId} readOnly />

				{/* Hidden: selected driver IDs (comma-separated) */}
				<input type="hidden" name="driverIds" value={driverIdsValue} readOnly />

				{/* Route rows: first Pick up, then any intermediate points, last Delivery — all draggable */}
				<DndProvider backend={HTML5Backend}>
					{routeRows.map((row, index) => (
						<DraggableExtraRow
							key={row.id}
							row={row}
							index={index}
							updateExtraRow={updateExtraRow}
							removeExtraRow={removeExtraRow}
							moveRow={moveExtraRow}
							pendingDropRef={pendingDropRef}
							onAddressBlur={handleAddressBlur}
							onLocationChange={rowId =>
								setRouteRowLocationErrors(prev => {
									const next = { ...prev };
									delete next[rowId];
									return next;
								})
							}
							locationError={routeRowLocationErrors[row.id]}
							canRemove={
								(row.type === "pickup" &&
									routeRows.filter(r => r.type === "pickup").length > 1) ||
								(row.type === "delivery" &&
									routeRows.filter(r => r.type === "delivery").length > 1)
							}
							rowCount={routeRows.length}
						/>
					))}
				</DndProvider>

				{/* Loaded miles (left, 50%) and Add Pick Up / Add Delivery buttons (right) */}
				<div className="flex items-end gap-3 mt-2">
					<div className="relative w-1/2 min-w-0">
						<Label htmlFor="loaded-miles-field">Loaded miles</Label>
						<div className="relative">
							<Input
								id="loaded-miles-field"
								type="text"
								readOnly
								value={
									loadedMiles != null
										? Number.isFinite(loadedMiles)
											? String(Math.round(loadedMiles))
											: ""
										: ""
								}
								placeholder="Fill all addresses and blur to calculate"
								className="cursor-not-allowed"
							/>
							{isCalculatingRoute && (
								<div
									className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-900/80"
									aria-hidden
								>
									<SpinnerOne />
								</div>
							)}
						</div>
					</div>
					<div className="flex gap-2 w-1/2 min-w-0">
						<Button
							type="button"
							variant="primary"
							className="h-11 flex-1 !py-0"
							onClick={addPickUpRow}
						>
							Add Pick Up
						</Button>
						<Button
							type="button"
							variant="primary"
							className="h-11 flex-1 !py-0"
							onClick={addDeliveryRow}
						>
							Add Delivery
						</Button>
					</div>
				</div>

				{routeDistanceError && (
					<p className="text-sm text-red-500 dark:text-red-400">{routeDistanceError}</p>
				)}
				{routeError && (
					<p className="text-sm text-red-500 dark:text-red-400">{routeError}</p>
				)}

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
					<Button
						type="submit"
						size="sm"
						disabled={
							isSubmitting ||
							isCalculatingRoute ||
							loadedMiles == null ||
							loadedMiles === 0
						}
					>
						{isSubmitting ? "Creating…" : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
