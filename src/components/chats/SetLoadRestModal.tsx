"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import TimePicker from "@/components/form/TimePicker";
import ShipmentDatePicker from "@/components/LoadBoard/ShipmentDatePicker";
import { formatNyWallClockSqlString, parseNaiveNyDateTime } from "@/utils/nyWallClock";

const MIN_REST_LEAD_MS = 60_000;
const REST_END_TOO_SOON_MESSAGE =
	"End date and time must be at least 1 minute in the future.";

function combineRestEndDateTime(endDate: string, endTime: string): Date | null {
	const dateMatch = endDate.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
		?? endDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!dateMatch) return null;

	const isIso = dateMatch[0].includes("-");
	const year = Number(isIso ? dateMatch[1] : dateMatch[3]);
	const month = Number(isIso ? dateMatch[2] : dateMatch[1]);
	const day = Number(isIso ? dateMatch[3] : dateMatch[2]);

	const timeMatch = endTime.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
	if (!timeMatch) return null;
	let hours = Number(timeMatch[1]);
	const minutes = Number(timeMatch[2]);
	const period = timeMatch[3];
	if (period === "pm" && hours < 12) hours += 12;
	if (period === "am" && hours === 12) hours = 0;

	return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

function nowNyNaive(): Date | null {
	return parseNaiveNyDateTime(formatNyWallClockSqlString(new Date()));
}

function nyTodayAsLocalDate(): Date {
	const ny = nowNyNaive();
	if (!ny) return new Date();
	return new Date(ny.getUTCFullYear(), ny.getUTCMonth(), ny.getUTCDate());
}

function isRestEndAtLeastOneMinuteAhead(restDate: Date, now = nowNyNaive()): boolean {
	if (!now) return false;
	return restDate.getTime() - now.getTime() >= MIN_REST_LEAD_MS;
}

type SetLoadRestModalProps = {
	isOpen: boolean;
	onClose: () => void;
	loadId?: string | null;
	isRest?: boolean;
	restDate?: string | null;
	onSaved?: (update: {
		isRest: boolean;
		restDate?: string | null;
		restStartedAt?: string | null;
	}) => void;
};

function restDateToPickerValues(iso: string | null | undefined): {
	endDate: string;
	endTime: string;
} {
	if (!iso?.trim()) return { endDate: "", endTime: "" };
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return { endDate: "", endTime: "" };

	const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
	const day = String(parsed.getUTCDate()).padStart(2, "0");
	const year = parsed.getUTCFullYear();
	let hours = parsed.getUTCHours();
	const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
	const period = hours >= 12 ? "pm" : "am";
	hours = hours % 12 || 12;

	return {
		endDate: `${month}/${day}/${year}`,
		endTime: `${hours}:${minutes} ${period}`,
	};
}

