"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

type LeaveBidModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

type LeaveBidForm = {
	origin: string;
	destination: string;
	broker: string;
	rate: string;
};

const EMPTY_FORM: LeaveBidForm = {
	origin: "",
	destination: "",
	broker: "",
	rate: "",
};

export default function LeaveBidModal({ isOpen, onClose }: LeaveBidModalProps) {
	const [form, setForm] = useState<LeaveBidForm>(EMPTY_FORM);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setForm(EMPTY_FORM);
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

		const origin = form.origin.trim();
		const destination = form.destination.trim();
		const broker = form.broker.trim();
		const rateRaw = form.rate.trim();

		if (!origin) {
			setError("Please enter origin.");
			return;
		}
		if (!destination) {
			setError("Please enter destination.");
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
			onClose();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leave bid</h2>

				<div className="mt-5 space-y-4">
					<div>
						<Label htmlFor="leave-bid-origin">Origin</Label>
						<div className="mt-1.5">
							<Input
								id="leave-bid-origin"
								name="origin"
								type="text"
								value={form.origin}
								onChange={e => updateField("origin", e.target.value)}
								placeholder="Enter origin"
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="leave-bid-destination">Destination</Label>
						<div className="mt-1.5">
							<Input
								id="leave-bid-destination"
								name="destination"
								type="text"
								value={form.destination}
								onChange={e => updateField("destination", e.target.value)}
								placeholder="Enter destination"
							/>
						</div>
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
								step="0.01"
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
