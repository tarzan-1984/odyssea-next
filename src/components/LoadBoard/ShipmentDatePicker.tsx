"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "@/components/form/Label";
import { CalenderIcon } from "@/icons";

type Props = {
	id: string;
	value?: string;
	onChange?: (value: string) => void;
	label?: string;
	placeholder?: string;
	className?: string;
	required?: boolean;
	/** Disallow selecting calendar days before this date (local midnight). Default: today. */
	minDate?: Date | "today" | null;
};

const DISPLAY_FORMAT = "m/d/Y";
const EMPTY_PLACEHOLDER = "mm/dd/yyyy";

function startOfLocalDay(d: Date = new Date()): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateString(s: string): Date | null {
	const trimmed = s.trim();
	if (!trimmed) return null;

	// mm/dd/yyyy or m/d/yyyy (with optional leading zeros)
	const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (us) {
		const month = Number.parseInt(us[1], 10);
		const day = Number.parseInt(us[2], 10);
		const year = Number.parseInt(us[3], 10);
		const d = new Date(year, month - 1, day);
		if (
			!Number.isNaN(d.getTime()) &&
			d.getFullYear() === year &&
			d.getMonth() === month - 1 &&
			d.getDate() === day
		) {
			return d;
		}
		return null;
	}

	// yyyy-mm-dd (ISO date only)
	const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (iso) {
		const year = Number.parseInt(iso[1], 10);
		const month = Number.parseInt(iso[2], 10);
		const day = Number.parseInt(iso[3], 10);
		const d = new Date(year, month - 1, day);
		if (
			!Number.isNaN(d.getTime()) &&
			d.getFullYear() === year &&
			d.getMonth() === month - 1 &&
			d.getDate() === day
		) {
			return d;
		}
	}

	return null;
}

export default function ShipmentDatePicker({
	id,
	value = "",
	onChange,
	label,
	placeholder = EMPTY_PLACEHOLDER,
	className = "",
	required = false,
	minDate = "today",
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!inputRef.current) return;

		const parsedDefault = value ? parseDateString(value) : null;
		const resolvedMinDate =
			minDate === "today"
				? startOfLocalDay()
				: minDate instanceof Date
					? startOfLocalDay(minDate)
					: undefined;
		const fp = flatpickr(inputRef.current, {
			enableTime: false,
			dateFormat: DISPLAY_FORMAT,
			allowInput: false,
			defaultDate: parsedDefault ?? undefined,
			...(resolvedMinDate ? { minDate: resolvedMinDate } : {}),
			// Only emit when user picks a date. Do not emit "" on clear/destroy —
			// that was wiping prefilled edit form values (unlike TimePicker).
			onChange: selectedDates => {
				if (!selectedDates[0]) return;
				onChangeRef.current?.(fp.formatDate(selectedDates[0], DISPLAY_FORMAT));
			},
		});

		fpRef.current = fp;

		return () => {
			fp.destroy();
			fpRef.current = null;
		};
		// value is synced below; parent may remount via key after form prefill.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, minDate]);

	useEffect(() => {
		if (!fpRef.current) return;
		const parsed = value ? parseDateString(value) : null;
		if (parsed) {
			fpRef.current.setDate(parsed, false);
		} else {
			// clear(false) = do not fire onChange
			fpRef.current.clear(false);
		}
	}, [value]);

	return (
		<div className={className}>
			{label && (
				<Label htmlFor={id}>
					{label}
					{required ? <span className="text-error-500"> *</span> : null}
				</Label>
			)}
			<div className="relative w-full">
				<input
					ref={inputRef}
					id={id}
					type="text"
					placeholder={placeholder}
					readOnly
					className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:bg-gray-900 dark:text-white/90 dark:border-gray-700 dark:placeholder:text-white/30 dark:focus:border-brand-800 cursor-pointer"
				/>
				<span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
					<CalenderIcon className="size-6" />
				</span>
			</div>
		</div>
	);
}
