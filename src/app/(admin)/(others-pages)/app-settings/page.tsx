"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import React, { FormEvent, useCallback, useEffect, useState } from "react";

type MobileAppSettingsPayload = {
	id: string;
	locationMinIntervalMs: number;
	locationMinDistanceM: number;
	reverseGeocodeMinDistanceM: number;
	createdAt?: string;
	updatedAt?: string;
};

type TmsBatchSettingsPayload = {
	id: string;
	tmsBatchCronIntervalSeconds: number;
	tmsBatchChunkSize: number;
	updatedAt?: string;
};

type LocationEnvironmentPayload = {
	id: string;
	locationEnvironmentMode: "live" | "test";
	locationTestDriverExternalId: string;
	updatedAt?: string;
};

type ApiEnvelope<T> = {
	data: T;
	timestamp?: string;
	path?: string;
};

/** Backend stores `locationMinIntervalMs`; max 24 h per API validation. */
const LOCATION_INTERVAL_MAX_MINUTES = 1440;
const MS_PER_MINUTE = 60_000;

function parseMobileSettings(json: unknown): MobileAppSettingsPayload | null {
	if (!json || typeof json !== "object") return null;
	const root = json as ApiEnvelope<MobileAppSettingsPayload> & MobileAppSettingsPayload;
	const raw =
		root.data && typeof root.data === "object" && "locationMinIntervalMs" in root.data
			? root.data
			: "locationMinIntervalMs" in root && "locationMinDistanceM" in root
				? (root as MobileAppSettingsPayload)
				: null;
	if (!raw || typeof raw.locationMinIntervalMs !== "number" || typeof raw.locationMinDistanceM !== "number") {
		return null;
	}
	return {
		...raw,
		reverseGeocodeMinDistanceM:
			typeof raw.reverseGeocodeMinDistanceM === "number"
				? raw.reverseGeocodeMinDistanceM
				: 5000,
	};
}

function parseTmsBatchSettings(json: unknown): TmsBatchSettingsPayload | null {
	if (!json || typeof json !== "object") return null;
	const root = json as ApiEnvelope<TmsBatchSettingsPayload> & TmsBatchSettingsPayload;
	const raw =
		root.data && typeof root.data === "object" && "tmsBatchCronIntervalSeconds" in root.data
			? root.data
			: "tmsBatchCronIntervalSeconds" in root && "tmsBatchChunkSize" in root
				? (root as TmsBatchSettingsPayload)
				: null;
	if (
		!raw ||
		typeof raw.tmsBatchCronIntervalSeconds !== "number" ||
		typeof raw.tmsBatchChunkSize !== "number"
	) {
		return null;
	}
	return raw;
}

function parseLocationEnvironment(json: unknown): LocationEnvironmentPayload | null {
	if (!json || typeof json !== "object") return null;
	const root = json as ApiEnvelope<LocationEnvironmentPayload> & LocationEnvironmentPayload;
	const raw =
		root.data && typeof root.data === "object" && "locationEnvironmentMode" in root.data
			? root.data
			: "locationEnvironmentMode" in root && "locationTestDriverExternalId" in root
				? (root as LocationEnvironmentPayload)
				: null;
	if (
		!raw ||
		(raw.locationEnvironmentMode !== "live" && raw.locationEnvironmentMode !== "test") ||
		typeof raw.locationTestDriverExternalId !== "string"
	) {
		return null;
	}
	return raw;
}

