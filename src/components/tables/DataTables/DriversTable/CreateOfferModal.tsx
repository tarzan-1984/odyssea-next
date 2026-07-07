"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import DateTimePicker from "@/components/form/DateTimePicker";
import TextArea from "@/components/form/input/TextArea";
import Checkbox from "@/components/form/input/Checkbox";
import MultiSelect from "@/components/form/MultiSelect";
import offers, { type CreateOfferRoutePoint } from "@/app-api/offers";
import { DragHandleIcon, AddPlusCircleIcon, RemoveMinusIcon, EditLoadedMilesIcon } from "@/icons";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { getRouteChronologyError } from "@/utils/offerDateTimeRange";
import {
	isValidLocationFormat,
	LOCATION_FORMAT_ERROR,
	normalizeLocationForGeocode,
	needsLocationGeocode,
} from "@/utils/offerLocationFormat";

const DND_EXTRA_ROW_TYPE = "CREATE_OFFER_EXTRA_ROW";

export interface EditOfferData {
	offerId: number;
	externalId: string;
	selectedDriverIds: string[];
	driverEmptyMiles?: Record<string, number>;
	offeredRate: string;
	weight: string;
	commodity: string;
	specialRequirements: string[];
	notes: string;
	route: Array<{
		type: "pick_up_location" | "delivery_location";
		location: string;
		time: string;
		latitude?: number;
		longitude?: number;
	}>;
	loadedMiles?: number | null;
}

export interface CreateOfferModalProps {
	isOpen: boolean;
	onClose: () => void;
	externalId: string;
	selectedDriverIds: string[];
	/** Map driverId -> empty_miles (rounded). Passed to backend for rate_offers. */
	driverEmptyMiles?: Record<string, number>;
	onSubmit?: (values: CreateOfferFormValues) => void;
	/** When set, modal opens in edit mode with pre-filled values. */
	editData?: EditOfferData | null;
}

export interface CreateOfferFormValues {
	externalId: string;
	driverIds: string;
	route: RouteRow[];
	offeredRate: string;
	weight: string;
	commodity: string;
	specialRequirements: string[];
	notes: string;
}

/** Single row in the route UI (pickup or delivery) */
type RouteRow = {
	id: string;
	type: "pickup" | "delivery";
	location: string;
	time: string;
	/** "latitude,longitude" — filled on location blur via geocoding */
	coordinates: string;
};

const initialFormState: Omit<CreateOfferFormValues, "externalId" | "driverIds" | "route"> = {
	offeredRate: "",
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
	coordinates: "",
});

function routePointToRow(
	point: EditOfferData["route"][number],
	index: number
): RouteRow {
	return {
		id: `row-edit-${index}-${Math.random().toString(36).slice(2, 9)}`,
		type: point.type === "pick_up_location" ? "pickup" : "delivery",
		location: point.location ?? "",
		time: point.time ?? "",
		coordinates:
			point.latitude != null &&
			point.longitude != null &&
			!Number.isNaN(point.latitude) &&
			!Number.isNaN(point.longitude)
				? `${point.latitude},${point.longitude}`
				: "",
	};
}

const REQUIRED_FIELDS: (keyof typeof initialFormState)[] = ["weight"];

type EditComparableSnapshot = {
	externalId: string;
	driverIds: string[];
	offeredRate: string;
	weight: string;
	commodity: string;
	specialRequirements: string[];
	notes: string;
	route: Array<{
		type: "pick_up_location" | "delivery_location";
		location: string;
		time: string;
		coordinates: string;
	}>;
};

function normalizeComparableString(value: string): string {
	return value.trim();
}

function normalizeComparableStringArray(values: string[]): string[] {
	return [...values].map(v => v.trim()).filter(Boolean).sort();
}

function coordinatesFromRoutePoint(point: {
	latitude?: number;
	longitude?: number;
}): string {
	if (
		point.latitude != null &&
		point.longitude != null &&
		!Number.isNaN(point.latitude) &&
		!Number.isNaN(point.longitude)
	) {
		return `${point.latitude},${point.longitude}`;
	}
	return "";
}

