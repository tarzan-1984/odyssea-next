"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import {
	formatOfferDateTimeRange,
	parseOfferDateTimeField,
	parseOfferRouteDateTime,
} from "@/utils/offerDateTimeRange";

type PropsType = {
	id: string;
	value?: string;
	onChange?: (value: string) => void;
	onBlur?: () => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	/** Optional end time below the calendar time — stored as "start — end" */
	allowTimeRange?: boolean;
};

/** US-style date + 12h time (legacy single value) */
const DISPLAY_FORMAT = "m/d/Y h:i K";
const EMPTY_PLACEHOLDER = "mm/dd/yyyy --:-- pm";
const RANGE_PLACEHOLDER = "Select date & time (optional end below)";

function getEndTimeInputs(timeRow: HTMLElement) {
	return {
		hour: timeRow.querySelector(".flatpickr-hour") as HTMLInputElement | null,
		minute: timeRow.querySelector(".flatpickr-minute") as HTMLInputElement | null,
		ampm: timeRow.querySelector(".flatpickr-am-pm") as HTMLElement | null,
	};
}

function dateTo12hParts(d: Date): { hour: string; minute: string; period: string } {
	let h = d.getHours();
	const period = h >= 12 ? "PM" : "AM";
	h = h % 12 || 12;
	return {
		hour: String(h),
		minute: String(d.getMinutes()).padStart(2, "0"),
		period,
	};
}

function readEndTimeFromRow(timeRow: HTMLElement): Date | null {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return null;
	const hourRaw = hour.value.trim();
	const period = (ampm.textContent ?? "").trim().toUpperCase();
	if (!hourRaw || (period !== "AM" && period !== "PM")) return null;
	const hourNum = parseInt(hourRaw, 10);
	const minuteNum = parseInt(minute.value || "0", 10) || 0;
	if (Number.isNaN(hourNum)) return null;
	let h = hourNum;
	if (period === "PM" && h < 12) h += 12;
	if (period === "AM" && h === 12) h = 0;
	const d = new Date();
	d.setHours(h, minuteNum, 0, 0);
	return d;
}

function applyEndTimeToRow(timeRow: HTMLElement, end: Date | null) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;
	if (!end) {
		hour.value = "";
		hour.placeholder = "--";
		minute.value = "";
		minute.placeholder = "--";
		ampm.textContent = "—";
		return;
	}
	hour.placeholder = "";
	minute.placeholder = "";
	const parts = dateTo12hParts(end);
	hour.value = parts.hour;
	minute.value = parts.minute;
	ampm.textContent = parts.period;
}

function bindNumInput(
	wrapper: Element | null,
	input: HTMLInputElement,
	opts: { min: number; max: number },
	onChange: () => void
) {
	if (!wrapper) return;
	const adjust = (delta: number) => {
		const raw = input.value.trim();
		let v = raw === "" ? opts.min : parseInt(raw, 10);
		if (Number.isNaN(v)) v = opts.min;
		v = Math.min(opts.max, Math.max(opts.min, v + delta));
		input.value = input.classList.contains("flatpickr-minute")
			? String(v).padStart(2, "0")
			: String(v);
		onChange();
	};
	wrapper.querySelector(".arrowUp")?.addEventListener("click", e => {
		e.preventDefault();
		adjust(1);
	});
	wrapper.querySelector(".arrowDown")?.addEventListener("click", e => {
		e.preventDefault();
		adjust(-1);
	});
	input.addEventListener("change", onChange);
	input.addEventListener("input", onChange);
}

function bindEndTimeRow(timeRow: HTMLElement, onChange: () => void) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;

	const hourWrapper = hour.closest(".numInputWrapper");
	const minuteWrapper = minute.closest(".numInputWrapper");

	bindNumInput(hourWrapper, hour, { min: 1, max: 12 }, onChange);
	bindNumInput(minuteWrapper, minute, { min: 0, max: 59 }, onChange);

	ampm.addEventListener("click", e => {
		e.preventDefault();
		const current = (ampm.textContent ?? "").trim().toUpperCase();
		if (!current) {
			ampm.textContent = "AM";
		} else {
			ampm.textContent = current === "AM" ? "PM" : "AM";
		}
		onChange();
	});
}