export default function AppSettingsPage() {
	const [intervalMin, setIntervalMin] = useState("");
	const [distanceM, setDistanceM] = useState("");
	const [reverseGeocodeM, setReverseGeocodeM] = useState("");
	const [tmsCronIntervalMin, setTmsCronIntervalMin] = useState("");
	const [tmsBatchSize, setTmsBatchSize] = useState("");
	const [locationEnvMode, setLocationEnvMode] = useState<"live" | "test">("live");
	const [locationTestDriverExternalId, setLocationTestDriverExternalId] = useState("3343");

	const [loadingMobile, setLoadingMobile] = useState(true);
	const [loadingTms, setLoadingTms] = useState(true);
	const [loadingEnv, setLoadingEnv] = useState(true);
	const [savingMobile, setSavingMobile] = useState(false);
	const [savingTms, setSavingTms] = useState(false);
	const [savingEnv, setSavingEnv] = useState(false);
	const [errorMobile, setErrorMobile] = useState<string | null>(null);
	const [errorTms, setErrorTms] = useState<string | null>(null);
	const [errorEnv, setErrorEnv] = useState<string | null>(null);
	const [successMobile, setSuccessMobile] = useState<string | null>(null);
	const [successTms, setSuccessTms] = useState<string | null>(null);
	const [successEnv, setSuccessEnv] = useState<string | null>(null);

	const loadMobile = useCallback(async () => {
		setLoadingMobile(true);
		setErrorMobile(null);
		try {
			const res = await fetch("/api/app-settings", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setErrorMobile(typeof json.error === "string" ? json.error : "Failed to load settings");
				return;
			}
			const s = parseMobileSettings(json);
			if (!s) {
				setErrorMobile("Unexpected response from server");
				return;
			}
			setIntervalMin(String(Math.round(s.locationMinIntervalMs / MS_PER_MINUTE)));
			setDistanceM(String(s.locationMinDistanceM));
			setReverseGeocodeM(String(s.reverseGeocodeMinDistanceM));
		} catch {
			setErrorMobile("Network error while loading settings");
		} finally {
			setLoadingMobile(false);
		}
	}, []);

	const loadTms = useCallback(async () => {
		setLoadingTms(true);
		setErrorTms(null);
		try {
			const res = await fetch("/api/app-settings/tms-batch", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setErrorTms(typeof json.error === "string" ? json.error : "Failed to load TMS batch settings");
				return;
			}
			const s = parseTmsBatchSettings(json);
			if (!s) {
				setErrorTms("Unexpected response from server");
				return;
			}
			setTmsCronIntervalMin(String(Math.round(s.tmsBatchCronIntervalSeconds / 60)));
			setTmsBatchSize(String(s.tmsBatchChunkSize));
		} catch {
			setErrorTms("Network error while loading TMS batch settings");
		} finally {
			setLoadingTms(false);
		}
	}, []);

	const loadEnv = useCallback(async () => {
		setLoadingEnv(true);
		setErrorEnv(null);
		try {
			const res = await fetch("/api/app-settings/location-environment", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setErrorEnv(typeof json.error === "string" ? json.error : "Failed to load location environment");
				return;
			}
			const s = parseLocationEnvironment(json);
			if (!s) {
				setErrorEnv("Unexpected response from server");
				return;
			}
			setLocationEnvMode(s.locationEnvironmentMode);
			setLocationTestDriverExternalId(s.locationTestDriverExternalId);
		} catch {
			setErrorEnv("Network error while loading location environment");
		} finally {
			setLoadingEnv(false);
		}
	}, []);

	useEffect(() => {
		Promise.all([loadMobile(), loadTms(), loadEnv()]).catch(() => {
			/* errors surfaced via per-loader setError* */
		});
	}, [loadMobile, loadTms, loadEnv]);

	async function onSubmitMobile(e: FormEvent) {
		e.preventDefault();
		setSavingMobile(true);
		setErrorMobile(null);
		setSuccessMobile(null);

		const intervalMinutes = Number.parseInt(intervalMin, 10);
		const locationMinIntervalMs = intervalMinutes * MS_PER_MINUTE;
		const locationMinDistanceM = Number.parseInt(distanceM, 10);
		const reverseGeocodeMinDistanceM = Number.parseInt(reverseGeocodeM, 10);

		if (
			!Number.isFinite(intervalMinutes) ||
			!Number.isFinite(locationMinIntervalMs) ||
			!Number.isFinite(locationMinDistanceM) ||
			!Number.isFinite(reverseGeocodeMinDistanceM) ||
			intervalMinutes < 0 ||
			intervalMinutes > LOCATION_INTERVAL_MAX_MINUTES ||
			locationMinDistanceM < 0 ||
			reverseGeocodeMinDistanceM < 100 ||
			reverseGeocodeMinDistanceM > 500_000
		) {
			setErrorMobile(
				`Valid values: interval 0–${LOCATION_INTERVAL_MAX_MINUTES} min (0 = no time gate); min distance ≥ 0 m (0 = no distance gate); reverse geocode distance 100–500000 m.`
			);
			setSavingMobile(false);
			return;
		}

		try {
			const res = await fetch("/api/app-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					locationMinIntervalMs,
					locationMinDistanceM,
					reverseGeocodeMinDistanceM,
				}),
			});
			const json = await res.json();
			if (!res.ok) {
				const msg =
					typeof json.error === "string"
						? json.error
						: typeof json.message === "string"
							? json.message
							: Array.isArray(json.message)
								? json.message.join(", ")
								: "Failed to save settings";
				setErrorMobile(msg);
				return;
			}
			const s = parseMobileSettings(json);
			if (s) {
				setIntervalMin(String(Math.round(s.locationMinIntervalMs / MS_PER_MINUTE)));
				setDistanceM(String(s.locationMinDistanceM));
				setReverseGeocodeM(String(s.reverseGeocodeMinDistanceM));
			}
			setSuccessMobile("Mobile app settings saved.");
		} catch {
			setErrorMobile("Network error while saving");
		} finally {
			setSavingMobile(false);
		}
	}

	async function onSubmitTms(e: FormEvent) {
		e.preventDefault();
		setSavingTms(true);
		setErrorTms(null);
		setSuccessTms(null);

		const intervalMinutes = Number.parseInt(tmsCronIntervalMin, 10);
		const tmsBatchCronIntervalSeconds = intervalMinutes * 60;
		const tmsBatchChunkSize = Number.parseInt(tmsBatchSize, 10);

		if (
			!Number.isFinite(intervalMinutes) ||
			!Number.isFinite(tmsBatchCronIntervalSeconds) ||
			!Number.isFinite(tmsBatchChunkSize) ||
			intervalMinutes < 1 ||
			intervalMinutes > 1440 ||
			tmsBatchChunkSize < 1 ||
			tmsBatchChunkSize > 500
		) {
			setErrorTms("TMS batch: interval 1–1440 minutes; batch size 1–500.");
			setSavingTms(false);
			return;
		}

		try {
			const res = await fetch("/api/app-settings/tms-batch", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tmsBatchCronIntervalSeconds,
					tmsBatchChunkSize,
				}),
			});
			const json = await res.json();
			if (!res.ok) {
				const msg =
					typeof json.error === "string"
						? json.error
						: typeof json.message === "string"
							? json.message
							: Array.isArray(json.message)
								? json.message.join(", ")
								: "Failed to save TMS batch settings";
				setErrorTms(msg);
				return;
			}
			const s = parseTmsBatchSettings(json);
			if (s) {
				setTmsCronIntervalMin(String(Math.round(s.tmsBatchCronIntervalSeconds / 60)));
				setTmsBatchSize(String(s.tmsBatchChunkSize));
			}
			setSuccessTms("TMS batch settings saved.");
		} catch {
			setErrorTms("Network error while saving");
		} finally {
			setSavingTms(false);
		}
	}

	async function onSubmitEnv(e: FormEvent) {
		e.preventDefault();
		setSavingEnv(true);
		setErrorEnv(null);
		setSuccessEnv(null);

		const trimmedId = locationTestDriverExternalId.trim();
		if (!trimmedId || !/^[\dA-Za-z_-]+$/.test(trimmedId)) {
			setErrorEnv("Test driver external id must be a non-empty id (letters, digits, _ or -).");
			setSavingEnv(false);
			return;
		}

		try {
			const res = await fetch("/api/app-settings/location-environment", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					locationEnvironmentMode: locationEnvMode,
					locationTestDriverExternalId: trimmedId,
				}),
			});
			const json = await res.json();
			if (!res.ok) {
				const msg =
					typeof json.error === "string"
						? json.error
						: typeof json.message === "string"
							? json.message
							: Array.isArray(json.message)
								? json.message.join(", ")
								: "Failed to save location environment";
				setErrorEnv(msg);
				return;
			}
			const s = parseLocationEnvironment(json);
			if (s) {
				setLocationEnvMode(s.locationEnvironmentMode);
				setLocationTestDriverExternalId(s.locationTestDriverExternalId);
			}
			setSuccessEnv(
				"Saved. Live/test mode applies to PUT /users/:id/location and to the TMS batch cron.",
			);
		} catch {
			setErrorEnv("Network error while saving");
		} finally {
			setSavingEnv(false);
		}
	}

	const pageLoading = loadingMobile || loadingTms || loadingEnv;

	return (
		<div>
			<PageBreadcrumb pageTitle="App settings" />

			<div className="flex flex-col gap-8">
				<form
					onSubmit={onSubmitMobile}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Mobile app — location throttling
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Shared settings for the driver app (one row in the database). Interval and distance control how
						often location is sent; reverse geocode distance controls how far a driver must move from the last
						successful address lookup before ZIP/city/state are resolved again.
					</p>

					{loadingMobile ? (
						<div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500">
							Loading…
						</div>
					) : (
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
								<div className="min-w-0 flex-1">
									<Label htmlFor="locationMinIntervalMinutes" className="mb-1">
										Minimum interval between sends (minutes)
									</Label>
									<Input
										id="locationMinIntervalMinutes"
										name="locationMinIntervalMinutes"
										type="number"
										min="0"
										max={String(LOCATION_INTERVAL_MAX_MINUTES)}
										step={1}
										value={intervalMin}
										onChange={(e) => setIntervalMin(e.target.value)}
										placeholder="3"
										required
										className="!h-9 !min-h-0 !py-1.5"
									/>
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
										0 = no minimum time between sends (still limited by OS). Example: 3 = every 3 minutes. Max{" "}
										{LOCATION_INTERVAL_MAX_MINUTES} min (24 h). Stored on the server as milliseconds.
									</p>
								</div>

								<div className="min-w-0 flex-1">
									<Label htmlFor="locationMinDistanceM" className="mb-1">
										Minimum distance (meters)
									</Label>
									<Input
										id="locationMinDistanceM"
										name="locationMinDistanceM"
										type="number"
										min="0"
										step={1}
										value={distanceM}
										onChange={(e) => setDistanceM(e.target.value)}
										placeholder="3000"
										required
										className="!h-9 !min-h-0 !py-1.5"
									/>
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
										0 = no distance gate (only interval applies). Otherwise displacement required before a send
										(together with interval). Mobile OS may still use at least 1 m for native callbacks.
									</p>
								</div>
							</div>

							<div className="max-w-xl">
								<Label htmlFor="reverseGeocodeMinDistanceM" className="mb-1">
									Reverse geocode: min distance from last address fix (meters)
								</Label>
								<Input
									id="reverseGeocodeMinDistanceM"
									name="reverseGeocodeMinDistanceM"
									type="number"
									min="100"
									step={100}
									value={reverseGeocodeM}
									onChange={(e) => setReverseGeocodeM(e.target.value)}
									placeholder="5000"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									After moving this far from the last successful ZIP/city/state lookup, the app runs Expo then
									Nominatim. Default 5000 m (5 km). Range 100–500000.
								</p>
							</div>
						</div>
					)}

					{errorMobile ? (
						<p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
							{errorMobile}
						</p>
					) : null}
					{successMobile ? (
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">{successMobile}</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingMobile || savingEnv}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savingMobile ? "Saving…" : "Save mobile app settings"}
						</button>
					</div>
				</form>

				<form
					onSubmit={onSubmitEnv}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Backend — location environment (live / test)
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						In <strong className="font-medium">test</strong> mode, only the driver with the configured TMS{" "}
						<code className="text-xs">externalId</code> may call{" "}
						<code className="text-xs">PUT /users/:id/location</code> (automatic or manual). All other drivers get{" "}
						403. TMS batch cron also sends only that driver. Use <strong className="font-medium">live</strong> for
						production.
					</p>

					{loadingEnv ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">Loading…</div>
					) : (
						<div className="flex max-w-xl flex-col gap-5">
							<div className="flex flex-col gap-3">
								<Label className="mb-0">Mode</Label>
								<label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
									<input
										type="radio"
										name="locationEnvironmentMode"
										checked={locationEnvMode === "live"}
										onChange={() => setLocationEnvMode("live")}
										className="h-4 w-4"
									/>
									Live — all drivers
								</label>
								<label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
									<input
										type="radio"
										name="locationEnvironmentMode"
										checked={locationEnvMode === "test"}
										onChange={() => setLocationEnvMode("test")}
										className="h-4 w-4"
									/>
									Test — only one driver (by external id)
								</label>
							</div>
							<div>
								<Label htmlFor="locationTestDriverExternalId" className="mb-1">
									Allowed driver external id (test mode)
								</Label>
								<Input
									id="locationTestDriverExternalId"
									name="locationTestDriverExternalId"
									type="text"
									value={locationTestDriverExternalId}
									onChange={(e) => setLocationTestDriverExternalId(e.target.value)}
									placeholder="3343"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Must match <code className="text-xs">users.externalId</code> exactly (trimmed). Default 3343.
								</p>
							</div>
						</div>
					)}

					{errorEnv ? (
						<p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
							{errorEnv}
						</p>
					) : null}
					{successEnv ? (
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">{successEnv}</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingEnv}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savingEnv ? "Saving…" : "Save live / test mode"}
						</button>
					</div>
				</form>

				<form
					onSubmit={onSubmitTms}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Backend — TMS batch location sync
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Server-side job that sends driver locations to TMS in batches (drivers with automatic location updates
						enabled). This does not affect how often the mobile app writes to our database. Saved separately from
						mobile throttling above.
					</p>

					{loadingTms ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">Loading…</div>
					) : (
						<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
							<div className="min-w-0 flex-1">
								<Label htmlFor="tmsBatchCronIntervalMinutes" className="mb-1">
									Minimum interval between TMS batch runs (minutes)
								</Label>
								<Input
									id="tmsBatchCronIntervalMinutes"
									name="tmsBatchCronIntervalMinutes"
									type="number"
									min="1"
									max="1440"
									step={1}
									value={tmsCronIntervalMin}
									onChange={(e) => setTmsCronIntervalMin(e.target.value)}
									placeholder="5"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									How often the backend may run a full TMS batch sync (e.g. 5 = every 5 minutes). Range 1–1440
									min (1 min–24 h). Stored on the server as seconds.
								</p>
							</div>

							<div className="min-w-0 flex-1">
								<Label htmlFor="tmsBatchChunkSize" className="mb-1">
									Drivers per TMS batch request
								</Label>
								<Input
									id="tmsBatchChunkSize"
									name="tmsBatchChunkSize"
									type="number"
									min="1"
									max="500"
									step={1}
									value={tmsBatchSize}
									onChange={(e) => setTmsBatchSize(e.target.value)}
									placeholder="150"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Max drivers per POST to the TMS batch endpoint. Range 1–500.
								</p>
							</div>
						</div>
					)}

					{errorTms ? (
						<p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
							{errorTms}
						</p>
					) : null}
					{successTms ? (
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">{successTms}</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingTms || savingEnv}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savingTms ? "Saving…" : "Save TMS batch settings"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
