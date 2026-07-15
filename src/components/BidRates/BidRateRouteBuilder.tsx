"use client";

import React, { useCallback, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { AddPlusCircleIcon, DragHandleIcon, RemoveMinusIcon } from "@/icons";
import offers, { type CreateOfferRoutePoint } from "@/app-api/offers";
import {
	isValidLocationFormat,
	LOCATION_FORMAT_ERROR,
	needsLocationGeocode,
	normalizeLocationForGeocode,
} from "@/utils/offerLocationFormat";

const DND_BID_ROUTE_ROW_TYPE = "BID_ROUTE_ROW";

export type BidRouteRow = {
	id: string;
	type: "pickup" | "delivery";
	location: string;
};

export function createBidRouteRow(type: "pickup" | "delivery"): BidRouteRow {
	return {
		id: `bid-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		type,
		location: "",
	};
}

export const initialBidRouteRows = (): BidRouteRow[] => [
	createBidRouteRow("pickup"),
	createBidRouteRow("delivery"),
];

export function validateBidRouteRows(rows: BidRouteRow[]): string | null {
	if (rows.length < 2) {
		return "Add at least one Origin and one Destination";
	}

	const pickupCount = rows.filter(row => row.type === "pickup").length;
	const deliveryCount = rows.filter(row => row.type === "delivery").length;

	if (pickupCount < 1 || deliveryCount < 1) {
		return "At least one Origin and one Destination are required";
	}

	const first = rows[0];
	const last = rows[rows.length - 1];

	if (first.type !== "pickup") {
		return "The first stop must be Origin";
	}
	if (last.type !== "delivery") {
		return "The last stop must be Destination";
	}
	if (rows.some(row => !row.location.trim())) {
		return "Each stop must have a location";
	}
	if (rows.some(row => !isValidLocationFormat(row.location.trim()))) {
		return LOCATION_FORMAT_ERROR;
	}

	return null;
}

/** Same payload shape as offers.route (time left empty for bid rates). */
export function bidRouteRowsToPayload(rows: BidRouteRow[]): CreateOfferRoutePoint[] {
	return rows.map(row => ({
		type: row.type === "pickup" ? "pick_up_location" : "delivery_location",
		location: row.location.trim(),
		time: "",
	}));
}

type DraggableBidRouteRowProps = {
	row: BidRouteRow;
	index: number;
	rowCount: number;
	canRemove: boolean;
	locationError?: string;
	updateRow: (index: number, location: string) => void;
	removeRow: (index: number) => void;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
	onAddRow: (afterIndex: number) => void;
	onAddressBlur: (index: number, location: string, rowId: string) => void;
	onLocationChange: (rowId: string) => void;
	pendingDropRef: React.MutableRefObject<number | null>;
};

function DraggableBidRouteRow({
	row,
	index,
	rowCount,
	canRemove,
	locationError,
	updateRow,
	removeRow,
	moveRow,
	onAddRow,
	onAddressBlur,
	onLocationChange,
	pendingDropRef,
}: DraggableBidRouteRowProps) {
	const rowRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLDivElement>(null);

	const [{ isDragging }, drag, dragPreview] = useDrag({
		type: DND_BID_ROUTE_ROW_TYPE,
		item: () => ({ index, type: row.type }),
		collect: monitor => ({ isDragging: monitor.isDragging() }),
	});

	const [{ isOver, dragIndex }, drop] = useDrop({
		accept: DND_BID_ROUTE_ROW_TYPE,
		collect: monitor => {
			const item = monitor.getItem() as { index: number; type?: "pickup" | "delivery" } | null;
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

	drop(rowRef);
	if (rowCount > 2) {
		drag(handleRef);
		dragPreview(rowRef);
	}

	const label = row.type === "pickup" ? "Origin" : "Destination";
	const placeholder =
		row.type === "pickup" ? "Enter origin location" : "Enter destination location";

	return (
		<div
			ref={rowRef}
			className="relative mt-2 flex flex-col gap-4 sm:flex-row sm:items-end"
			style={{
				opacity: isDragging ? 0 : 1,
				pointerEvents: isDragging ? "none" : undefined,
			}}
		>
			{isOver && (
				<div
					className={`absolute left-0 right-0 z-10 h-1 rounded-full bg-blue-500 ${
						dragIndex != null && dragIndex < index ? "bottom-0 translate-y-1" : "-top-1"
					}`}
					aria-hidden
				/>
			)}

			{rowCount > 2 && (
				<div
					ref={handleRef}
					className="hidden h-11 w-11 shrink-0 cursor-grab items-center justify-center self-end rounded-lg border border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 active:cursor-grabbing dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-500 dark:hover:text-gray-300 sm:flex"
					aria-label="Drag to reorder"
				>
					<DragHandleIcon />
				</div>
			)}

			<button
				type="button"
				className="shrink-0 self-end border-0 bg-transparent p-0 text-green-500 transition-colors hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
				onClick={() => onAddRow(index)}
				aria-label={row.type === "pickup" ? "Add origin stop" : "Add destination stop"}
			>
				<AddPlusCircleIcon className="h-11 w-11" />
			</button>

			<div className="relative min-w-0 flex-1">
				<Label>{label}</Label>
				<Input
					type="text"
					value={row.location}
					onChange={e => {
						updateRow(index, e.target.value);
						onLocationChange(row.id);
					}}
					onBlur={() => onAddressBlur(index, row.location, row.id)}
					placeholder={placeholder}
					className="dark:bg-gray-900"
					error={Boolean(locationError)}
				/>
				{locationError ? (
					<p className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-red-500 dark:text-red-400">
						{locationError}
					</p>
				) : null}
			</div>

			{canRemove && (
				<button
					type="button"
					className="shrink-0 self-end border-0 bg-transparent p-0 text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
					onClick={() => removeRow(index)}
					aria-label={row.type === "pickup" ? "Remove origin row" : "Remove destination row"}
				>
					<RemoveMinusIcon className="h-11 w-11" />
				</button>
			)}
		</div>
	);
}

type BidRateRouteBuilderProps = {
	rows: BidRouteRow[];
	onChange: React.Dispatch<React.SetStateAction<BidRouteRow[]>>;
	/** Fired when all stops are filled/valid (after blur, add/remove/move). Empty array when incomplete. */
	onLocationsCommit?: (locations: string[]) => void;
};

function commitLocationsFromRows(
	rows: BidRouteRow[],
	onLocationsCommit?: (locations: string[]) => void,
) {
	if (!onLocationsCommit) return;
	const allFilled = rows.every(row => row.location.trim() !== "");
	const allValid = rows.every(row => isValidLocationFormat(row.location.trim()));
	if (!allFilled || !allValid || rows.length < 2) {
		onLocationsCommit([]);
		return;
	}
	onLocationsCommit(rows.map(row => row.location.trim()));
}

export default function BidRateRouteBuilder({
	rows,
	onChange,
	onLocationsCommit,
}: BidRateRouteBuilderProps) {
	const pendingDropRef = useRef<number | null>(null);
	const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});

	const updateRow = useCallback(
		(index: number, location: string) => {
			onChange(prev =>
				prev.map((row, rowIndex) => (rowIndex === index ? { ...row, location } : row)),
			);
		},
		[onChange],
	);

	const addRow = useCallback(
		(afterIndex: number, type: "pickup" | "delivery") => {
			onChange(prev => {
				const next = [...prev];
				next.splice(afterIndex + 1, 0, createBidRouteRow(type));
				commitLocationsFromRows(next, onLocationsCommit);
				return next;
			});
		},
		[onChange, onLocationsCommit],
	);

	const removeRow = useCallback(
		(index: number) => {
			onChange(prev => {
				const removed = prev[index];
				if (removed) {
					setLocationErrors(errors => {
						const next = { ...errors };
						delete next[removed.id];
						return next;
					});
				}
				const next = prev.filter((_, rowIndex) => rowIndex !== index);
				commitLocationsFromRows(next, onLocationsCommit);
				return next;
			});
		},
		[onChange, onLocationsCommit],
	);

	const moveRow = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			onChange(prev => {
				const next = [...prev];
				const [removed] = next.splice(dragIndex, 1);
				next.splice(hoverIndex, 0, removed);
				commitLocationsFromRows(next, onLocationsCommit);
				return next;
			});
		},
		[onChange, onLocationsCommit],
	);

	const onLocationChange = useCallback((rowId: string) => {
		setLocationErrors(prev => {
			if (!prev[rowId]) return prev;
			const next = { ...prev };
			delete next[rowId];
			return next;
		});
	}, []);

	const onAddressBlur = useCallback(
		async (index: number, location: string, rowId: string) => {
			const trimmed = location.trim();
			if (!trimmed) {
				setLocationErrors(prev => {
					const next = { ...prev };
					delete next[rowId];
					return next;
				});
				onChange(current => {
					commitLocationsFromRows(current, onLocationsCommit);
					return current;
				});
				return;
			}

			if (!isValidLocationFormat(trimmed)) {
				setLocationErrors(prev => ({ ...prev, [rowId]: LOCATION_FORMAT_ERROR }));
				onLocationsCommit?.([]);
				return;
			}

			setLocationErrors(prev => {
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
				onChange(prev => {
					const next = [...prev];
					if (next[index]?.id === rowId) {
						next[index] = { ...next[index], location: finalAddress };
					} else {
						const foundIndex = next.findIndex(row => row.id === rowId);
						if (foundIndex >= 0) {
							next[foundIndex] = {
								...next[foundIndex],
								location: finalAddress,
							};
						}
					}
					return next;
				});
			}

			// Commit after geocode so distance calc uses the final address
			setTimeout(() => {
				onChange(current => {
					commitLocationsFromRows(current, onLocationsCommit);
					return current;
				});
			}, 0);
		},
		[onChange, onLocationsCommit],
	);

	const pickupCount = rows.filter(row => row.type === "pickup").length;
	const deliveryCount = rows.filter(row => row.type === "delivery").length;

	return (
		<DndProvider backend={HTML5Backend}>
			{rows.map((row, index) => (
				<DraggableBidRouteRow
					key={row.id}
					row={row}
					index={index}
					rowCount={rows.length}
					updateRow={updateRow}
					removeRow={removeRow}
					moveRow={moveRow}
					pendingDropRef={pendingDropRef}
					onAddRow={afterIndex => addRow(afterIndex, row.type)}
					onAddressBlur={onAddressBlur}
					onLocationChange={onLocationChange}
					locationError={locationErrors[row.id]}
					canRemove={
						(row.type === "pickup" && pickupCount > 1) ||
						(row.type === "delivery" && deliveryCount > 1)
					}
				/>
			))}
		</DndProvider>
	);
}
