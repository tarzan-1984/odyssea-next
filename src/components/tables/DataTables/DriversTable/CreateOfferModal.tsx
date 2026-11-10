"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
	defaultPickupDateTime,
	formatOfferDateTimeFieldForDisplay,
	formatOfferDateTimeRange,
	getRouteChronologyError,
	getRouteStopMinDate,
	isOfferAsapTime,
	isOfferDateWithoutTime,
	OFFER_ASAP_TIME,
	offerStopTimeOrNewYorkNow,
} from "@/utils/offerDateTimeRange";
import {
	isValidLocationFormat,
	LOCATION_COORDINATES_ERROR,
	LOCATION_FORMAT_ERROR,
	LOCATION_GEOCODE_ERROR,
	LOCATION_ROUTE_UNRESOLVED_ERROR,
	normalizeLocationForGeocode,
	offerLocationsAreSame,
} from "@/utils/offerLocationFormat";
import { diagnoseOfferLocationError } from "@/utils/offerLocationGeocode";
import { offerRouteStopsResolved } from "@/utils/offerGoogleRoute";
import { buildGoogleMapsDirectionsUrl } from "@/utils/googleMapsDirectionsUrl";
import { useCurrentUser } from "@/stores/userStore";
import { canCreateOffers } from "@/utils/roleAccess";

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

/** Prefill create-offer form from /drivers-list?create_offer=1&... URL params. */
export interface CreateOfferUrlStop {
	type: "pickup" | "delivery";
	location: string;
	time?: string;
}

export interface CreateOfferUrlPrefill {
	/** Stops in URL appearance order (pu/del mixed). */
	route?: CreateOfferUrlStop[];
	loadedMiles?: string;
	weight?: string;
	commodity?: string;
	/** Non-empty extension_load_id query param. Written into the hidden field. */
	extensionLoadId?: string;
}

export interface CreateOfferModalProps {
	isOpen: boolean;
	onClose: () => void;
	externalId: string;
	selectedDriverIds: string[];
	/** Map driverId -> empty_miles (rounded). Passed to backend for rate_offers. */
	driverEmptyMiles?: Record<string, number>;
	/** Pre-fill first pick up location (e.g. drivers-list address search). */
	initialPickupLocation?: string;
	/** Prefill from create_offer=1 deep link (route, weight, commodity, miles, extension_load_id). */
	initialCreateOfferFromUrl?: CreateOfferUrlPrefill | null;
	onSubmit?: (values: CreateOfferFormValues) => void | Promise<void>;
	/** When set, modal opens in edit mode with pre-filled values. */
	editData?: EditOfferData | null;
}

function normalizeOfferTimeFromUrl(raw: string): string {
	return offerStopTimeOrNewYorkNow(raw);
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

function buildRouteRowsFromUrlPrefill(
	urlPrefill: CreateOfferUrlPrefill | null | undefined,
	fallbackPickupLocation?: string
): RouteRow[] {
	const stops = urlPrefill?.route?.filter(s => s.location.trim()) ?? [];

	if (stops.length === 0) {
		const pickupRow = initialRouteRow("pickup");
		if (fallbackPickupLocation?.trim()) {
			pickupRow.location = fallbackPickupLocation.trim();
		}
		pickupRow.time = defaultPickupDateTime();
		return [pickupRow, initialRouteRow("delivery")];
	}

	const rows = stops.map(stop => {
		const row = initialRouteRow(stop.type);
		row.location = stop.location.trim();
		const timeRaw = stop.time?.trim() ?? "";
		row.time = timeRaw ? normalizeOfferTimeFromUrl(timeRaw) : defaultPickupDateTime();
		return row;
	});

	if (!rows.some(r => r.type === "pickup")) {
		const pickupRow = initialRouteRow("pickup");
		pickupRow.time = defaultPickupDateTime();
		rows.unshift(pickupRow);
	}
	if (!rows.some(r => r.type === "delivery")) {
		rows.push(initialRouteRow("delivery"));
	}

	return rows;
}

function locationFormatErrorsForRows(rows: RouteRow[]): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const row of rows) {
		const loc = row.location.trim();
		if (!loc) continue;
		if (!isValidLocationFormat(loc)) {
			errors[row.id] = LOCATION_FORMAT_ERROR;
		}
	}
	return errors;
}