function mountEndTimeRow(
	calendar: HTMLElement,
	initialEnd: Date | null,
	onEndChange: () => void
): HTMLElement {
	const existing = calendar.querySelector("[data-offer-datetime-end]") as HTMLElement | null;
	if (existing) {
		const timeRow = existing.querySelector(".flatpickr-time") as HTMLElement;
		if (timeRow) applyEndTimeToRow(timeRow, initialEnd);
		return existing;
	}

	const sourceTime = calendar.querySelector(".flatpickr-time");
	if (!sourceTime) {
		const fallback = document.createElement("div");
		fallback.dataset.offerDatetimeEnd = "true";
		return fallback;
	}

	const endTime = sourceTime.cloneNode(true) as HTMLElement;

	const row = document.createElement("div");
	row.dataset.offerDatetimeEnd = "true";
	row.className = "offer-datetime-end";

	const label = document.createElement("span");
	label.className = "offer-datetime-end-label";
	label.textContent = "To (optional)";

	row.append(label, endTime);

	sourceTime.parentNode?.insertBefore(row, sourceTime.nextSibling);

	bindEndTimeRow(endTime, onEndChange);
	applyEndTimeToRow(endTime, initialEnd);

	return row;
}

export default function DateTimePicker({
	id,
	value = "",
	onChange,
	onBlur,
	label,
	placeholder,
	className = "",
	disabled = false,
	allowTimeRange = false,
}: PropsType) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const endRowRef = useRef<HTMLElement | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onBlurRef = useRef(onBlur);
	onBlurRef.current = onBlur;
	const allowTimeRangeRef = useRef(allowTimeRange);
	allowTimeRangeRef.current = allowTimeRange;
	const valueRef = useRef(value);
	valueRef.current = value;

	const emitValue = (fp: flatpickr.Instance) => {
		const start = fp.selectedDates[0];
		if (!start) return;

		let formatted: string;
		if (allowTimeRangeRef.current && endRowRef.current) {
			const timeRow = endRowRef.current.querySelector(".flatpickr-time") as HTMLElement | null;
			const endParts = timeRow ? readEndTimeFromRow(timeRow) : null;
			const end =
				endParts != null
					? (() => {
							const d = new Date(start);
							d.setHours(endParts.getHours(), endParts.getMinutes(), 0, 0);
							return d;
						})()
					: null;
			formatted = formatOfferDateTimeRange(start, end);
		} else {
			formatted = fp.formatDate(start, DISPLAY_FORMAT).toLowerCase();
		}

		if (fp.input) {
			fp.input.value = formatted;
		}
		onChangeRef.current?.(formatted);
	};

	useEffect(() => {
		if (!inputRef.current) return;

		const fp = flatpickr(inputRef.current, {
			enableTime: true,
			noCalendar: false,
			dateFormat: DISPLAY_FORMAT,
			time_24hr: false,
			altInput: false,
			allowInput: false,
			onOpen: () => {
				requestAnimationFrame(() => {
					const input = fp.input;
					const container = fp.calendarContainer;
					if (input && container && input.offsetWidth > 0) {
						container.style.minWidth = `${Math.max(input.offsetWidth, 280)}px`;
					}
					if (allowTimeRangeRef.current && container) {
						const { end } = parseOfferDateTimeField(valueRef.current);
						endRowRef.current = mountEndTimeRow(container, end, () => emitValue(fp));
					}
				});
			},
			onChange: () => {
				emitValue(fp);
			},
			onClose: () => {
				onBlurRef.current?.();
			},
		});

		fpRef.current = fp;

		return () => {
			fp.destroy();
			fpRef.current = null;
			endRowRef.current = null;
		};
	}, [id]);

	useEffect(() => {
		if (!fpRef.current) return;
		const parsed = value ? parseOfferRouteDateTime(value) : null;
		if (parsed) {
			fpRef.current.setDate(parsed, false);
			if (fpRef.current.input) {
				fpRef.current.input.value = value;
			}
		} else {
			fpRef.current.clear();
		}
		if (allowTimeRange && endRowRef.current) {
			const timeRow = endRowRef.current.querySelector(".flatpickr-time") as HTMLElement | null;
			if (timeRow) {
				const { end } = parseOfferDateTimeField(value);
				applyEndTimeToRow(timeRow, end);
			}
		}
	}, [value, allowTimeRange]);

	const resolvedPlaceholder =
		placeholder ?? (allowTimeRange ? RANGE_PLACEHOLDER : EMPTY_PLACEHOLDER);

	return (
		<div className={className}>
			{label && <Label htmlFor={id}>{label}</Label>}
			<div className="relative w-full">
				<input
					ref={inputRef}
					id={id}
					type="text"
					placeholder={resolvedPlaceholder}
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
