"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

export type SetPasswordDriver = {
	externalId?: string;
	firstName?: string;
	lastName?: string;
};

type SetPasswordModalProps = {
	isOpen: boolean;
	onClose: () => void;
	driver: SetPasswordDriver | null;
};

function driverLabel(driver: SetPasswordDriver | null): string {
	if (!driver) return "";
	const name = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || "Driver";
	const id = driver.externalId?.trim();
	return id ? `${name} (U: ${id})` : name;
}

export default function SetPasswordModal({ isOpen, onClose, driver }: SetPasswordModalProps) {
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const externalId = driver?.externalId?.trim() ?? "";

	useEffect(() => {
		if (isOpen) {
			setPassword("");
			setOtp("");
			setError(null);
			setSuccess(null);
			setSubmitting(false);
		}
	}, [isOpen, externalId]);

	function handleOtpChange(e: ChangeEvent<HTMLInputElement>) {
		setOtp(e.target.value.replace(/\D/g, ""));
	}

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);

		if (!externalId) {
			setError("Driver external ID is missing.");
			return;
		}
		if (!password.trim()) {
			setError("Please enter a password.");
			return;
		}
		if (!otp.trim()) {
			setError("Please enter an OTP code.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/users/drivers/set-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					externalId,
					password: password.trim(),
					otp: otp.trim(),
				}),
			});
			const json = (await res.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
			};

			if (!res.ok) {
				setError(json.error || json.message || "Failed to set password.");
				return;
			}

			setSuccess(json.message || "Password and OTP set successfully.");
			window.setTimeout(() => {
				onClose();
			}, 800);
		} catch {
			setError("Failed to set password.");
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
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Set password</h2>
				{driver && (
					<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{driverLabel(driver)}</p>
				)}

				<input type="hidden" name="externalId" value={externalId} readOnly />

				<div className="mt-5 space-y-4">
					<div>
						<Label htmlFor="set-password-password">Password</Label>
						<div className="mt-1.5">
							<Input
								id="set-password-password"
								name="password"
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="Enter new password"
								autoComplete="new-password"
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="set-password-otp">OTP</Label>
						<div className="mt-1.5">
							<Input
								id="set-password-otp"
								name="otp"
								type="text"
								inputMode="numeric"
								pattern="[0-9]*"
								value={otp}
								onChange={handleOtpChange}
								placeholder="Enter OTP code"
								autoComplete="one-time-code"
							/>
						</div>
					</div>
				</div>

				{error && (
					<div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
						{error}
					</div>
				)}
				{success && (
					<div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
						{success}
					</div>
				)}

				<div className="mt-6 flex flex-wrap justify-end gap-3">
					<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button type="submit" variant="primary" size="sm" disabled={submitting || !externalId}>
						{submitting ? "Saving…" : "Set password"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
