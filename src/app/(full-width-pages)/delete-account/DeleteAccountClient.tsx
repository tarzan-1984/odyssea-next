"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export default function DeleteAccountClient() {
	const [email, setEmail] = useState("");
	const [comment, setComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);

		const nextEmail = email.trim();
		if (!nextEmail) {
			setError("Email is required.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/public/account-deletion-request", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: nextEmail,
					comment: comment.trim() ? comment.trim() : undefined,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				setError(
					typeof json.error === "string"
						? json.error
						: typeof json.message === "string"
							? json.message
							: "Failed to submit request."
				);
				return;
			}
			setSuccess(
				"Your request has been received. You will be notified shortly once the account deletion is completed."
			);
			setEmail("");
			setComment("");
		} catch {
			setError("Network error. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			<header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
						DELETE ACCOUNT
					</h1>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
						Account Deletion Request
					</h2>
					<p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
						Submit this form to request deletion of your account. For security, we may contact you to verify
						ownership of the email address.
					</p>

					<form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
						<div>
							<label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
								Email
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
							/>
							<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Enter the email address that is registered to the account you want to delete.
							</p>
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
								Comment (optional)
							</label>
							<textarea
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder="Add any details that can help us process your request…"
								className="min-h-[110px] w-full resize-y rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
							/>
						</div>

						{error ? (
							<p className="text-sm text-red-600 dark:text-red-400" role="alert">
								{error}
							</p>
						) : null}
						{success ? (
							<p className="text-sm text-green-600 dark:text-green-400">{success}</p>
						) : null}

						<div className="pt-2">
							<button
								type="submit"
								disabled={submitting}
								className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{submitting ? "Submitting…" : "Submit request"}
							</button>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}