function routeRowsGeocodeKey(rows: RouteRow[]): string {
	return rows.map(row => row.id).join("|");
}

const PICKUP_DATE_TIME_REQUIRED_ERROR =
	"Pick up date & time is necessary to proceed with the load offer";
const DELIVERY_DATE_TIME_REQUIRED_ERROR =
	"Delivery date & time is necessary to proceed with the load offer";

function routeStopTimeIsComplete(time: string): boolean {
	if (time === "") return false;
	if (isOfferAsapTime(time)) return true;
	return !isOfferDateWithoutTime(time);
}

/** Names the stop whose location is filled but date & time is missing or incomplete. */
function dateTimeRequiredRouteError(
	rows: Array<Pick<RouteRow, "type" | "location" | "time">>
): string | null {
	let pickupMissing = false;
	let deliveryMissing = false;
	for (const row of rows) {
		if (row.location === "") continue;
		if (routeStopTimeIsComplete(row.time)) continue;
		if (row.type === "pickup") pickupMissing = true;
		else deliveryMissing = true;
	}
	const messages: string[] = [];
	if (pickupMissing) messages.push(PICKUP_DATE_TIME_REQUIRED_ERROR);
	if (deliveryMissing) messages.push(DELIVERY_DATE_TIME_REQUIRED_ERROR);
	return messages.length > 0 ? messages.join("\n") : null;
}

function routePointToRow(
	point: EditOfferData["route"][number],
	index: number
): RouteRow {
	return {
		id: `row-edit-${index}-${Math.random().toString(36).slice(2, 9)}`,
		type: point.type === "pick_up_location" ? "pickup" : "delivery",
		location: point.location ?? "",
		time: formatOfferDateTimeFieldForDisplay(point.time ?? ""),
		coordinates:
			point.latitude != null &&
			point.longitude != null &&
			!Number.isNaN(point.latitude) &&
			!Number.isNaN(point.longitude)
				? `${point.latitude},${point.longitude}`
				: "",
	};
}