export default function SetLoadRestModal({
	isOpen,
	onClose,
	loadId,
	isRest = false,
	restDate = null,
	onSaved,
}: SetLoadRestModalProps) {
	const [endDate, setEndDate] = useState("");
	const [endTime, setEndTime] = useState("");
	const [submitting, setSubmitting] = useState<"save" | "remove" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [minCalendarDate, setMinCalendarDate] = useState(nyTodayAsLocalDate);

	useEffect(() => {
		if (!isOpen) return;
		const prefilled = isRest ? restDateToPickerValues(restDate) : { endDate: "", endTime: "" };
		setEndDate(prefilled.endDate);
		setEndTime(prefilled.endTime);
		setError(null);
		setSubmitting(null);
		setMinCalendarDate(nyTodayAsLocalDate());
	}, [isOpen, loadId, isRest, restDate]);

	const restEndDateTime = useMemo(
		() => combineRestEndDateTime(endDate, endTime),
		[endDate, endTime],
	);
	const restEndTooSoon =
		restEndDateTime != null && !isRestEndAtLeastOneMinuteAhead(restEndDateTime);
	const canSaveRest = restEndDateTime != null && !restEndTooSoon;

	async function saveRest() {
		const trimmedLoadId = loadId?.trim() ?? "";
		if (!trimmedLoadId) {
			setError("Load id is missing.");
			return;
		}
		if (!endDate.trim()) {
			setError("End date is required.");
			return;
		}
		if (!endTime.trim()) {
			setError("End time is required.");
			return;
		}
		const restEnd = combineRestEndDateTime(endDate, endTime);
		if (!restEnd || !isRestEndAtLeastOneMinuteAhead(restEnd)) {
			setError(REST_END_TOO_SOON_MESSAGE);
			return;
		}

		setSubmitting("save");
		try {
			const response = await fetch(
				`/api/loads/${encodeURIComponent(trimmedLoadId)}/rest`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						endDate: endDate.trim(),
						endTime: endTime.trim(),
					}),
				},
			);
			const json = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
				restDate?: string | null;
				restStartedAt?: string | null;
			};
			if (!response.ok) {
				setError(json.error || json.message || "Failed to set rest state.");
				return;
			}
			onSaved?.({
				isRest: true,
				restDate: json.restDate ?? null,
				restStartedAt: json.restStartedAt ?? null,
			});
			onClose();
		} catch {
			setError("Failed to set rest state.");
		} finally {
			setSubmitting(null);
		}
	}

	async function removeRest() {
		const trimmedLoadId = loadId?.trim() ?? "";
		if (!trimmedLoadId) {
			setError("Load id is missing.");
			return;
		}

		setSubmitting("remove");
		try {
			const response = await fetch(
				`/api/loads/${encodeURIComponent(trimmedLoadId)}/rest/remove`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
				},
			);
			const json = (await response.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
			};
			if (!response.ok) {
				setError(json.error || json.message || "Failed to exit rest state.");
				return;
			}
			onSaved?.({ isRest: false, restDate: null, restStartedAt: null });
			onClose();
		} catch {
			setError("Failed to exit rest state.");
		} finally {
			setSubmitting(null);
		}
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setError(null);
		await saveRest();
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					{isRest ? "Rest state" : "Set rest state"}
				</h2>

				<div className="mt-5 space-y-4">
					<ShipmentDatePicker
						key={`rest-date-${isOpen}-${restDate ?? "new"}`}
						id="set-rest-end-date"
						label="End date"
						value={endDate}
						onChange={(value) => {
							setEndDate(value);
							setError(null);
						}}
						required
						associateLabel={false}
						minDate={minCalendarDate}
					/>
					<TimePicker
						key={`rest-time-${isOpen}-${restDate ?? "new"}`}
						id="set-rest-end-time"
						label="End time"
						value={endTime}
						onChange={(value) => {
							setEndTime(value);
							setError(null);
						}}
						required
						associateLabel={false}
					/>
					<p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
						Specify time in New York (Eastern Time).
					</p>
				</div>

				{restEndTooSoon ? (
					<div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
						{REST_END_TOO_SOON_MESSAGE}
					</div>
				) : error ? (
					<div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
						{error}
					</div>
				) : null}

				{isRest ? (
					<div className="mt-6 flex flex-wrap justify-end gap-3">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setError(null);
								void removeRest();
							}}
							disabled={submitting !== null}
							className="text-red-600 ring-red-300 hover:bg-red-50 dark:text-red-400 dark:ring-red-800 dark:hover:bg-red-950/40"
						>
							{submitting === "remove" ? "Exiting…" : "Exit rest"}
						</Button>
						<Button type="submit" variant="primary" size="sm" disabled={submitting !== null || !canSaveRest}>
							{submitting === "save" ? "Saving…" : "Update"}
						</Button>
					</div>
				) : (
					<div className="mt-6 flex flex-wrap justify-end gap-3">
						<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting !== null}>
							Cancel
						</Button>
						<Button type="submit" variant="primary" size="sm" disabled={submitting !== null || !canSaveRest}>
							{submitting === "save" ? "Saving…" : "Save"}
						</Button>
					</div>
				)}
			</form>
		</Modal>
	);
}
