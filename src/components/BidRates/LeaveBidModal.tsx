"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBidRate } from "@/app-api/bidRates";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
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

	useEffect(() => {
		if (isOpen) {
			setForm(EMPTY_FORM);
			setRouteRows(initialBidRouteRows());
			setRouteError(null);
			setError(null);
			setSubmitting(false);
		}
	}, [isOpen]);

	function updateField<K extends keyof LeaveBidForm>(key: K, value: LeaveBidForm[K]) {
		setForm(prev => ({ ...prev, [key]: value }));
	}

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
			});
			onClose();
		} catch (err) {
			const message =
				(err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
				(err as Error)?.message ||
				"Failed to create bid rate.";
			setError(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leave bid</h2>

				<div className="mt-5 space-y-4">
					<BidRateRouteBuilder rows={routeRows} onChange={setRouteRows} />

					{routeError && (
						<p className="text-sm text-red-500 dark:text-red-400">{routeError}</p>
					)}

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
					<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button type="submit" variant="primary" size="sm" disabled={submitting}>
						{submitting ? "Creating…" : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
