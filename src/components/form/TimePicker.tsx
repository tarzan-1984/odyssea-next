"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { TimeIcon } from "../../icons";
import { OFFER_DATETIME_RANGE_SEP } from "@/utils/offerDateTimeRange";

type PropsType = {
	id: string;
	value?: string;
	onChange?: (value: string) => void;
	onBlur?: () => void;
	label?: string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	/** Optional end time below the picker — stored as "start — end" */
	allowTimeRange?: boolean;
};

/** Format: 12-hour with AM/PM, e.g. "02:30 pm" */
const DISPLAY_FORMAT = "h:i K";
const EMPTY_PLACEHOLDER = "-- : -- pm";
const RANGE_PLACEHOLDER = "-- : -- pm (optional end below)";

function formatTimeValue(d: Date): string {
	let hours = d.getHours();
	const period = hours >= 12 ? "pm" : "am";
	hours = hours % 12 || 12;
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes} ${period}`;
}

function formatTimeRange(start: Date, end?: Date | null): string {
	if (!end) return formatTimeValue(start);
	return `${formatTimeValue(start)}${OFFER_DATETIME_RANGE_SEP}${formatTimeValue(end)}`;
}

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

function splitTimeRange(value: string): { start: string; end: string | null } {
	const trimmed = value.trim();
	for (const sep of [OFFER_DATETIME_RANGE_SEP, " – ", " - "]) {
		if (!trimmed.includes(sep)) continue;
		const [startPart, endPart] = trimmed.split(sep).map((p) => p.trim());
		if (startPart && endPart) return { start: startPart, end: endPart };
	}
	return { start: trimmed, end: null };
}

function parseTimeField(value: string): { start: Date | null; end: Date | null } {
	const trimmed = value.trim();
	if (!trimmed) return { start: null, end: null };
	const { start, end } = splitTimeRange(trimmed);
	return {
		start: parseTimeString(start),
		end: end ? parseTimeString(end) : null,
	};
}

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
	const minuteRaw = minute.value.trim();
	const minuteNum = minuteRaw === "" ? 0 : parseInt(minuteRaw, 10);
	if (Number.isNaN(hourNum) || hourNum < 1 || hourNum > 12) return null;
	if (Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) return null;
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

function constrainTimeDigitInput(
	input: HTMLInputElement,
	opts: { min: number; max: number },
	clampToMin: boolean,
) {
	const pad = input.classList.contains("flatpickr-minute");
	const digits = input.value.replace(/\D/g, "").slice(0, 2);
	if (digits === "") {
		input.value = "";
		return;
	}
	let v = parseInt(digits, 10);
	if (Number.isNaN(v)) {
		input.value = "";
		return;
	}
	if (v > opts.max) v = opts.max;
	if (clampToMin && v < opts.min) v = opts.min;
	input.value = pad && (clampToMin || digits.length === 2) ? String(v).padStart(2, "0") : String(v);
}

function bindNumInput(
	wrapper: Element | null,
	input: HTMLInputElement,
	opts: { min: number; max: number },
	onChange: () => void,
) {
	if (!wrapper) return;

	input.type = "text";
	input.inputMode = "numeric";
	input.pattern = "[0-9]*";
	input.maxLength = 2;
	input.size = 2;
	input.autocomplete = "off";

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
	wrapper.querySelector(".arrowUp")?.addEventListener("click", (e) => {
		e.preventDefault();
		adjust(1);
	});
	wrapper.querySelector(".arrowDown")?.addEventListener("click", (e) => {
		e.preventDefault();
		adjust(-1);
	});
	input.addEventListener("input", () => {
		constrainTimeDigitInput(input, opts, false);
		onChange();
	});
	input.addEventListener("change", () => {
		constrainTimeDigitInput(input, opts, true);
		onChange();
	});
	input.addEventListener("blur", () => {
		constrainTimeDigitInput(input, opts, true);
		onChange();
	});
}

function bindEndTimeRow(timeRow: HTMLElement, onChange: () => void) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;

	const hourWrapper = hour.closest(".numInputWrapper");
	const minuteWrapper = minute.closest(".numInputWrapper");

	bindNumInput(hourWrapper, hour, { min: 1, max: 12 }, onChange);
	bindNumInput(minuteWrapper, minute, { min: 0, max: 59 }, onChange);

	ampm.addEventListener("click", (e) => {
		e.preventDefault();
		const current = (ampm.textContent ?? "").trim().toUpperCase();
		if (!current || current === "—") {
			ampm.textContent = "AM";
		} else {
			ampm.textContent = current === "AM" ? "PM" : "AM";
		}
		onChange();
	});
}

/** Same digit limits as "To", without rebinding flatpickr arrows / AM-PM. */
function bindStartTimeInputs(calendar: HTMLElement) {
	const sourceTime = Array.from(calendar.querySelectorAll(".flatpickr-time")).find(
		(el) => !el.closest("[data-offer-datetime-end]")
	) as HTMLElement | undefined;
	if (!sourceTime || sourceTime.dataset.offerStartTimeBound === "true") return;
	sourceTime.dataset.offerStartTimeBound = "true";

	const { hour, minute } = getEndTimeInputs(sourceTime);
	if (!hour || !minute) return;

	const bindDigits = (input: HTMLInputElement, opts: { min: number; max: number }) => {
		input.type = "text";
		input.inputMode = "numeric";
		input.pattern = "[0-9]*";
		input.maxLength = 2;
		input.size = 2;
		input.autocomplete = "off";
		// Capture so values are clamped before flatpickr reads them.
		input.addEventListener(
			"input",
			() => {
				constrainTimeDigitInput(input, opts, false);
			},
			true
		);
		input.addEventListener("change", () => {
			constrainTimeDigitInput(input, opts, true);
		});
		input.addEventListener("blur", () => {
			constrainTimeDigitInput(input, opts, true);
		});
	};

	bindDigits(hour, { min: 1, max: 12 });
	bindDigits(minute, { min: 0, max: 59 });
}

function mountEndTimeRow(
	calendar: HTMLElement,
	initialEnd: Date | null,
	onEndChange: () => void,
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

export default function TimePicker({
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
			const end = timeRow ? readEndTimeFromRow(timeRow) : null;
			formatted = formatTimeRange(start, end);
		} else {
			formatted = formatTimeValue(start);
		}

		if (fp.input) {
			fp.input.value = formatted;
		}
		onChangeRef.current?.(formatted);
	};

	useEffect(() => {
		if (!inputRef.current) return;

		const { start: parsedDefault } = parseTimeField(value);
		const fp = flatpickr(inputRef.current, {
			enableTime: true,
			noCalendar: true,
			dateFormat: DISPLAY_FORMAT,
			time_24hr: false,
			altInput: false,
			allowInput: false,
			// Range UI is taller — open above so it stays visible in the modal.
			position: allowTimeRange ? "above" : "auto",
			defaultDate: parsedDefault ?? undefined,
			onOpen: () => {
				requestAnimationFrame(() => {
					const input = fp.input;
					const container = fp.calendarContainer;
					if (input && container && input.offsetWidth > 0) {
						container.style.width = `${input.offsetWidth}px`;
						container.style.minWidth = `${Math.max(input.offsetWidth, 220)}px`;
					}
					if (container) {
						bindStartTimeInputs(container);
					}
					if (allowTimeRangeRef.current && container) {
						const { end } = parseTimeField(valueRef.current);
						endRowRef.current = mountEndTimeRow(container, end, () => emitValue(fp));
						// Reposition after end-row height is applied.
						(
							fp as flatpickr.Instance & { _positionCalendar?: () => void }
						)._positionCalendar?.();
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

	// Sync value from parent when it changes (e.g. form reset)
	useEffect(() => {
		if (!fpRef.current) return;
		const { start, end } = parseTimeField(value);
		if (start) {
			fpRef.current.setDate(start, false);
			if (fpRef.current.input) {
				fpRef.current.input.value = value;
			}
		} else {
			fpRef.current.clear();
		}
		if (allowTimeRange && endRowRef.current) {
			const timeRow = endRowRef.current.querySelector(".flatpickr-time") as HTMLElement | null;
			if (timeRow) applyEndTimeToRow(timeRow, end);
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
					<TimeIcon className="size-5" />
				</span>
			</div>
		</div>
	);
}
