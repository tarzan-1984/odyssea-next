"use client";

import React, { useCallback, useRef } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { AddPlusCircleIcon, DragHandleIcon, RemoveMinusIcon } from "@/icons";
import type { CreateOfferRoutePoint } from "@/app-api/offers";

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
	updateRow: (index: number, location: string) => void;
	removeRow: (index: number) => void;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
	onAddRow: (afterIndex: number) => void;
	pendingDropRef: React.MutableRefObject<number | null>;
};

function DraggableBidRouteRow({
	row,
	index,
	rowCount,
	canRemove,
	updateRow,
	removeRow,
	moveRow,
	onAddRow,
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

			<div className="min-w-0 flex-1">
				<Label>{label}</Label>
				<Input
					type="text"
					value={row.location}
					onChange={e => updateRow(index, e.target.value)}
					placeholder={placeholder}
					className="dark:bg-gray-900"
				/>
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
	onChange: (rows: BidRouteRow[]) => void;
};

export default function BidRateRouteBuilder({ rows, onChange }: BidRateRouteBuilderProps) {
	const pendingDropRef = useRef<number | null>(null);

	const updateRow = useCallback(
		(index: number, location: string) => {
			onChange(
				rows.map((row, rowIndex) => (rowIndex === index ? { ...row, location } : row)),
			);
		},
		[onChange, rows],
	);

	const addRow = useCallback(
		(afterIndex: number, type: "pickup" | "delivery") => {
			const next = [...rows];
			next.splice(afterIndex + 1, 0, createBidRouteRow(type));
			onChange(next);
		},
		[onChange, rows],
	);

	const removeRow = useCallback(
		(index: number) => {
			onChange(rows.filter((_, rowIndex) => rowIndex !== index));
		},
		[onChange, rows],
	);

	const moveRow = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			const next = [...rows];
			const [removed] = next.splice(dragIndex, 1);
			next.splice(hoverIndex, 0, removed);
			onChange(next);
		},
		[onChange, rows],
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
					canRemove={
						(row.type === "pickup" && pickupCount > 1) ||
						(row.type === "delivery" && deliveryCount > 1)
					}
				/>
			))}
		</DndProvider>
	);
}
