"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import {
	formatOfferDateTimeRange,
	hour24DigitsTo12,
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
	/** Earliest selectable datetime (previous stop). Dates and times before this are disabled. */
	minDate?: Date | null;
	/** When set, the calendar opens and closes with this flag. */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Picker closed with a complete start date and time. */
	onComplete?: () => void;
	/** Render the ASAP action inside the calendar (delivery stops). */
	showAsap?: boolean;
	onAsap?: () => void;
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
	clampToMin: boolean
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
	bindDigits = true
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
		input.dataset.offerTimeCommitted = "1";
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
	if (!bindDigits) return;
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

const MISSING_CLASS = "offer-time-required-missing";

function startTimeRow(calendar: HTMLElement): HTMLElement | null {
	return (
		(Array.from(calendar.querySelectorAll(".flatpickr-time")).find(
			el => !el.closest("[data-offer-datetime-end]")
		) as HTMLElement | undefined) ?? null
	);
}

function endTimeRowEl(calendar: HTMLElement): HTMLElement | null {
	return calendar.querySelector("[data-offer-datetime-end] .flatpickr-time");
}

function clearMissingMarks(root: ParentNode) {
	root.querySelectorAll(`.${MISSING_CLASS}`).forEach(el => el.classList.remove(MISSING_CLASS));
}

function markMissing(el: HTMLElement | null) {
	if (!el) return;
	const target = el.classList.contains("flatpickr-am-pm")
		? el
		: ((el.closest(".numInputWrapper") as HTMLElement | null) ?? el);
	target.classList.add(MISSING_CLASS);
}

function focusTimeField(el: HTMLElement) {
	const input =
		el instanceof HTMLInputElement ? el : (el.querySelector("input") as HTMLInputElement | null);
	const target = input ?? el;
	target.focus();
	if (target instanceof HTMLInputElement) {
		target.select();
	}
}

function isMeridiem(value: string): boolean {
	return value === "AM" || value === "PM";
}

function rowPeriod(ampm: HTMLElement): string {
	return (ampm.textContent ?? "").trim().toUpperCase();
}

function timeRowTouched(hour: HTMLInputElement, minute: HTMLInputElement, ampm: HTMLElement): boolean {
	return hour.value.trim() !== "" || minute.value.trim() !== "" || isMeridiem(rowPeriod(ampm));
}

function firstInvalidInRow(
	hour: HTMLInputElement,
	minute: HTMLInputElement,
	ampm: HTMLElement
): HTMLElement | null {
	const hourNum = Number.parseInt(hour.value.replace(/\D/g, ""), 10);
	if (!hour.value.trim() || Number.isNaN(hourNum) || hourNum < 1 || hourNum > 12) return hour;
	const minuteNum = Number.parseInt(minute.value.replace(/\D/g, ""), 10);
	if (!minute.value.trim() || Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
		return minute;
	}
	if (!isMeridiem(rowPeriod(ampm))) return ampm;
	return null;
}

/** Start time is required. End time is required only after the user starts it. */
function firstMissingRequired(calendar: HTMLElement): HTMLElement | null {
	const start = startTimeRow(calendar);
	if (start) {
		const { hour, minute, ampm } = getEndTimeInputs(start);
		if (hour && minute && ampm) {
			const missing = firstInvalidInRow(hour, minute, ampm);
			if (missing) return missing;
		}
	}
	const end = endTimeRowEl(calendar);
	if (end) {
		const { hour, minute, ampm } = getEndTimeInputs(end);
		if (hour && minute && ampm && timeRowTouched(hour, minute, ampm)) {
			return firstInvalidInRow(hour, minute, ampm);
		}
	}
	return null;
}

function clearTimeRow(timeRow: HTMLElement) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;
	hour.value = "";
	hour.placeholder = "--";
	minute.value = "";
	minute.placeholder = "--";
	ampm.textContent = "—";
	delete hour.dataset.offerTimeCommitted;
	delete minute.dataset.offerTimeCommitted;
}

function markRowCommitted(timeRow: HTMLElement) {
	const { hour, minute } = getEndTimeInputs(timeRow);
	if (hour) hour.dataset.offerTimeCommitted = "1";
	if (minute) minute.dataset.offerTimeCommitted = "1";
}