function snapshotFromEditData(data: EditOfferData): EditComparableSnapshot {
	return {
		externalId: normalizeComparableString(data.externalId),
		driverIds: normalizeComparableStringArray(data.selectedDriverIds),
		offeredRate: normalizeComparableString(data.offeredRate),
		weight: normalizeComparableString(data.weight),
		commodity: normalizeComparableString(data.commodity),
		specialRequirements: normalizeComparableStringArray(data.specialRequirements),
		notes: normalizeComparableString(data.notes),
		route: data.route.map(point => ({
			type: point.type,
			location: normalizeComparableString(point.location),
			time: normalizeComparableString(point.time),
			coordinates: coordinatesFromRoutePoint(point),
		})),
	};
}

function snapshotFromCurrentState(
	externalId: string,
	driverIds: string[],
	formValues: Omit<CreateOfferFormValues, "externalId" | "driverIds" | "route">,
	routeRows: RouteRow[]
): EditComparableSnapshot {
	return {
		externalId: normalizeComparableString(externalId),
		driverIds: normalizeComparableStringArray(driverIds),
		offeredRate: normalizeComparableString(formValues.offeredRate),
		weight: normalizeComparableString(formValues.weight),
		commodity: normalizeComparableString(formValues.commodity),
		specialRequirements: normalizeComparableStringArray(formValues.specialRequirements),
		notes: normalizeComparableString(formValues.notes),
		route: routeRows.map(row => ({
			type: row.type === "pickup" ? "pick_up_location" : "delivery_location",
			location: normalizeComparableString(row.location),
			time: normalizeComparableString(row.time),
			coordinates: normalizeComparableString(row.coordinates),
		})),
	};
}

