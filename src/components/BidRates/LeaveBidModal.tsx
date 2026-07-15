"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBidRate } from "@/app-api/bidRates";
import offers from "@/app-api/offers";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { EditLoadedMilesIcon } from "@/icons";
import { isValidLocationFormat } from "@/utils/offerLocationFormat";
import BidRateRouteBuilder, {
	bidRouteRowsToPayload,
	initialBidRouteRows,
	validateBidRouteRows,
	type BidRouteRow,
} from "./BidRateRouteBuilder";

type LeaveBidModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

type LeaveBidForm = {
	broker: string;
	rate: string;
};

const EMPTY_FORM: LeaveBidForm = {
	broker: "",
	rate: "",
};

export default function LeaveBidModal({ isOpen, onClose }: LeaveBidModalProps) {
	const [form, setForm] = useState<LeaveBidForm>(EMPTY_FORM);
	const [routeRows, setRouteRows] = useState<BidRouteRow[]>(initialBidRouteRows);
	const [routeError, setRouteError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [committedLocations, setCommittedLocations] = useState<string[]>([]);
	const [manualDistance, setManualDistance] = useState<number | null>(null);
	const [isEditDistanceModalOpen, setIsEditDistanceModalOpen] = useState(false);
	const [editDistanceInput, setEditDistanceInput] = useState("");
	const [editDistanceError, setEditDistanceError] = useState<string | null>(null);
	const [editDistanceConfirmed, setEditDistanceConfirmed] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setForm(EMPTY_FORM);
			setRouteRows(initialBidRouteRows());
			setRouteError(null);
			setError(null);
			setSubmitting(false);
			setCommittedLocations([]);
			setManualDistance(null);
			setIsEditDistanceModalOpen(false);
			setEditDistanceInput("");
			setEditDistanceError(null);
			setEditDistanceConfirmed(false);
		}
	}, [isOpen]);

	const handleLocationsCommit = useCallback((locations: string[]) => {
		setCommittedLocations(locations);
		setManualDistance(null);
	}, []);

	const allLocationsFilledAndValid = (locs: string[]) =>
		locs.length >= 2 && locs.every(l => l.trim() !== "" && isValidLocationFormat(l.trim()));

	const {
		data: routeDistanceData,
		isFetching: isCalculatingRoute,
		error: routeDistanceQueryError,
	} = useQuery({
		queryKey: ["route-distance", committedLocations],
		queryFn: () => offers.calculateRouteDistance(committedLocations),
		enabled: allLocationsFilledAndValid(committedLocations),
		staleTime: 20 * 60 * 1000,
		retry: 1,
	});

	const distance = manualDistance ?? routeDistanceData?.loadedMiles ?? null;
	const routeDistanceError =
		manualDistance != null
			? null
			: routeDistanceQueryError
				? routeDistanceQueryError instanceof Error
					? routeDistanceQueryError.message
					: "Could not calculate route distance"
				: null;
	const showDistanceEditIcon =
		!isCalculatingRoute &&
		allLocationsFilledAndValid(committedLocations) &&
		(routeDistanceData?.loadedMiles != null ||
			routeDistanceQueryError != null ||
			manualDistance != null);

	function updateField<K extends keyof LeaveBidForm>(key: K, value: LeaveBidForm[K]) {
		setForm(prev => ({ ...prev, [key]: value }));
	}

	const openEditDistanceModal = () => {
		setEditDistanceInput(
			distance != null && Number.isFinite(distance) ? String(Math.round(distance)) : "",
		);
		setEditDistanceError(null);
		setEditDistanceConfirmed(false);
		setIsEditDistanceModalOpen(true);
	};

	const handleChangeDistance = () => {
		const trimmed = editDistanceInput.replace(/,/g, "").trim();
		if (!trimmed) {
			setEditDistanceError("Enter a value");
			return;
		}
		const parsed = Number.parseFloat(trimmed);
		if (Number.isNaN(parsed)) {
			setEditDistanceError("Enter a valid number");
			return;
		}
		if (parsed <= 0) {
			setEditDistanceError("Must be greater than zero");
			return;
		}
		setManualDistance(Math.round(parsed));
		setIsEditDistanceModalOpen(false);
		setEditDistanceError(null);
		setError(null);
	};

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setRouteError(null);

		const broker = form.broker.trim();
		const rateRaw = form.rate.trim();
		const nextRouteError = validateBidRouteRows(routeRows);

		if (nextRouteError) {
			setRouteError(nextRouteError);
			return;
		}

		if (distance == null || distance === 0) {
			setError(
				routeDistanceError ||
					"Please wait for distance calculation or enter it manually.",
			);
			return;
		}

		if (!broker) {
			setError("Please enter broker.");
			return;
		}
		if (!rateRaw) {
			setError("Please enter rate.");
			return;
		}

		const rate = Number(rateRaw.replace(",", "."));
		if (!Number.isFinite(rate) || rate < 0) {
			setError("Please enter a valid rate.");
			return;
		}

		setSubmitting(true);
		try {
			await createBidRate({
				route: bidRouteRowsToPayload(routeRows),
				broker,
				rate,
				distance: Math.round(distance),
			});
			onClose();
		} catch (err) {
			const raw =
				(err as { response?: { data?: { error?: unknown } } })?.response?.data?.error ??
				(err as Error)?.message;
			const message =
				typeof raw === "string"
					? raw
					: "Failed to create bid rate.";
			setError(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-900"
				closeOnBackdropClick
			>
				<form onSubmit={onSubmit} className="p-6">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leave bid</h2>

					<div className="mt-5 space-y-4">
						<BidRateRouteBuilder
							rows={routeRows}
							onChange={setRouteRows}
							onLocationsCommit={handleLocationsCommit}
						/>

						{routeError && (
							<p className="text-sm text-red-500 dark:text-red-400">{routeError}</p>
						)}

						<div>
							<Label htmlFor="leave-bid-distance">Distance</Label>
							<div className="relative mt-1.5">
								<Input
									id="leave-bid-distance"
									type="text"
									readOnly
									value={
										distance != null && Number.isFinite(distance)
											? String(Math.round(distance))
											: ""
									}
									placeholder="Fill all addresses and blur to calculate"
									className={`cursor-not-allowed ${showDistanceEditIcon ? "pr-11" : ""}`}
								/>
								{showDistanceEditIcon && (
									<button
										type="button"
										onClick={openEditDistanceModal}
										className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
										aria-label="Edit distance"
									>
										<EditLoadedMilesIcon className="h-5 w-5" />
									</button>
								)}
								{isCalculatingRoute && (
									<div
										className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-900/80"
										aria-hidden
									>
										<SpinnerOne />
									</div>
								)}
							</div>
							{routeDistanceError && !isCalculatingRoute && (
								<p className="mt-1 text-xs text-red-500 dark:text-red-400">
									{routeDistanceError}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="leave-bid-broker">Broker</Label>
							<div className="mt-1.5">
								<Input
									id="leave-bid-broker"
									name="broker"
									type="text"
									value={form.broker}
									onChange={e => updateField("broker", e.target.value)}
									placeholder="Enter broker"
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="leave-bid-rate">Rate</Label>
							<div className="mt-1.5">
								<Input
									id="leave-bid-rate"
									name="rate"
									type="number"
									step={0.01}
									min="0"
									inputMode="decimal"
									value={form.rate}
									onChange={e => updateField("rate", e.target.value)}
									placeholder="0.00"
								/>
							</div>
						</div>
					</div>

					{error && (
						<div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
							{error}
						</div>
					)}

					<div className="mt-6 flex flex-wrap justify-end gap-3">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onClose}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							disabled={
								submitting ||
								isCalculatingRoute ||
								distance == null ||
								distance === 0
							}
						>
							{submitting ? "Creating…" : "Create"}
						</Button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={isEditDistanceModalOpen}
				onClose={() => {
					setIsEditDistanceModalOpen(false);
					setEditDistanceError(null);
					setEditDistanceConfirmed(false);
				}}
				className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
			>
				<h4 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
					Change distance
				</h4>
				<div className="space-y-4">
					<div>
						<Label htmlFor="edit-bid-distance-input">Distance</Label>
						<Input
							id="edit-bid-distance-input"
							type="text"
							inputMode="numeric"
							value={editDistanceInput}
							onChange={e => {
								setEditDistanceInput(e.target.value);
								if (editDistanceError) setEditDistanceError(null);
							}}
							placeholder="Enter miles"
							className="dark:bg-gray-900"
							error={Boolean(editDistanceError)}
							hint={editDistanceError ?? undefined}
						/>
					</div>
					<Checkbox
						id="edit-bid-distance-confirm"
						checked={editDistanceConfirmed}
						onChange={setEditDistanceConfirmed}
						label="I am sure I am entering the correct value"
					/>
					<div className="flex justify-end gap-3 pt-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								setIsEditDistanceModalOpen(false);
								setEditDistanceError(null);
								setEditDistanceConfirmed(false);
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleChangeDistance}
							disabled={!editDistanceConfirmed}
						>
							Change distance
						</Button>
					</div>
				</div>
			</Modal>
		</>
	);
}