/** Returns true when two digits formed a valid 00–23 hour. */
function applyHour24Input(input: HTMLInputElement, ampm: HTMLElement | null): boolean {
	const digits = input.value.replace(/\D/g, "").slice(0, 2);
	input.value = digits;
	if (digits.length < 2) {
		delete input.dataset.offerTimeCommitted;
		if (digits.length === 0 && ampm) ampm.textContent = "—";
		return false;
	}
	const converted = hour24DigitsTo12(digits);
	if (!converted) return false;
	input.value = converted.hour12;
	input.dataset.offerTimeCommitted = "1";
	if (ampm) ampm.textContent = converted.period;
	return true;
}

function applyMinuteDigits(input: HTMLInputElement): "partial" | "ok" | "invalid" {
	const digits = input.value.replace(/\D/g, "").slice(0, 2);
	input.value = digits;
	if (digits.length < 2) return "partial";
	const minute = Number.parseInt(digits, 10);
	if (minute > 59) return "invalid";
	input.value = String(minute).padStart(2, "0");
	input.dataset.offerTimeCommitted = "1";
	return "ok";
}

function focusFirstMissing(calendar: HTMLElement) {
	clearMissingMarks(calendar);
	const missing = firstMissingRequired(calendar);
	if (!missing) return;
	markMissing(missing);
	focusTimeField(missing);
}

function focusAfterStartMinute(calendar: HTMLElement) {
	const start = startTimeRow(calendar);
	if (start) {
		const { hour, minute, ampm } = getEndTimeInputs(start);
		if (hour && minute && ampm) {
			const missing = firstInvalidInRow(hour, minute, ampm);
			if (missing) {
				clearMissingMarks(calendar);
				markMissing(missing);
				focusTimeField(missing);
				return;
			}
		}
	}
	const endHour = endTimeRowEl(calendar)?.querySelector(".flatpickr-hour") as HTMLInputElement | null;
	if (endHour) focusTimeField(endHour);
}

function bindHourMinuteAdvance(
	calendar: HTMLElement,
	timeRow: HTMLElement,
	onCommit: () => void,
	afterMinute: () => void
) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;

	const prepare = (input: HTMLInputElement) => {
		input.type = "text";
		input.inputMode = "numeric";
		input.pattern = "[0-9]*";
		input.maxLength = 2;
		input.size = 2;
		input.autocomplete = "off";
	};
	prepare(hour);
	prepare(minute);

	hour.addEventListener(
		"input",
		() => {
			clearMissingMarks(calendar);
			const ready = applyHour24Input(hour, ampm);
			if (hour.value.replace(/\D/g, "").length < 2) return;
			if (!ready) {
				markMissing(hour);
				return;
			}
			onCommit();
			focusTimeField(minute);
		},
		true
	);
	minute.addEventListener(
		"input",
		() => {
			clearMissingMarks(calendar);
			const status = applyMinuteDigits(minute);
			if (status === "partial") return;
			if (status === "invalid") {
				markMissing(minute);
				return;
			}
			onCommit();
			afterMinute();
		},
		true
	);
	// Flatpickr writes 12:00 AM when an empty hour blurs. Put the placeholder back
	// unless the user actually committed two digits.
	hour.addEventListener("blur", () => {
		if (hour.dataset.offerTimeCommitted === "1") return;
		hour.value = "";
		hour.placeholder = "--";
	});
	minute.addEventListener("blur", () => {
		if (minute.dataset.offerTimeCommitted === "1") return;
		minute.value = "";
		minute.placeholder = "--";
	});
}

