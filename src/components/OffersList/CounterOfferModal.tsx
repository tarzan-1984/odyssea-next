"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import offersApi from "@/app-api/offers";

export type CounterOfferModalState = {
	offerId: number;
	driverExternalId: string;
	driverName: string;
	driverRate: number | null;
};

type CounterOfferModalProps = {
	state: CounterOfferModalState | null;
	isOpen: boolean;
	onClose: () => void;
	onSaved?: () => void | Promise<void>;
};

const COUNTER_OFFER_LIMIT_MESSAGE =
	"You have reached the maximum number of counteroffers for this driver. Additional counteroffers are no longer available. If you would like to continue negotiating, please contact the driver directly through the chat.";

function initialRateValue(rate: number | null | undefined): string {
	if (rate == null || !Number.isFinite(rate)) return "";
	return String(rate);
}

function formatUsd(value: number): string {
	return `$${Number(value).toLocaleString("en-US")}`;
}

export default function CounterOfferModal({
	state,
	isOpen,
	onClose,
	onSaved,
}: CounterOfferModalProps) {
	const [rateInput, setRateInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [limitReached, setLimitReached] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen || !state) return;
		setError(null);
		setLimitReached(false);
		setSubmitting(false);
		setRateInput(initialRateValue(state.driverRate));
	}, [isOpen, state]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!state || submitting || limitReached) return;

		const trimmed = rateInput.replace(/,/g, "").trim();
		if (!trimmed) {
			setError("Please enter a rate.");
			return;
		}

		const rate = Number(trimmed.replace(",", "."));
		if (!Number.isFinite(rate) || rate < 0) {
			setError("Please enter a valid rate.");
			return;
		}

		if (state.driverRate == null) {
			setError("Driver rate is not set.");
			return;
		}

		if (rate > state.driverRate) {
			setError(
				`Counter offer must not be higher than the driver's rate (${formatUsd(state.driverRate)})`,
			);
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const res = await offersApi.setDriverCounterOffer(
				state.offerId,
				state.driverExternalId,
				rate,
			);
			if (!res.success) {
				const isLimit =
					res.code === "COUNTER_OFFER_LIMIT_REACHED" ||
					(res.error ?? "").includes("maximum number of counteroffers");
				if (isLimit) {
					setLimitReached(true);
					setError(res.error ?? COUNTER_OFFER_LIMIT_MESSAGE);
				} else {
					setError(res.error ?? "Failed to save counter offer.");
				}
				return;
			}
			await onSaved?.();
			onClose();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
		>
			<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
				Counter offer
			</h4>
			{state?.driverName ? (
				<p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
					Proposal for {state.driverName}
				</p>
			) : (
				<div className="mb-5" />
			)}

			{limitReached ? (
				<div className="space-y-4">
					<div
						role="alert"
						className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
					>
						{error ?? COUNTER_OFFER_LIMIT_MESSAGE}
					</div>
					<div className="flex justify-end">
						<Button type="button" size="sm" onClick={onClose}>
							OK
						</Button>
					</div>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="counter-offer-rate-input">Your offer ($)</Label>
						<Input
							id="counter-offer-rate-input"
							type="text"
							inputMode="decimal"
							value={rateInput}
							onChange={e => {
								setRateInput(e.target.value);
								if (error) setError(null);
							}}
							placeholder="Enter rate"
							className="dark:bg-gray-900"
							error={Boolean(error)}
							hint={error ?? undefined}
							disabled={submitting}
						/>
					</div>
					<div className="flex justify-end gap-3 pt-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={onClose}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting ? "Sending…" : "Send"}
						</Button>
					</div>
				</form>
			)}
		</Modal>
	);
}
