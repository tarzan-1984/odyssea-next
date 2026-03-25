"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";

type PropsType = {
	id: string;
	value?: string;
	onChange?: (value: string) => void;
	onBlur?: () => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
};

/** US-style date + 12h time, e.g. "03/24/2026 02:30 pm" (lowercased in onChange) */
const DISPLAY_FORMAT = "m/d/Y h:i K";
const EMPTY_PLACEHOLDER = "mm/dd/yyyy --:-- pm";

/** Parse "m/d/y h:mm am|pm" */
function parseDateTimeString(s: string): Date | null {
	const trimmed = s.trim();
	if (!trimmed) return null;
	const re =
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i;
	const m = trimmed.match(re);
	if (!m) return null;
	const month = parseInt(m[1], 10) - 1;
	const day = parseInt(m[2], 10);
	const year = parseInt(m[3], 10);
	let hour = parseInt(m[4], 10);
	const minute = parseInt(m[5], 10);
	const period = m[6].toLowerCase();
	if (period === "pm" && hour < 12) hour += 12;
	if (period === "am" && hour === 12) hour = 0;
	const d = new Date(year, month, day, hour, minute, 0, 0);
	if (
		d.getFullYear() !== year ||
		d.getMonth() !== month ||
		d.getDate() !== day
	) {
		return null;
	}
	return d;
}

/** Legacy time-only "h:mm am|pm" — use today's date */
function parseTimeOnlyString(s: string): Date | null {
	const trimmed = s.trim();
	if (!trimmed) return null;
	const parts = trimmed.toLowerCase().split(/\s+/);
	const timePart = parts[0] ?? "";
	const period = (parts[1] ?? "am").toLowerCase();
	const [hStr, minStr] = timePart.split(":");
	const h = parseInt(hStr, 10);
	const min = parseInt(minStr ?? "0", 10) || 0;
	if (Number.isNaN(h)) return null;
	let hour = h;
	if (period === "pm" && hour < 12) hour += 12;
	if (period === "am" && hour === 12) hour = 0;
	const d = new Date();
	d.setHours(hour, min, 0, 0);
	return d;
}

function parseOfferRouteDateTime(s: string): Date | null {
	return parseDateTimeString(s) ?? parseTimeOnlyString(s);
}

export default function DateTimePicker({
	id,
	value = "",
	onChange,
	onBlur,
	label,
	placeholder = EMPTY_PLACEHOLDER,
	className = "",
	disabled = false,
}: PropsType) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onBlurRef = useRef(onBlur);
	onBlurRef.current = onBlur;

	useEffect(() => {
		if (!inputRef.current) return;

		const fp = flatpickr(inputRef.current, {
			enableTime: true,
			noCalendar: false,
			dateFormat: DISPLAY_FORMAT,
			time_24hr: false,
			altInput: false,
			allowInput: false,
			// Initial value applied in the sync effect below (avoids stale closure on `value`)
			onOpen: () => {
				requestAnimationFrame(() => {
					const input = fp.input;
					const container = fp.calendarContainer;
					if (input && container && input.offsetWidth > 0) {
						container.style.minWidth = `${Math.max(input.offsetWidth, 280)}px`;
					}
				});
			},
			onChange: (selectedDates) => {
				if (selectedDates[0]) {
					const formatted = fp
						.formatDate(selectedDates[0], DISPLAY_FORMAT)
						.toLowerCase();
					onChangeRef.current?.(formatted);
				}
			},
			onClose: () => {
				onBlurRef.current?.();
			},
		});

		fpRef.current = fp;

		return () => {
			fp.destroy();
			fpRef.current = null;
		};
	}, [id]);

	useEffect(() => {
		if (!fpRef.current) return;
		const parsed = value ? parseOfferRouteDateTime(value) : null;
		if (parsed) {
			fpRef.current.setDate(parsed, false);
		} else {
			fpRef.current.clear();
		}
	}, [value]);

	return (
		<div className={className}>
			{label && <Label htmlFor={id}>{label}</Label>}
			<div className="relative w-full">
				<input
					ref={inputRef}
					id={id}
					type="text"
					placeholder={placeholder}
					readOnly
					disabled={disabled}
					className="h-11 w-full min-w-[7rem] rounded-lg border appearance-none px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:bg-gray-900 dark:text-white/90 dark:border-gray-700 dark:placeholder:text-white/30 dark:focus:border-brand-800 cursor-pointer"
				/>
				<span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
					<CalenderIcon className="size-5" />
				</span>
			</div>
		</div>
	);
}
