"use client";

import { FormEvent, useEffect, useState } from "react";
import {
	getBidRateVoters,
	updateBidRateNewPrice,
	type BidRate,
} from "@/app-api/bidRates";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

type EditBidPriceModalProps = {
	bid: BidRate | null;
	isOpen: boolean;
	onClose: () => void;
	onSaved: () => void;
};

function initialPriceValue(bid: BidRate | null): string {
	if (!bid) return "";
	const value = bid.rate;
	if (!Number.isFinite(value)) return "";
	return String(value);
}

function formatMinBidUsd(price: number): string {
	return `$${Number(price).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

function minActiveOfferRate(
	voters: Array<{ rate: number | null }>,
): number | null {
	const rates = voters
		.map(row => row.rate)
		.filter((rate): rate is number => rate != null && Number.isFinite(rate));
	if (rates.length === 0) return null;
	return Math.min(...rates);
}

export default function EditBidPriceModal({
	bid,
	isOpen,
	onClose,
	onSaved,
}: EditBidPriceModalProps) {
	const [priceInput, setPriceInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [acceptedOpen, setAcceptedOpen] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setPriceInput(initialPriceValue(bid));
			setError(null);
			setSubmitting(false);
		}
	}, [isOpen, bid]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!bid) return;

		const trimmed = priceInput.replace(/,/g, "").trim();
		if (!trimmed) {
			setError("Please enter a price.");
			return;
		}

		const newPrice = Number(trimmed.replace(",", "."));
		if (!Number.isFinite(newPrice) || newPrice < 0) {
			setError("Please enter a valid price.");
			return;
		}

		const initialRate = bid.rate;
		if (Number.isFinite(initialRate) && newPrice >= initialRate) {
			setError(
				`Your bid must be less than ${formatMinBidUsd(initialRate)}`,
			);
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const voters = await getBidRateVoters(bid.id);
			const minRate = minActiveOfferRate(voters.participants ?? []);
			if (minRate != null && newPrice >= minRate) {
				setError(
					`Your bid must be less than ${formatMinBidUsd(minRate)}`,
				);
				return;
			}

			await updateBidRateNewPrice(bid.id, newPrice);
			onSaved();
			onClose();
			setAcceptedOpen(true);
		} catch (err) {
			const message =
				(err as { response?: { data?: { error?: string; message?: string } } })
					?.response?.data?.error ||
				(err as { response?: { data?: { message?: string } } })?.response?.data
					?.message ||
				(err as Error)?.message ||
				"Failed to update price.";
			setError(Array.isArray(message) ? message.join(", ") : String(message));
		} finally {
			setSubmitting(false);
		}
	}

	function handleCloseAccepted() {
		setAcceptedOpen(false);
	}

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
			>
				<h4 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
					Edit price
				</h4>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="edit-bid-price-input">New price</Label>
						<Input
							id="edit-bid-price-input"
							type="text"
							inputMode="decimal"
							value={priceInput}
							onChange={e => {
								setPriceInput(e.target.value);
								if (error) setError(null);
							}}
							placeholder="Enter price"
							className="dark:bg-gray-900"
							error={Boolean(error)}
							hint={error ?? undefined}
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
							{submitting ? "Saving…" : "Save"}
						</Button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={acceptedOpen}
				onClose={handleCloseAccepted}
				className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
			>
				<div className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
						<svg
							className="h-6 w-6 text-green-600 dark:text-green-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
							aria-hidden
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
						Success
					</h4>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
						Your bid has been accepted
					</p>
					<Button type="button" size="sm" onClick={handleCloseAccepted}>
						OK
					</Button>
				</div>
			</Modal>
		</>
	);
}
