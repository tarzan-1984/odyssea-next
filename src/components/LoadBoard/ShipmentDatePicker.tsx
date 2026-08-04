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
};

const DISPLAY_FORMAT = "m/d/Y";
const EMPTY_PLACEHOLDER = "mm/dd/yyyy";

function parseDateString(s: string): Date | null {
	const trimmed = s.trim();
	if (!trimmed) return null;
	const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;
	const month = Number.parseInt(match[1], 10);
	const day = Number.parseInt(match[2], 10);
	const year = Number.parseInt(match[3], 10);
	const d = new Date(year, month - 1, day);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

export default function ShipmentDatePicker({
	id,
	value = "",
	onChange,
	label,
	placeholder = EMPTY_PLACEHOLDER,
	className = "",
	required = false,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const fpRef = useRef<flatpickr.Instance | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!inputRef.current) return;

		const parsedDefault = value ? parseDateString(value) : null;
		const fp = flatpickr(inputRef.current, {
			enableTime: false,
			dateFormat: DISPLAY_FORMAT,
			allowInput: false,
			defaultDate: parsedDefault ?? undefined,
			onChange: selectedDates => {
				if (selectedDates[0]) {
					onChangeRef.current?.(fp.formatDate(selectedDates[0], DISPLAY_FORMAT));
				} else {
					onChangeRef.current?.("");
				}
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
		const parsed = value ? parseDateString(value) : null;
		if (parsed) {
			fpRef.current.setDate(parsed, false);
		} else {
			fpRef.current.clear();
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