function editSnapshotsEqual(a: EditComparableSnapshot, b: EditComparableSnapshot): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function parseRouteCoordinates(
	coordinates: string
): { latitude: number; longitude: number } | null {
	const trimmed = coordinates.trim();
	if (!trimmed) return null;

	const [latStr, lngStr] = trimmed.split(",");
	const latitude = Number.parseFloat(latStr?.trim() ?? "");
	const longitude = Number.parseFloat(lngStr?.trim() ?? "");
	if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

	return { latitude, longitude };
}

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
	onTimeBlur,
	locationError,
	canRemove = true,
	rowCount,
	onAddRow,
}: {
	row: RouteRow;
	index: number;
	updateExtraRow: (index: number, field: "location" | "time" | "coordinates", value: string) => void;
	removeExtraRow: (index: number) => void;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
	pendingDropRef: React.MutableRefObject<number | null>;
	onAddressBlur?: (index: number, value: string, rowId: string) => void | Promise<void>;
	onLocationChange?: (rowId: string) => void;
	onTimeBlur?: () => void;
	locationError?: string;
	/** When false, hide the remove button (e.g. only one row of this type remains) */
	canRemove?: boolean;
	rowCount: number;
	onAddRow?: (afterIndex: number) => void;
}) {
	const rowRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLDivElement>(null);

	const [{ isDragging }, drag, dragPreview] = useDrag({
		type: DND_EXTRA_ROW_TYPE,
		item: () => ({ index, type: row.type }),
		collect: monitor => ({ isDragging: monitor.isDragging() }),
	});

	const [{ isOver, dragIndex }, drop] = useDrop({
		accept: DND_EXTRA_ROW_TYPE,
		collect: monitor => {
			const item = monitor.getItem() as {
				index: number;
				type?: "pickup" | "delivery";
			} | null;
			return {
				isOver: monitor.isOver(),
				dragIndex: item?.index ?? null,
			};
		},
		hover: (item: { index: number; type?: "pickup" | "delivery" }, monitor) => {
			if (!rowRef.current) return;
			const dragIndex = item.index;
			const hoverIndex = index;
			if (dragIndex === hoverIndex) return;
			// Prevent Delivery from being first, Pick up from being last
			const draggedType = item.type;
			if (draggedType === "delivery" && hoverIndex === 0) return;
			if (draggedType === "pickup" && hoverIndex === rowCount - 1) return;
			const hoverBoundingRect = rowRef.current.getBoundingClientRect();
			const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
			const clientOffset = monitor.getClientOffset();
			if (!clientOffset) return;
			const hoverClientY = clientOffset.y - hoverBoundingRect.top;
			if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
			if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
			pendingDropRef.current = hoverIndex;
		},
		drop: (item: { index: number; type?: "pickup" | "delivery" }) => {
			const dragIndex = item.index;
			const dropIndex = pendingDropRef.current ?? index;
			pendingDropRef.current = null;
			const draggedType = item.type;
			if (draggedType === "delivery" && dropIndex === 0) return;
			if (draggedType === "pickup" && dropIndex === rowCount - 1) return;
			if (dragIndex !== dropIndex) {
				moveRow(dragIndex, dropIndex);
			}
		},
	});

	// Drop target is the whole row; drag source is the handle (only when reorder is available);
	// dragPreview on rowRef so the whole row appears as ghost during drag
	drop(rowRef);
	if (rowCount > 2) {
		drag(handleRef);
		dragPreview(rowRef);
	}

	return (
		<div
			ref={rowRef}
			className="relative flex flex-col sm:flex-row sm:items-end gap-4 mt-2"
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

			{/* Drag handle — only shown when there are more than 2 rows */}
			{rowCount > 2 && (
				<div
					ref={handleRef}
					className="hidden sm:flex items-center justify-center self-end w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:border-gray-500 transition-colors shrink-0"
					aria-label="Drag to reorder"
				>
					<DragHandleIcon />
				</div>
			)}

			{/* Add stop — icon is the button */}
			{onAddRow && (
				<button
					type="button"
					className="shrink-0 self-end p-0 border-0 bg-transparent cursor-pointer text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors"
					onClick={() => onAddRow(index)}
					aria-label={
						row.type === "pickup" ? "Add pick up stop" : "Add delivery stop"
					}
				>
					<AddPlusCircleIcon className="h-11 w-11" />
				</button>
			)}

			{/* Location field */}
			<div className="flex-1 min-w-0 relative">
				<Label>{row.type === "pickup" ? "Pick up location" : "Delivery location"}</Label>
				<input
					type="hidden"
					name={`route-${row.id}-coordinates`}
					value={row.coordinates}
					readOnly
				/>
				<Input
					type="text"
					value={row.location}
					onChange={e => {
						updateExtraRow(index, "location", e.target.value);
						onLocationChange?.(row.id);
					}}
					onBlur={() => onAddressBlur?.(index, row.location, row.id)}
					placeholder={
						row.type === "pickup" ? "Enter pick up location" : "Enter delivery location"
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

			{/* Time field + remove button grouped together */}
			<div className="flex items-end gap-2 shrink-0">
				<div className="w-full shrink-0 sm:w-[calc(16rem+10px)]">
					<DateTimePicker
						id={`datetime-${row.id}`}
						allowTimeRange
						label={
							row.type === "pickup" ? "Pick up date & time" : "Delivery date & time"
						}
						value={row.time}
						onChange={v => updateExtraRow(index, "time", v)}
						onBlur={onTimeBlur}
						className="dark:bg-gray-900"
					/>
				</div>

				{canRemove && (
					<button
						type="button"
						className="shrink-0 p-0 border-0 bg-transparent cursor-pointer text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
						onClick={() => removeExtraRow(index)}
						aria-label={
							row.type === "pickup" ? "Remove pick up row" : "Remove delivery row"
						}
					>
						<RemoveMinusIcon className="h-11 w-11" />
					</button>
				)}
			</div>
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
	editData = null,
}: CreateOfferModalProps) {
	const isEditMode = Boolean(editData);
	const effectiveExternalId = editData?.externalId ?? externalId;
	const effectiveDriverIds = editData?.selectedDriverIds ?? selectedDriverIds;
	const effectiveDriverEmptyMiles = editData?.driverEmptyMiles ?? driverEmptyMiles;

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
	const [editFallbackLoadedMiles, setEditFallbackLoadedMiles] = useState<number | null>(null);
	const [manualLoadedMiles, setManualLoadedMiles] = useState<number | null>(null);
	const [isEditMilesModalOpen, setIsEditMilesModalOpen] = useState(false);
	const [editMilesInput, setEditMilesInput] = useState("");
	const [editMilesError, setEditMilesError] = useState<string | null>(null);
	const [editMilesConfirmed, setEditMilesConfirmed] = useState(false);
	const [initialEditSnapshot, setInitialEditSnapshot] = useState<EditComparableSnapshot | null>(
		null
	);

	/**
	 * committedLocations is updated ONLY on blur (after user leaves a field).
	 * This is used as the queryKey for useQuery so the request fires
	 * only when locations actually changed, not on every focus/blur.
	 */
	const [committedLocations, setCommittedLocations] = useState<string[]>([]);

	// Reset form and errors when modal opens
	useEffect(() => {
		if (!isOpen) return;

		if (editData) {
			setInitialEditSnapshot(snapshotFromEditData(editData));
			setFormValues({
				offeredRate: editData.offeredRate,
				weight: editData.weight,
				commodity: editData.commodity,
				specialRequirements: editData.specialRequirements,
				notes: editData.notes,
			});
			const rows =
				editData.route.length > 0
					? editData.route.map(routePointToRow)
					: [initialRouteRow("pickup"), initialRouteRow("delivery")];
			setRouteRows(rows);
			setEditFallbackLoadedMiles(editData.loadedMiles ?? null);
			setManualLoadedMiles(null);
			const locs = rows
				.map(r => r.location.trim())
				.filter(l => l !== "" && isValidLocationFormat(l));
			setCommittedLocations(
				locs.length === rows.length && rows.length >= 2 ? locs : []
			);
		} else {
			setInitialEditSnapshot(null);
			setFormValues({ ...initialFormState });
			setRouteRows([initialRouteRow("pickup"), initialRouteRow("delivery")]);
			setEditFallbackLoadedMiles(null);
			setManualLoadedMiles(null);
			setCommittedLocations([]);
		}

		setErrors({});
		setRouteError(null);
		setRouteRowLocationErrors({});
		setSubmitError("");
		setIsEditMilesModalOpen(false);
		setEditMilesInput("");
		setEditMilesError(null);
		setEditMilesConfirmed(false);
	}, [isOpen, editData?.offerId]);

	const hasEditChanges = useMemo(() => {
		if (!isEditMode || !initialEditSnapshot) return false;
		const currentSnapshot = snapshotFromCurrentState(
			effectiveExternalId,
			effectiveDriverIds,
			formValues,
			routeRows
		);
		return !editSnapshotsEqual(initialEditSnapshot, currentSnapshot);
	}, [
		isEditMode,
		initialEditSnapshot,
		effectiveExternalId,
		effectiveDriverIds,
		formValues,
		routeRows,
	]);

	const allLocationsFilledAndValid = (locs: string[]) =>
		locs.length >= 2 && locs.every(l => l.trim() !== "" && isValidLocationFormat(l.trim()));

	const {
		data: routeDistanceData,
		isFetching: isCalculatingRoute,
		error: routeDistanceQueryError,
	} = useQuery({
		queryKey: ["route-distance", committedLocations],
		queryFn: () => offers.calculateRouteDistance(committedLocations),
		enabled: allLocationsFilledAndValid(committedLocations),
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
		allLocationsFilledAndValid(committedLocations) &&
		(routeDistanceData?.loadedMiles != null ||
			routeDistanceQueryError != null ||
			manualLoadedMiles != null ||
			editFallbackLoadedMiles != null);

	const addPickUpRow = (afterIndex: number) => {
		setCommittedLocations([]);
		setManualLoadedMiles(null);
		setRouteRows(prev => {
			const next = [...prev];
			next.splice(afterIndex + 1, 0, initialRouteRow("pickup"));
			return next;
		});
	};

	const addDeliveryRow = (afterIndex: number) => {
		setCommittedLocations([]);
		setManualLoadedMiles(null);
		setRouteRows(prev => {
			const next = [...prev];
			next.splice(afterIndex + 1, 0, initialRouteRow("delivery"));
			return next;
		});
	};

	const validateRouteChronology = useCallback((rows: RouteRow[]) => {
		setRouteError(getRouteChronologyError(rows.map(row => row.time)));
	}, []);

	const updateExtraRow = useCallback(
		(index: number, field: "location" | "time" | "coordinates", value: string) => {
			setRouteRows(prev => {
				const next = [...prev];
				next[index] = { ...next[index], [field]: value };
				if (field === "time") {
					validateRouteChronology(next);
				}
				return next;
			});
		},
		[validateRouteChronology]
	);

	const commitLocations = useCallback((rows: RouteRow[]) => {
		// Only commit if ALL rows have a filled, valid location — so adding a new empty
		// row does not trigger a distance request until the user fills it in.
		const allFilled = rows.every(r => r.location.trim() !== "");
		const allValid = rows.every(r => isValidLocationFormat(r.location.trim()));
		if (!allFilled || !allValid) {
			setCommittedLocations([]);
			setManualLoadedMiles(null);
			return;
		}
		const locs = rows.map(r => r.location.trim());
		setCommittedLocations(locs);
		setManualLoadedMiles(null);
	}, []);

	const removeExtraRow = useCallback(
		(index: number) => {
			setRouteRows(prev => {
				const next = prev.filter((_, i) => i !== index);
				// After removing, commit the remaining rows immediately.
				// If all are filled and valid, useQuery will use cache or fire a new request.
				commitLocations(next);
				validateRouteChronology(next);
				return next;
			});
		},
		[commitLocations, validateRouteChronology]
	);

	// Ref to store target index during drag; move happens only on drop
	const pendingDropRef = useRef<number | null>(null);

	const handleAddressBlur = useCallback(
		async (index: number, value: string, rowId: string) => {
			const trimmed = value.trim();
			if (!trimmed) {
				setRouteRowLocationErrors(prev => {
					const next = { ...prev };
					delete next[rowId];
					return next;
				});
				setRouteRows(prev => {
					const next = [...prev];
					if (next[index]) {
						next[index] = { ...next[index], coordinates: "" };
					}
					return next;
				});
				return;
			}

			// Validate format: must be ZIP or "City, State"
			if (!isValidLocationFormat(trimmed)) {
				setRouteRowLocationErrors(prev => ({ ...prev, [rowId]: LOCATION_FORMAT_ERROR }));
				setRouteRows(prev => {
					const next = [...prev];
					if (next[index]) {
						next[index] = { ...next[index], coordinates: "" };
					}
					return next;
				});
				return;
			}

			setRouteRowLocationErrors(prev => {
				const next = { ...prev };
				delete next[rowId];
				return next;
			});

			const geocodeAddress = normalizeLocationForGeocode(trimmed);
			let finalAddress = trimmed;

			if (needsLocationGeocode(trimmed)) {
				try {
					const formatted = await offers.geocodeToFormattedAddress(geocodeAddress);
					if (formatted) {
						finalAddress = formatted;
					}
				} catch {
					// Keep original value on error
				}
			} else if (geocodeAddress !== trimmed) {
				finalAddress = geocodeAddress;
			}

			if (finalAddress !== trimmed) {
				setRouteRows(prev => {
					const next = [...prev];
					if (next[index]) {
						next[index] = { ...next[index], location: finalAddress };
					}
					return next;
				});
			}

			try {
				const coords = await offers.geocodeCoordinates(finalAddress);
				if (coords) {
					const coordinatesStr = `${coords.latitude},${coords.longitude}`;
					setRouteRows(prev => {
						const next = [...prev];
						if (next[index]) {
							next[index] = { ...next[index], coordinates: coordinatesStr };
						}
						return next;
					});
				} else {
					setRouteRows(prev => {
						const next = [...prev];
						if (next[index]) {
							next[index] = { ...next[index], coordinates: "" };
						}
						return next;
					});
				}
			} catch {
				setRouteRows(prev => {
					const next = [...prev];
					if (next[index]) {
						next[index] = { ...next[index], coordinates: "" };
					}
					return next;
				});
			}

			// Commit after geocoding resolves (or immediately if no geocoding)
			// Use a microtask so setRouteRows state is flushed before reading it
			setTimeout(() => {
				setRouteRows(current => {
					commitLocations(current);
					return current;
				});
			}, 0);
		},
		[commitLocations]
	);

	const moveExtraRow = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			setRouteRows(prev => {
				const next = [...prev];
				const [removed] = next.splice(dragIndex, 1);
				next.splice(hoverIndex, 0, removed);
				commitLocations(next);
				validateRouteChronology(next);
				return next;
			});
		},
		[commitLocations, validateRouteChronology]
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
			const missingTime = trimmedRoute.some(row => row.time === "");
			const missingLocation = trimmedRoute.some(row => row.location === "");
			if (missingTime) {
				routeError = "Each stop must have a date and time";
			} else if (missingLocation) {
				routeError = "Each stop must have a location";
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
					} else {
						const missingCoordinates = trimmedRoute.some(
							row => !parseRouteCoordinates(row.coordinates)
						);
						if (missingCoordinates) {
							routeError =
								"Each stop must have coordinates — blur each location field to resolve the address";
						} else {
							routeError = getRouteChronologyError(trimmedRoute.map(row => row.time));
						}
					}
				}
			}
		}

		return { fieldErrors, routeError };
	};

	const driverIdsValue = effectiveDriverIds.join(",");

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

	const parseOfferedRate = (v: string): number | undefined => {
		const trimmed = String(v).replace(/,/g, "").trim();
		if (!trimmed) return undefined;
		const n = parseFloat(trimmed);
		return Number.isNaN(n) ? undefined : n;
	};

	const openEditMilesModal = () => {
		setEditMilesInput(
			loadedMiles != null && Number.isFinite(loadedMiles)
				? String(Math.round(loadedMiles))
				: ""
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
		setSubmitError("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (isEditMode && !hasEditChanges) {
			return;
		}

		const { fieldErrors, routeError: nextRouteError } = validate();
		if (Object.keys(fieldErrors).length > 0 || nextRouteError) {
			setErrors(fieldErrors);
			setRouteError(nextRouteError);
			return;
		}
		setErrors({});
		setRouteError(null);
		setSubmitError("");

		if (isCalculatingRoute) {
			setSubmitError("Please wait for route distance calculation to complete");
			return;
		}

		if (loadedMiles == null) {
			setSubmitError("Route distance could not be calculated");
			return;
		}

		const offeredRateRaw = formValues.offeredRate.trim();
		const offeredRate =
			offeredRateRaw === "" ? undefined : parseOfferedRate(offeredRateRaw);
		if (offeredRateRaw !== "" && offeredRate == null) {
			setErrors({ offeredRate: "Enter a valid number" });
			return;
		}
		if (offeredRate != null && offeredRate < 0) {
			setErrors({ offeredRate: "Must be 0 or greater" });
			return;
		}

		const milesToSend = loadedMiles;

		setIsSubmitting(true);
		try {
			const routePayload: CreateOfferRoutePoint[] = routeRows.map(row => {
				const coords = parseRouteCoordinates(row.coordinates);
				return {
					type: (row.type === "pickup"
						? "pick_up_location"
						: "delivery_location") as CreateOfferRoutePoint["type"],
					location: row.location.trim(),
					time: row.time.trim(),
					latitude: coords?.latitude,
					longitude: coords?.longitude,
				};
			});

			const payload = {
				externalId: effectiveExternalId,
				driverIds: effectiveDriverIds,
				route: routePayload,
				loadedMiles: Math.round(milesToSend),
				offeredRate,
				driverEmptyMiles:
					Object.keys(effectiveDriverEmptyMiles).length > 0
						? effectiveDriverEmptyMiles
						: undefined,
				weight: parseWeight(formValues.weight),
				commodity: formValues.commodity.trim() || undefined,
				specialRequirements:
					formValues.specialRequirements.length > 0
						? formValues.specialRequirements
						: undefined,
				notes: formValues.notes.trim() || undefined,
			};

			const result = isEditMode && editData
				? await offers.updateOffer(editData.offerId, payload)
				: await offers.createOffer(payload);
			if (result.success) {
				onSubmit?.({
					externalId: effectiveExternalId,
					driverIds: driverIdsValue,
					route: routeRows,
					...formValues,
				});
				onClose();
			} else {
				setSubmitError(
					result.error ??
						(isEditMode ? "Failed to update offer" : "Failed to create offer")
				);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			containScroll
			closeOnEscape={!isEditMilesModalOpen}
			className="relative m-5 flex w-full max-w-3xl max-h-[95vh] flex-col overflow-hidden rounded-3xl bg-white p-0 shadow-sm dark:bg-gray-900 sm:m-0"
		>
			<form
				onSubmit={handleSubmit}
				className="relative flex max-h-[95vh] min-h-0 flex-col overflow-hidden"
			>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable] sm:p-8">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
						{isEditMode ? "Edit Offer" : "Create Offer"}
					</h4>

					{/* Hidden: externalId */}
					<input type="hidden" name="externalId" value={effectiveExternalId} readOnly />

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
								onLocationChange={rowId => {
									setRouteRowLocationErrors(prev => {
										const next = { ...prev };
										delete next[rowId];
										return next;
									});
									setRouteRows(prev =>
										prev.map(row =>
											row.id === rowId ? { ...row, coordinates: "" } : row
										)
									);
								}}
								locationError={routeRowLocationErrors[row.id]}
								canRemove={
									(row.type === "pickup" &&
										routeRows.filter(r => r.type === "pickup").length > 1) ||
									(row.type === "delivery" &&
										routeRows.filter(r => r.type === "delivery").length > 1)
								}
								rowCount={routeRows.length}
								onAddRow={
									row.type === "pickup" ? addPickUpRow : addDeliveryRow
								}
							/>
						))}
					</DndProvider>

					{/* Loaded miles (left) and Offered rate (right, optional) */}
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
									className={`cursor-not-allowed ${showLoadedMilesEditIcon ? "pr-11" : ""}`}
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
						</div>
						<div className="w-1/2 min-w-0">
							<Label htmlFor="offered-rate-field">Offered rate</Label>
							<Input
								id="offered-rate-field"
								type="text"
								inputMode="decimal"
								value={formValues.offeredRate ?? ""}
								onChange={e => handleChange("offeredRate", e.target.value)}
								placeholder="e.g. 2500.50"
								className="dark:bg-gray-900"
								error={!!errors.offeredRate}
								hint={errors.offeredRate}
							/>
						</div>
					</div>

					{routeDistanceError && (
						<p className="text-sm text-red-500 dark:text-red-400">
							{routeDistanceError}
						</p>
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
									{ value: "tanker-end", text: "Tanker End", selected: false },
									{
										value: "direct-delivery",
										text: "Direct Delivery",
										selected: false,
									},
									{
										value: "driver-assist",
										text: "Driver assist",
										selected: false,
									},
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
									{
										value: "military-base",
										text: "Military base",
										selected: false,
									},
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
									{
										value: "hemp-product",
										text: "Hemp product",
										selected: false,
									},
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

					{submitError ? (
						<p className="min-h-[1.25rem] text-sm text-red-500 dark:text-red-400">
							{submitError}
						</p>
					) : (
						<p className="min-h-[1.25rem] text-sm" aria-hidden="true" />
					)}
				</div>

				<div className="flex shrink-0 items-center justify-end gap-3 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
					{isSubmitting && (
						<div className="mr-1 flex items-center" aria-hidden>
							<SpinnerOne />
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
						className="min-w-[6.5rem]"
						disabled={
							isSubmitting ||
							isCalculatingRoute ||
							loadedMiles == null ||
							loadedMiles === 0 ||
							Boolean(routeError) ||
							(isEditMode && !hasEditChanges)
						}
					>
						{isSubmitting
							? isEditMode
								? "Editing…"
								: "Creating…"
							: isEditMode
								? "Edit"
								: "Create"}
					</Button>
				</div>
			</form>
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
					<Label htmlFor="edit-loaded-miles-input">Loaded miles</Label>
					<Input
						id="edit-loaded-miles-input"
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
					id="edit-loaded-miles-confirm"
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