function bindEndTimeRow(timeRow: HTMLElement, onChange: () => void) {
	const { hour, minute, ampm } = getEndTimeInputs(timeRow);
	if (!hour || !minute || !ampm) return;

	const hourWrapper = hour.closest(".numInputWrapper");
	const minuteWrapper = minute.closest(".numInputWrapper");
	const calendar = timeRow.closest(".flatpickr-calendar") as HTMLElement | null;

	bindNumInput(hourWrapper, hour, { min: 1, max: 12 }, onChange, false);
	bindNumInput(minuteWrapper, minute, { min: 0, max: 59 }, onChange, false);

	if (calendar) {
		bindHourMinuteAdvance(calendar, timeRow, onChange, () => {
			const missing = firstInvalidInRow(hour, minute, ampm);
			if (missing) {
				clearMissingMarks(calendar);
				markMissing(missing);
				focusTimeField(missing);
			}
		});
	}

	ampm.addEventListener("click", e => {
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

/** 24-hour typing on the flatpickr start row, without rebinding its arrows. */
function bindStartTimeInputs(calendar: HTMLElement, onCommit: () => void) {
	const sourceTime = startTimeRow(calendar);
	if (!sourceTime || sourceTime.dataset.offerStartTimeBound === "true") return;
	sourceTime.dataset.offerStartTimeBound = "true";
	bindHourMinuteAdvance(calendar, sourceTime, onCommit, () => focusAfterStartMinute(calendar));
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

function applyRowOntoDate(
	date: Date,
	hour: HTMLInputElement,
	minute: HTMLInputElement,
	ampm: HTMLElement
) {
	const hourNum = Number.parseInt(hour.value, 10);
	const minuteNum = Number.parseInt(minute.value, 10);
	if (Number.isNaN(hourNum) || Number.isNaN(minuteNum) || !isMeridiem(rowPeriod(ampm))) return;
	let h = hourNum % 12;
	if (rowPeriod(ampm) === "PM") h += 12;
	if (rowPeriod(ampm) === "AM" && hourNum === 12) h = 0;
	date.setHours(h, minuteNum, 0, 0);
}

function mountAsapButton(calendar: HTMLElement, onAsap: () => void) {
	if (calendar.querySelector("[data-offer-datetime-asap]")) return;
	const row = document.createElement("div");
	row.dataset.offerDatetimeAsap = "true";
	row.className = "offer-datetime-asap";
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "offer-datetime-asap-btn";
	btn.textContent = "ASAP";
	btn.addEventListener("mousedown", event => event.stopPropagation());
	btn.addEventListener("click", event => {
		event.preventDefault();
		event.stopPropagation();
		onAsap();
	});
	row.append(btn);
	const months = calendar.querySelector(".flatpickr-months");
	if (months?.parentNode) {
		months.parentNode.insertBefore(row, months.nextSibling);
	} else {
		calendar.prepend(row);
	}
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
	minDate = null,
	open,
	onOpenChange,
	onComplete,
	showAsap = false,
	onAsap,
}: PropsType) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const endRowRef = useRef<HTMLElement | null>(null);
	const asapCloseRef = useRef(false);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onBlurRef = useRef(onBlur);
	onBlurRef.current = onBlur;
	const onOpenChangeRef = useRef(onOpenChange);
	onOpenChangeRef.current = onOpenChange;
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;
	const onAsapRef = useRef(onAsap);
	onAsapRef.current = onAsap;
	const showAsapRef = useRef(showAsap);
	showAsapRef.current = showAsap;
	const allowTimeRangeRef = useRef(allowTimeRange);
	allowTimeRangeRef.current = allowTimeRange;
	const valueRef = useRef(value);
	valueRef.current = value;
	const minDateRef = useRef<Date | null>(minDate);
	minDateRef.current = minDate;
	const minDateMs = minDate?.getTime() ?? null;

	const emitValue = (fp: flatpickr.Instance) => {
		const start = fp.selectedDates[0];
		const container = fp.calendarContainer;
		const startRow = container ? startTimeRow(container) : null;
		const fields = startRow ? getEndTimeInputs(startRow) : null;
		const timeReady =
			fields?.hour?.dataset.offerTimeCommitted === "1" &&
			fields?.minute?.dataset.offerTimeCommitted === "1" &&
			fields.ampm != null &&
			isMeridiem(rowPeriod(fields.ampm));
		if (!start || !fields?.hour || !fields.minute || !fields.ampm || !timeReady) {
			if (start && fp.input) {
				fp.input.value = fp.formatDate(start, "m/d/Y");
			}
			return;
		}

		applyRowOntoDate(start, fields.hour, fields.minute, fields.ampm);

		let formatted: string;
		if (allowTimeRangeRef.current && endRowRef.current) {
			const timeRow = endRowRef.current.querySelector(".flatpickr-time") as HTMLElement | null;
			const endFields = timeRow ? getEndTimeInputs(timeRow) : null;
			const endReady =
				endFields?.hour?.dataset.offerTimeCommitted === "1" &&
				endFields?.minute?.dataset.offerTimeCommitted === "1";
			const endParts = endReady && timeRow ? readEndTimeFromRow(timeRow) : null;
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
			minDate: minDateRef.current ?? undefined,
			onOpen: () => {
				onOpenChangeRef.current?.(true);
				requestAnimationFrame(() => {
					const input = fp.input;
					const container = fp.calendarContainer;
					if (input && container && input.offsetWidth > 0) {
						container.style.minWidth = `${Math.max(input.offsetWidth, 280)}px`;
					}
					if (!container) return;
					bindStartTimeInputs(container, () => emitValue(fp));
					const hasValue = Boolean(parseOfferRouteDateTime(valueRef.current));
					const start = startTimeRow(container);
					const hour = start ? getEndTimeInputs(start).hour : null;
					const alreadyCommitted = hour?.dataset.offerTimeCommitted === "1";
					if (hasValue && start) {
						markRowCommitted(start);
					} else if (start && !alreadyCommitted) {
						clearTimeRow(start);
						if (hour) {
							markMissing(hour);
							focusTimeField(hour);
						}
					}
					if (showAsapRef.current) {
						mountAsapButton(container, () => {
							asapCloseRef.current = true;
							onAsapRef.current?.();
							fp.close();
						});
					}
					if (allowTimeRangeRef.current) {
						const { end } = parseOfferDateTimeField(valueRef.current);
						endRowRef.current = mountEndTimeRow(container, end, () => emitValue(fp));
					}
					const min = minDateRef.current;
					if (!fp.selectedDates[0] && min) {
						fp.jumpToDate(min, false);
					}
				});
			},
			onChange: () => {
				const container = fp.calendarContainer;
				const start = container ? startTimeRow(container) : null;
				const hour = start ? getEndTimeInputs(start).hour : null;
				if (start && hour && hour.dataset.offerTimeCommitted !== "1") {
					clearTimeRow(start);
					markMissing(hour);
				}
				emitValue(fp);
			},
			onClose: () => {
				if (asapCloseRef.current) {
					asapCloseRef.current = false;
					onOpenChangeRef.current?.(false);
					return;
				}
				const container = fp.calendarContainer;
				const missing = container ? firstMissingRequired(container) : null;
				const started =
					fp.selectedDates.length > 0 ||
					Boolean(
						container &&
							startTimeRow(container) &&
							getEndTimeInputs(startTimeRow(container)!).hour?.dataset.offerTimeCommitted ===
								"1"
					);
				if (missing && started && container) {
					window.setTimeout(() => {
						if (!fp.isOpen) fp.open();
						focusFirstMissing(container);
					}, 0);
					return;
				}
				if (!missing && fp.selectedDates.length > 0) {
					emitValue(fp);
					onCompleteRef.current?.();
				}
				onOpenChangeRef.current?.(false);
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
		const fp = fpRef.current;
		if (!fp || open === undefined) return;
		if (open && !fp.isOpen) fp.open();
		if (!open && fp.isOpen) fp.close();
	}, [open]);

	useEffect(() => {
		if (!fpRef.current) return;
		fpRef.current.set("minDate", minDateMs != null ? new Date(minDateMs) : undefined);
	}, [minDateMs]);

	useEffect(() => {
		if (!fpRef.current) return;
		if (fpRef.current.isOpen) {
			if (value && fpRef.current.input) {
				fpRef.current.input.value = value;
			}
			if (allowTimeRange && endRowRef.current) {
				const timeRow = endRowRef.current.querySelector(".flatpickr-time") as HTMLElement | null;
				if (timeRow) {
					const { end } = parseOfferDateTimeField(value);
					applyEndTimeToRow(timeRow, end);
				}
			}
			return;
		}
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
