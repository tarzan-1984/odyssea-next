"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { TimeIcon } from "../../icons";

type PropsType = {
	id: string;
	value?: string;
	onChange?: (value: string) => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
};

/** Format: 12-hour with AM/PM, e.g. "02:30 pm" */
const DISPLAY_FORMAT = "h:i K";
const EMPTY_PLACEHOLDER = "-- : -- pm";

/** Parse "2:30 pm" or "02:30 PM" to Date */
function parseTimeString(s: string): Date | null {
	const trimmed = s.trim();
	if (!trimmed) return null;
	const parts = trimmed.toLowerCase().split(/\s+/);
	const timePart = parts[0] ?? "";
	const period = parts[1] ?? "am";
	const [h, m] = timePart.split(":").map((x) => parseInt(x, 10) || 0);
	if (Number.isNaN(h)) return null;
	let hour = h;
	if (period === "pm" && hour < 12) hour += 12;
	if (period === "am" && hour === 12) hour = 0;
	const d = new Date();
	d.setHours(hour, m, 0, 0);
	return d;
}

export default function TimePicker({
	id,
	value = "",
	onChange,
	label,
	placeholder = EMPTY_PLACEHOLDER,
	className = "",
	disabled = false,
}: PropsType) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!inputRef.current) return;

		const parsedDefault = value ? parseTimeString(value) : null;
		const fp = flatpickr(inputRef.current, {
			enableTime: true,
			noCalendar: true,
			dateFormat: DISPLAY_FORMAT,
			time_24hr: false,
			altInput: false,
			allowInput: false,
			defaultDate: parsedDefault ?? undefined,
			onOpen: () => {
				requestAnimationFrame(() => {
					const input = fp.input;
					const container = fp.calendarContainer;
					if (input && container && input.offsetWidth > 0) {
						container.style.width = `${input.offsetWidth}px`;
						container.style.minWidth = `${input.offsetWidth}px`;
					}
				});
			},
			onChange: (selectedDates) => {
				if (selectedDates[0]) {
					const formatted = fp.formatDate(selectedDates[0], DISPLAY_FORMAT).toLowerCase();
					onChangeRef.current?.(formatted);
				}
			},
		});

		fpRef.current = fp;

		return () => {
			fp.destroy();
			fpRef.current = null;
		};
	}, [id]);

	// Sync value from parent when it changes (e.g. form reset)
	useEffect(() => {
		if (!fpRef.current) return;
		const parsed = value ? parseTimeString(value) : null;
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
					<TimeIcon className="size-5" />
				</span>
			</div>
		</div>
	);
}