const REQUIRED_FIELDS: (keyof typeof initialFormState)[] = ["weight", "commodity"];

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
	onAsapToggle,
	timePickerOpen,
	onTimePickerOpenChange,
	onTimePickerComplete,
	locationError,
	minDate,
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
	onAsapToggle?: (index: number, enabled: boolean) => void;
	timePickerOpen?: boolean;
	onTimePickerOpenChange?: (open: boolean) => void;
	onTimePickerComplete?: () => void;
	locationError?: string;
	/** Previous stop datetime — delivery cannot be earlier than pick up. */
	minDate?: Date | null;
	/** When false, hide the remove button (e.g. only one row of this type remains) */
	canRemove?: boolean;
	rowCount: number;
	onAddRow?: (afterIndex: number) => void;
}) {
	const rowRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLDivElement>(null);
	const isDelivery = row.type === "delivery";
	const isAsap = isOfferAsapTime(row.time);

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
			className={`relative flex flex-col sm:flex-row sm:items-end gap-4 mt-2 ${
				locationError ? "pb-8" : ""
			}`}
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
					<p className="absolute left-0 top-full z-10 mt-1 text-xs text-red-500 dark:text-red-400">
						{locationError}
					</p>
				)}
			</div>

			{/* Time field + remove button grouped together */}
			<div className="flex items-end gap-2 shrink-0">
				<div className="w-full shrink-0 sm:w-[calc(16rem+10px)]">
					<Label htmlFor={`datetime-${row.id}`}>
						{row.type === "pickup" ? "Pick up date & time" : "Delivery date & time"}
					</Label>
					{isAsap ? (
						<button
							id={`datetime-${row.id}`}
							type="button"
							className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-left text-sm text-gray-800 shadow-theme-xs cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
							onClick={() => {
								onAsapToggle?.(index, false);
								onTimePickerOpenChange?.(true);
							}}
						>
							{OFFER_ASAP_TIME}
						</button>
					) : (
						<DateTimePicker
							id={`datetime-${row.id}`}
							allowTimeRange
							value={row.time}
							minDate={minDate ?? null}
							open={timePickerOpen}
							onOpenChange={onTimePickerOpenChange}
							onComplete={onTimePickerComplete}
							showAsap={isDelivery}
							onAsap={() => onAsapToggle?.(index, true)}
							onChange={v => updateExtraRow(index, "time", v)}
							onBlur={onTimeBlur}
							className="dark:bg-gray-900"
						/>
					)}
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
	initialPickupLocation,
	initialCreateOfferFromUrl = null,
	onSubmit,
	editData = null,
}: CreateOfferModalProps) {
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();
	const canSubmitOffer = canCreateOffers(currentUser?.role);
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
	/** Avoid re-applying the same Google route result onto the form. */
	const appliedGoogleRouteKeyRef = useRef("");
	const routeRowsRef = useRef<RouteRow[]>([]);
	routeRowsRef.current = routeRows;
	const routeRowLocationErrorsRef = useRef(routeRowLocationErrors);
	routeRowLocationErrorsRef.current = routeRowLocationErrors;
	/** Row-id key of the latest GET/prefill route that still needs geocode on open. */
	const pendingPrefillGeocodeKeyRef = useRef("");
	/** Row-id key already sent through handleAddressBlur for the current open. */
	const appliedPrefillGeocodeKeyRef = useRef("");
	/** When true, keep URL-provided loaded miles and skip route-distance API. */
	const preserveUrlLoadedMilesRef = useRef(false);
	/** Edit-mode miles copied into the manual field once per same-address route. */
	const sameLocationMilesSeededRef = useRef(false);
	/** Previous date/time before ASAP toggle, keyed by route row id. */
	const timeBeforeAsapRef = useRef<Record<string, string>>({});
	/** Route row whose date/time calendar is open. */
	const [openTimeRowId, setOpenTimeRowId] = useState<string | null>(null);

	// Reset form and errors when modal opens
	useEffect(() => {
		if (!isOpen) {
			pendingPrefillGeocodeKeyRef.current = "";
			appliedPrefillGeocodeKeyRef.current = "";
			appliedGoogleRouteKeyRef.current = "";
			preserveUrlLoadedMilesRef.current = false;
			sameLocationMilesSeededRef.current = false;
			timeBeforeAsapRef.current = {};
			setOpenTimeRowId(null);
			return;
		}

		let nextLocationErrors: Record<string, string> = {};
		sameLocationMilesSeededRef.current = false;

		if (editData) {
			pendingPrefillGeocodeKeyRef.current = "";
			appliedPrefillGeocodeKeyRef.current = "";
			preserveUrlLoadedMilesRef.current = false;
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
			const urlPrefill = initialCreateOfferFromUrl;
			setFormValues({
				...initialFormState,
				weight: urlPrefill?.weight?.trim() ?? "",
				commodity: urlPrefill?.commodity?.trim() ?? "",
			});

			const rows = buildRouteRowsFromUrlPrefill(urlPrefill, initialPickupLocation);
			setRouteRows(rows);
			setEditFallbackLoadedMiles(null);

			const milesRaw = urlPrefill?.loadedMiles?.trim() ?? "";
			const miles = milesRaw ? Number.parseFloat(milesRaw.replace(/,/g, "")) : NaN;
			if (Number.isFinite(miles) && miles > 0) {
				preserveUrlLoadedMilesRef.current = true;
				setManualLoadedMiles(Math.round(miles));
			} else {
				preserveUrlLoadedMilesRef.current = false;
				setManualLoadedMiles(null);
			}
			setCommittedLocations([]);

			nextLocationErrors = locationFormatErrorsForRows(rows);
			pendingPrefillGeocodeKeyRef.current = rows.some(row => row.location.trim())
				? routeRowsGeocodeKey(rows)
				: "";
			appliedPrefillGeocodeKeyRef.current = "";
		}

		setErrors({});
		setRouteError(null);
		setRouteRowLocationErrors(nextLocationErrors);
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

	const googleMapsRouteUrl = buildGoogleMapsDirectionsUrl(
		routeRows.map(row => row.location)
	);

	const openRouteInGoogleMaps = () => {
		if (!googleMapsRouteUrl) return;
		window.open(googleMapsRouteUrl, "_blank", "noopener,noreferrer");
	};

	const sameStopLocations = offerLocationsAreSame(committedLocations);

	const {
		data: routeDistanceData,
		isFetching: isCalculatingRoute,
		error: routeDistanceQueryError,
	} = useQuery({
		queryKey: ["route-distance", committedLocations],
		queryFn: () => offers.calculateRouteDistance(committedLocations),
		enabled: allLocationsFilledAndValid(committedLocations) && !sameStopLocations,
		staleTime: 20 * 60 * 1000,
		retry: 1,
	});

	const googleStopsResolved =
		routeDistanceData?.stops != null && offerRouteStopsResolved(routeDistanceData.stops);
	const loadedMiles = sameStopLocations
		? manualLoadedMiles
		: (manualLoadedMiles ??
			(googleStopsResolved ? routeDistanceData.loadedMiles : null) ??
			editFallbackLoadedMiles);
	const routeDistanceError = sameStopLocations
		? null
		: manualLoadedMiles != null
			? null
			: routeDistanceQueryError
				? routeDistanceQueryError instanceof Error
					? routeDistanceQueryError.message
					: "Could not calculate route distance"
				: null;
	const showLoadedMilesEditIcon =
		!sameStopLocations &&
		!isCalculatingRoute &&
		(manualLoadedMiles != null ||
			(allLocationsFilledAndValid(committedLocations) &&
				(googleStopsResolved ||
					routeDistanceQueryError != null ||
					editFallbackLoadedMiles != null)));

	useEffect(() => {
		if (committedLocations.length === 0) {
			appliedGoogleRouteKeyRef.current = "";
		}
	}, [committedLocations]);

	useEffect(() => {
		const stops = routeDistanceData?.stops;
		if (!stops || stops.length === 0) return;
		const key = committedLocations.join("|");
		if (!key || appliedGoogleRouteKeyRef.current === key) return;
		const currentKey = routeRowsRef.current.map(row => row.location.trim()).join("|");
		if (currentKey !== key) return;
		appliedGoogleRouteKeyRef.current = key;

		const currentRows = routeRowsRef.current;
		if (currentRows.length !== stops.length) {
			appliedGoogleRouteKeyRef.current = "";
			return;
		}

		const errors: Record<string, string> = {};
		const nextRows = currentRows.map((row, index) => {
			const stop = stops[index];
			if (!stop || stop.error || stop.latitude == null || stop.longitude == null) {
				errors[row.id] = stop?.error || LOCATION_GEOCODE_ERROR;
				return { ...row, coordinates: "" };
			}
			return {
				...row,
				location: stop.location || row.location,
				coordinates: `${stop.latitude},${stop.longitude}`,
			};
		});
		setRouteRows(nextRows);
		setRouteRowLocationErrors(errors);

		if (offerRouteStopsResolved(stops)) {
			const formatted = stops.map(stop => stop.location);
			const formattedKey = formatted.join("|");
			if (formattedKey !== key) {
				queryClient.setQueryData(["route-distance", formatted], routeDistanceData);
				appliedGoogleRouteKeyRef.current = formattedKey;
				setCommittedLocations(formatted);
			}
		}
	}, [routeDistanceData, committedLocations, queryClient]);

	// When Google cannot build a route, diagnose each stop so field errors match the real issue
	// (e.g. city/ZIP mismatch) instead of a generic "could not find" on every field.
	useEffect(() => {
		if (!routeDistanceQueryError || committedLocations.length === 0) return;
		if (offerLocationsAreSame(committedLocations)) return;
		const rowsSnapshot = routeRowsRef.current.map(row => ({
			id: row.id,
			location: row.location.trim(),
		}));
		let cancelled = false;

		(async () => {
			const entries = await Promise.all(
				rowsSnapshot.map(async row => {
					if (!row.location) return [row.id, null] as const;
					const message = await diagnoseOfferLocationError(row.location, {
						requireCityPostalMatch: true,
					});
					return [row.id, message] as const;
				})
			);
			if (cancelled) return;

			setRouteRowLocationErrors(prev => {
				const next: Record<string, string> = { ...prev };
				for (const [id, message] of entries) {
					if (message) {
						next[id] = message;
					} else if (
						next[id] === LOCATION_GEOCODE_ERROR ||
						next[id] === LOCATION_ROUTE_UNRESOLVED_ERROR ||
						next[id] === LOCATION_COORDINATES_ERROR
					) {
						delete next[id];
					}
				}
				const anySpecific = entries.some(([, message]) => message != null);
				if (!anySpecific) {
					for (const row of rowsSnapshot) {
						if (row.location && !next[row.id]) {
							next[row.id] = LOCATION_ROUTE_UNRESOLVED_ERROR;
						}
					}
				}
				return next;
			});
		})().catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [routeDistanceQueryError, committedLocations]);

	// Same pickup and delivery have no driving route. Keep coordinates for the offer
	// without asking Google for miles, and let the user type loaded miles.
	useEffect(() => {
		if (!sameStopLocations) return;
		setRouteRowLocationErrors(prev => {
			const next = { ...prev };
			let changed = false;
			for (const id of Object.keys(next)) {
				if (
					next[id] === LOCATION_ROUTE_UNRESOLVED_ERROR ||
					next[id] === LOCATION_COORDINATES_ERROR
				) {
					delete next[id];
					changed = true;
				}
			}
			if (!changed) return prev;
			routeRowLocationErrorsRef.current = next;
			return next;
		});
		setRouteError(prev => (prev === LOCATION_COORDINATES_ERROR ? null : prev));

		const address = committedLocations[0]?.trim();
		if (!address) return;
		const key = committedLocations.join("|");
		let cancelled = false;

		void (async () => {
			const point = await offers.geocodeCoordinates(address);
			if (cancelled || !point) return;
			const coordinates = `${point.latitude},${point.longitude}`;
			setRouteRows(prev => {
				const currentKey = prev.map(row => row.location.trim()).join("|");
				if (currentKey !== key) return prev;
				if (prev.every(row => row.coordinates === coordinates)) return prev;
				return prev.map(row => ({ ...row, coordinates }));
			});
		})();

		return () => {
			cancelled = true;
		};
	}, [sameStopLocations, committedLocations]);

	useEffect(() => {
		if (!sameStopLocations) {
			sameLocationMilesSeededRef.current = false;
			return;
		}
		if (sameLocationMilesSeededRef.current) return;
		sameLocationMilesSeededRef.current = true;
		setManualLoadedMiles(prev => {
			if (prev != null) return prev;
			if (editFallbackLoadedMiles != null && editFallbackLoadedMiles > 0) {
				return Math.round(editFallbackLoadedMiles);
			}
			return prev;
		});
	}, [sameStopLocations, editFallbackLoadedMiles]);

	const clearUrlLoadedMilesLock = useCallback(() => {
		if (!preserveUrlLoadedMilesRef.current) return;
		preserveUrlLoadedMilesRef.current = false;
		setManualLoadedMiles(null);
	}, []);

	const addPickUpRow = (afterIndex: number) => {
		preserveUrlLoadedMilesRef.current = false;
		setCommittedLocations([]);
		setManualLoadedMiles(null);
		setRouteRows(prev => {
			const next = [...prev];
			const pickupRow = initialRouteRow("pickup");
			pickupRow.time = defaultPickupDateTime();
			next.splice(afterIndex + 1, 0, pickupRow);
			return next;
		});
	};

	const addDeliveryRow = (afterIndex: number) => {
		preserveUrlLoadedMilesRef.current = false;
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

	const handleAsapToggle = useCallback(
		(index: number, enabled: boolean) => {
			setRouteRows(prev => {
				const row = prev[index];
				if (!row || row.type !== "delivery") return prev;
				const next = [...prev];
				if (enabled) {
					if (!isOfferAsapTime(row.time)) {
						timeBeforeAsapRef.current[row.id] = row.time;
					}
					next[index] = { ...row, time: OFFER_ASAP_TIME };
				} else {
					const restored = timeBeforeAsapRef.current[row.id] ?? "";
					delete timeBeforeAsapRef.current[row.id];
					next[index] = {
						...row,
						time: isOfferAsapTime(restored) ? "" : restored,
					};
				}
				validateRouteChronology(next);
				return next;
			});
		},
		[validateRouteChronology]
	);

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
		const locs = rows.map(r => r.location.trim());
		const sameLocations = offerLocationsAreSame(locs);
		if (sameLocations) {
			const nextErrors = { ...routeRowLocationErrorsRef.current };
			let changed = false;
			for (const row of rows) {
				const message = nextErrors[row.id];
				if (
					message === LOCATION_ROUTE_UNRESOLVED_ERROR ||
					message === LOCATION_COORDINATES_ERROR
				) {
					delete nextErrors[row.id];
					changed = true;
				}
			}
			if (changed) {
				routeRowLocationErrorsRef.current = nextErrors;
				setRouteRowLocationErrors(nextErrors);
			}
			setRouteError(prev => (prev === LOCATION_COORDINATES_ERROR ? null : prev));
		}

		const allFilled = rows.every(r => r.location.trim() !== "");
		const allValid = rows.every(r => isValidLocationFormat(r.location.trim()));
		const hasFieldErrors = rows.some(
			r => r.location.trim() !== "" && Boolean(routeRowLocationErrorsRef.current[r.id])
		);
		if (!allFilled || !allValid || hasFieldErrors) {
			setCommittedLocations([]);
			if (!preserveUrlLoadedMilesRef.current) {
				setManualLoadedMiles(null);
			}
			return;
		}
		setCommittedLocations(locs);
		if (!preserveUrlLoadedMilesRef.current && !sameLocations) {
			setManualLoadedMiles(null);
		}
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
		(index: number, value: string, rowId: string) => {
			const trimmed = value.trim();

			const patchRow = (patch: Partial<RouteRow>) => {
				setRouteRows(prev => {
					const next = [...prev];
					const targetIndex =
						next[index]?.id === rowId
							? index
							: next.findIndex(row => row.id === rowId);
					if (targetIndex < 0) return prev;
					next[targetIndex] = { ...next[targetIndex], ...patch };
					return next;
				});
			};

			const clearLocationError = () => {
				setRouteRowLocationErrors(prev => {
					if (!prev[rowId]) return prev;
					const next = { ...prev };
					delete next[rowId];
					routeRowLocationErrorsRef.current = next;
					return next;
				});
				if (routeRowLocationErrorsRef.current[rowId]) {
					const next = { ...routeRowLocationErrorsRef.current };
					delete next[rowId];
					routeRowLocationErrorsRef.current = next;
				}
			};

			const setLocationError = (message: string) => {
				setRouteRowLocationErrors(prev => {
					const next = { ...prev, [rowId]: message };
					routeRowLocationErrorsRef.current = next;
					return next;
				});
				setRouteError(prev =>
					prev === LOCATION_COORDINATES_ERROR || prev === LOCATION_FORMAT_ERROR
						? null
						: prev
				);
			};

			const commitAfterPatch = () => {
				setTimeout(() => {
					setRouteRows(current => {
						commitLocations(current);
						return current;
					});
				}, 0);
			};

			if (!trimmed) {
				clearLocationError();
				patchRow({ coordinates: "" });
				commitAfterPatch();
				return;
			}

			// Validate format: must be ZIP or "City, State"
			if (!isValidLocationFormat(trimmed)) {
				setLocationError(LOCATION_FORMAT_ERROR);
				patchRow({ coordinates: "" });
				commitAfterPatch();
				return;
			}

			clearLocationError();

			const normalized = normalizeLocationForGeocode(trimmed);
			if (normalized !== trimmed) {
				patchRow({ location: normalized });
			}

			void (async () => {
				const diagnosis = await diagnoseOfferLocationError(normalized);
				if (diagnosis) {
					setLocationError(diagnosis);
					patchRow({ coordinates: "" });
					setCommittedLocations([]);
					return;
				}
				commitAfterPatch();
			})();
		},
		[commitLocations]
	);

	// Resolve GET/prefill addresses on open (same checks as blur) and show field errors.
	useEffect(() => {
		if (!isOpen || editData) return;

		const pendingKey = pendingPrefillGeocodeKeyRef.current;
		if (!pendingKey) return;

		const currentKey = routeRowsGeocodeKey(routeRows);
		if (!currentKey || currentKey !== pendingKey) return;
		if (appliedPrefillGeocodeKeyRef.current === currentKey) return;
		if (!routeRows.some(row => row.location.trim())) return;

		appliedPrefillGeocodeKeyRef.current = currentKey;

		const rowsToResolve = routeRows.map((row, index) => ({ row, index }));
		const applyPrefillGeocode = async () => {
			for (const { row, index } of rowsToResolve) {
				const loc = row.location.trim();
				if (!loc) continue;
				handleAddressBlur(index, loc, row.id);
			}
		};
		applyPrefillGeocode().catch(() => {});
	}, [isOpen, editData, routeRows, handleAddressBlur]);

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
		locationErrors: Record<string, string>;
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
		const locationErrors: Record<string, string> = {};
		const trimmedRoute = routeRows.map(row => ({
			...row,
			location: row.location.trim(),
			time: row.time.trim(),
		}));

		const hasLocatedPickup = trimmedRoute.some(
			row => row.type === "pickup" && row.location !== ""
		);
		const hasLocatedDelivery = trimmedRoute.some(
			row => row.type === "delivery" && row.location !== ""
		);
		const dateTimeError = dateTimeRequiredRouteError(trimmedRoute);

		if (trimmedRoute.length === 0) {
			routeError = "Add at least one Pick up and one Delivery";
		} else if (!hasLocatedPickup || !hasLocatedDelivery) {
			routeError = "At least one Pick up and one Delivery are required";
		} else if (dateTimeError) {
			routeError = dateTimeError;
		} else {
			const missingLocation = trimmedRoute.some(row => row.location === "");
			if (missingLocation) {
				routeError = "Each stop must have a location";
			} else {
				const first = trimmedRoute[0];
				const last = trimmedRoute[trimmedRoute.length - 1];
				if (first.type !== "pickup") {
					routeError = "The first stop in route must be Pick up";
				} else if (last.type !== "delivery") {
					routeError = "The last stop in route must be Delivery";
				} else {
					const sameStops = offerLocationsAreSame(
						trimmedRoute.map(row => row.location)
					);
					for (const row of trimmedRoute) {
						if (row.location !== "" && !isValidLocationFormat(row.location)) {
							locationErrors[row.id] = LOCATION_FORMAT_ERROR;
						} else if (!sameStops && !parseRouteCoordinates(row.coordinates)) {
							const existing = routeRowLocationErrors[row.id];
							if (existing) {
								locationErrors[row.id] = existing;
							} else if (!routeDistanceError) {
								locationErrors[row.id] = LOCATION_COORDINATES_ERROR;
							}
						}
					}
					// Route failed and no stop-specific diagnose yet — keep submit blocked
					// without painting every field as "location not found".
					if (
						!sameStops &&
						Object.keys(locationErrors).length === 0 &&
						routeDistanceError &&
						trimmedRoute.some(row => !parseRouteCoordinates(row.coordinates))
					) {
						for (const row of trimmedRoute) {
							if (row.location && !parseRouteCoordinates(row.coordinates)) {
								locationErrors[row.id] = LOCATION_ROUTE_UNRESOLVED_ERROR;
							}
						}
					}
					if (Object.keys(locationErrors).length === 0) {
						routeError = getRouteChronologyError(trimmedRoute.map(row => row.time));
					}
				}
			}
		}

		return { fieldErrors, routeError, locationErrors };
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
		setRouteError(prev => (prev === LOCATION_COORDINATES_ERROR ? null : prev));
		setSubmitError("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!canSubmitOffer) {
			return;
		}

		if (isEditMode && !hasEditChanges) {
			return;
		}

		const { fieldErrors, routeError: nextRouteError, locationErrors } = validate();
		setRouteRowLocationErrors(locationErrors);
		if (
			Object.keys(fieldErrors).length > 0 ||
			nextRouteError ||
			Object.keys(locationErrors).length > 0
		) {
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

			const extensionLoadIdRaw = new FormData(
				e.currentTarget as HTMLFormElement
			).get("extension_load_id");
			const extensionLoadId =
				typeof extensionLoadIdRaw === "string" ? extensionLoadIdRaw.trim() : "";

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
				commodity: formValues.commodity.trim(),
				specialRequirements:
					formValues.specialRequirements.length > 0
						? formValues.specialRequirements
						: undefined,
				notes: formValues.notes.trim() || undefined,
				...(!isEditMode && extensionLoadId
					? { extension_load_id: extensionLoadId }
					: {}),
			};

			const result = isEditMode && editData
				? await offers.updateOffer(editData.offerId, payload)
				: await offers.createOffer(payload);
			if (result.success) {
				await onSubmit?.({
					externalId: effectiveExternalId,
					driverIds: driverIdsValue,
					route: routeRows,
					...formValues,
				});
				onClose();
			} else {
				const detailErrors =
					Array.isArray(result.errors) && result.errors.length > 0
						? result.errors.filter(Boolean).join(". ")
						: "";
				setSubmitError(
					detailErrors ||
						result.error ||
						(isEditMode ? "Failed to update offer" : "Failed to create offer")
				);
			}
		} catch (error) {
			setSubmitError(
				error instanceof Error && error.message
					? error.message
					: isEditMode
						? "Failed to update offer"
						: "Failed to create offer"
			);
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

					{!isEditMode && (
						<input
							type="hidden"
							name="extension_load_id"
							defaultValue={initialCreateOfferFromUrl?.extensionLoadId?.trim() ?? ""}
						/>
					)}

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
									clearUrlLoadedMilesLock();
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
								onAsapToggle={handleAsapToggle}
								timePickerOpen={openTimeRowId === row.id}
								onTimePickerOpenChange={open => {
									setOpenTimeRowId(current => {
										if (open) return row.id;
										return current === row.id ? null : current;
									});
								}}
								onTimePickerComplete={() => {
									if (row.type !== "pickup") return;
									const rows = routeRowsRef.current;
									const rowIndex = rows.findIndex(item => item.id === row.id);
									if (rowIndex < 0) return;
									const delivery = rows
										.slice(rowIndex + 1)
										.find(item => item.type === "delivery" && !item.time.trim());
									if (!delivery) return;
									setOpenTimeRowId(delivery.id);
								}}
								locationError={routeRowLocationErrors[row.id]}
								minDate={getRouteStopMinDate(
									routeRows.map(r => r.time),
									index
								)}
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
							<div className="mb-1.5 flex items-center justify-between gap-2">
								<Label htmlFor="loaded-miles-field" className="mb-0">
									Loaded miles
								</Label>
								<button
									type="button"
									disabled={!googleMapsRouteUrl}
									onClick={openRouteInGoogleMaps}
									title={
										googleMapsRouteUrl
											? "Open this route in Google Maps"
											: "Fill every stop location first"
									}
									className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium text-brand-500 ring-1 ring-inset ring-brand-500/40 transition-colors hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:text-gray-400 disabled:ring-gray-300 disabled:hover:bg-transparent dark:text-brand-400 dark:disabled:text-gray-500 dark:disabled:ring-gray-700"
								>
									Check Route
								</button>
							</div>
							<div className="relative">
								<Input
									id="loaded-miles-field"
									type="text"
									inputMode={sameStopLocations ? "numeric" : undefined}
									readOnly={!sameStopLocations}
									value={
										loadedMiles != null && Number.isFinite(loadedMiles)
											? String(Math.round(loadedMiles))
											: ""
									}
									onChange={
										sameStopLocations
											? e => {
													const raw = e.target.value.replace(/[^\d]/g, "");
													if (!raw) {
														setManualLoadedMiles(null);
														return;
													}
													const parsed = Number.parseInt(raw, 10);
													setManualLoadedMiles(
														Number.isFinite(parsed) ? parsed : null
													);
												}
											: undefined
									}
									placeholder={
										sameStopLocations
											? "Enter miles"
											: "Fill all addresses and blur to calculate"
									}
									className={`${sameStopLocations ? "dark:bg-gray-900" : "cursor-not-allowed"} ${showLoadedMilesEditIcon ? "pr-11" : ""}`}
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
						<p className="whitespace-pre-line text-sm text-red-500 dark:text-red-400">
							{routeError}
						</p>
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
								error={!!errors.commodity}
								hint={errors.commodity}
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
				</div>

				<div className="flex shrink-0 flex-col gap-3 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
					{submitError ? (
						<p
							role="alert"
							className="text-sm text-red-500 dark:text-red-400"
						>
							{submitError}
						</p>
					) : null}
					<div className="flex items-center justify-end gap-3">
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
								!canSubmitOffer ||
								isSubmitting ||
								isCalculatingRoute ||
								loadedMiles == null ||
								loadedMiles === 0 ||
								Boolean(routeError) ||
								Object.keys(routeRowLocationErrors).length > 0 ||
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
