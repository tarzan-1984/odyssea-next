"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useInfiniteQuery } from "@tanstack/react-query";
import usersApi from "@/app-api/users";
import type { UserListItem } from "@/app-api/api-types";
import { renderAvatar } from "@/helpers";

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

type OffersAppSettingsPayload = {
	id: string;
	maxDriverOpenOfferParticipations: number;
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
const PUSH_USERS_PAGE_SIZE = 20;
const PUSH_USERS_CACHE_MS = 2 * 60 * 60 * 1000; // 2 hours

type UsersListApiResponse = {
	data: {
		users: UserListItem[];
		pagination: {
			current_page: number;
			total_pages: number;
		};
	};
};

type UsageStatsPayload = {
	users: { ios: number; android: number };
	drivers: { ios: number; android: number };
	total: { ios: number; android: number; all: number };
};

function parseMobileSettings(json: unknown): MobileAppSettingsPayload | null {
	if (!json || typeof json !== "object") return null;
	const root = json as ApiEnvelope<MobileAppSettingsPayload> & MobileAppSettingsPayload;
	const raw =
		root.data && typeof root.data === "object" && "locationMinIntervalMs" in root.data
			? root.data
			: "locationMinIntervalMs" in root && "locationMinDistanceM" in root
				? (root as MobileAppSettingsPayload)
				: null;
	if (
		!raw ||
		typeof raw.locationMinIntervalMs !== "number" ||
		typeof raw.locationMinDistanceM !== "number"
	) {
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

function parseOffersAppSettings(json: unknown): OffersAppSettingsPayload | null {
	if (!json || typeof json !== "object") return null;
	const root = json as ApiEnvelope<OffersAppSettingsPayload> & OffersAppSettingsPayload;
	const raw =
		root.data &&
		typeof root.data === "object" &&
		"maxDriverOpenOfferParticipations" in root.data
			? root.data
			: "maxDriverOpenOfferParticipations" in root
				? (root as OffersAppSettingsPayload)
				: null;
	if (!raw || typeof raw.maxDriverOpenOfferParticipations !== "number") {
		return null;
	}
	return raw;
}

function getUserDisplayName(u: UserListItem): string {
	const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
	return fullName || u.email || "-";
}

export default function AppSettingsPage() {
	const [intervalMin, setIntervalMin] = useState("");
	const [distanceM, setDistanceM] = useState("");
	const [reverseGeocodeM, setReverseGeocodeM] = useState("");
	const [tmsCronIntervalMin, setTmsCronIntervalMin] = useState("");
	const [tmsBatchSize, setTmsBatchSize] = useState("");
	const [locationEnvMode, setLocationEnvMode] = useState<"live" | "test">("live");
	const [locationTestDriverExternalId, setLocationTestDriverExternalId] = useState("3343");
	const [maxOpenOfferParticipationsInput, setMaxOpenOfferParticipationsInput] = useState("2");

	const [loadingMobile, setLoadingMobile] = useState(true);
	const [loadingTms, setLoadingTms] = useState(true);
	const [loadingEnv, setLoadingEnv] = useState(true);
	const [loadingOffers, setLoadingOffers] = useState(true);
	const [savingMobile, setSavingMobile] = useState(false);
	const [savingTms, setSavingTms] = useState(false);
	const [savingEnv, setSavingEnv] = useState(false);
	const [savingOffers, setSavingOffers] = useState(false);
	const [errorMobile, setErrorMobile] = useState<string | null>(null);
	const [errorTms, setErrorTms] = useState<string | null>(null);
	const [errorEnv, setErrorEnv] = useState<string | null>(null);
	const [errorOffers, setErrorOffers] = useState<string | null>(null);
	const [successMobile, setSuccessMobile] = useState<string | null>(null);
	const [successTms, setSuccessTms] = useState<string | null>(null);
	const [successEnv, setSuccessEnv] = useState<string | null>(null);
	const [successOffers, setSuccessOffers] = useState<string | null>(null);

	// Usage stats (admin) section
	const [usageStats, setUsageStats] = useState<UsageStatsPayload | null>(null);
	const [loadingUsage, setLoadingUsage] = useState(true);
	const [errorUsage, setErrorUsage] = useState<string | null>(null);

	// Push notifications (admin) section
	const [pushRecipientUserId, setPushRecipientUserId] = useState<string>("");
	const [pushPlatform, setPushPlatform] = useState<"all" | "ios" | "android">("all");
	const [pushMessage, setPushMessage] = useState("");
	const [pushSearch, setPushSearch] = useState("");
	const [pushSearchDebounced, setPushSearchDebounced] = useState("");
	const [pushOpen, setPushOpen] = useState(false);
	const [pushSending, setPushSending] = useState(false);
	const [pushError, setPushError] = useState<string | null>(null);
	const [pushSuccess, setPushSuccess] = useState<string | null>(null);
	const pushDropdownRef = useRef<HTMLDivElement>(null);
	useClickOutside(pushDropdownRef, () => setPushOpen(false));

	useEffect(() => {
		const id = window.setTimeout(() => {
			setPushSearchDebounced(pushSearch.trim());
		}, 300);
		return () => window.clearTimeout(id);
	}, [pushSearch]);

	const loadUsage = useCallback(async () => {
		setLoadingUsage(true);
		setErrorUsage(null);
		try {
			const res = await fetch("/api/app-settings/usage-stats", { method: "GET" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				setErrorUsage(
					typeof json.error === "string" ? json.error : "Failed to load usage stats"
				);
				return;
			}
			// Some API proxies wrap payload as data.data (envelope inside envelope).
			const data = ((json?.data?.data ?? json?.data) ?? null) as UsageStatsPayload | null;
			if (
				!data ||
				typeof data.total?.all !== "number" ||
				typeof data.total?.ios !== "number" ||
				typeof data.total?.android !== "number"
			) {
				setErrorUsage("Unexpected response from server");
				return;
			}
			setUsageStats(data);
		} catch {
			setErrorUsage("Network error while loading usage stats");
		} finally {
			setLoadingUsage(false);
		}
	}, []);

	const pushUsersQuery = useInfiniteQuery({
		queryKey: ["push-active-users", { search: pushSearchDebounced }],
		queryFn: async ({ pageParam }): Promise<UsersListApiResponse> => {
			const res = await usersApi.getAllUsers({
				page: pageParam,
				limit: PUSH_USERS_PAGE_SIZE,
				contactsOnly: true,
				status: "ACTIVE",
				...(pushSearchDebounced ? { search: pushSearchDebounced } : {}),
			});
			if (!res.success) {
				throw new Error(res.error || "Failed to load users");
			}
			return res.data as UsersListApiResponse;
		},
		initialPageParam: 1,
		getNextPageParam: lastPage => {
			const pagination = lastPage?.data?.pagination;
			if (!pagination) return undefined;
			if (pagination.current_page < pagination.total_pages)
				return pagination.current_page + 1;
			return undefined;
		},
		staleTime: PUSH_USERS_CACHE_MS,
		gcTime: PUSH_USERS_CACHE_MS,
	});

	const pushUsers: UserListItem[] = useMemo(() => {
		const pages = pushUsersQuery.data?.pages ?? [];
		return pages.flatMap(p => p?.data?.users ?? []);
	}, [pushUsersQuery.data]);

	const selectedPushUser = useMemo(() => {
		if (!pushRecipientUserId) return null;
		return pushUsers.find(u => u.id === pushRecipientUserId) ?? null;
	}, [pushRecipientUserId, pushUsers]);

	const onPushScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
		if (nearBottom && pushUsersQuery.hasNextPage && !pushUsersQuery.isFetchingNextPage) {
			pushUsersQuery.fetchNextPage().catch(() => undefined);
		}
	};

	async function onSendPush(e: FormEvent) {
		e.preventDefault();
		setPushError(null);
		setPushSuccess(null);

		const message = pushMessage.trim();
		if (!message) {
			setPushError("Please enter a message.");
			return;
		}

		setPushSending(true);
		try {
			const res = await fetch("/api/v1/notifications/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message,
					userId: pushRecipientUserId ? pushRecipientUserId : null,
					platform: pushRecipientUserId ? null : pushPlatform,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				const msg =
					(typeof json.error === "string" ? json.error : null) ??
					(typeof json.message === "string" ? json.message : null) ??
					"Failed to send push notification.";
				setPushError(msg);
				return;
			}
			const usersCount = json?.data?.users;
			if (pushRecipientUserId) {
				setPushSuccess("Sent to the selected user.");
			} else if (typeof usersCount === "number") {
				setPushSuccess(`Sent to ${usersCount} users.`);
			} else {
				setPushSuccess("Sent.");
			}
			setPushMessage("");
		} catch {
			setPushError("Network error while sending push");
		} finally {
			setPushSending(false);
		}
	}

	const loadMobile = useCallback(async () => {
		setLoadingMobile(true);
		setErrorMobile(null);
		try {
			const res = await fetch("/api/app-settings", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setErrorMobile(
					typeof json.error === "string" ? json.error : "Failed to load settings"
				);
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
				setErrorTms(
					typeof json.error === "string"
						? json.error
						: "Failed to load TMS batch settings"
				);
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
				setErrorEnv(
					typeof json.error === "string"
						? json.error
						: "Failed to load location environment"
				);
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

	const loadOffers = useCallback(async () => {
		setLoadingOffers(true);
		setErrorOffers(null);
		try {
			const res = await fetch("/api/app-settings/offers", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setErrorOffers(
					typeof json.error === "string" ? json.error : "Failed to load offers settings"
				);
				return;
			}
			const s = parseOffersAppSettings(json);
			if (!s) {
				setErrorOffers("Unexpected response from server");
				return;
			}
			setMaxOpenOfferParticipationsInput(String(s.maxDriverOpenOfferParticipations));
		} catch {
			setErrorOffers("Network error while loading offers settings");
		} finally {
			setLoadingOffers(false);
		}
	}, []);

	useEffect(() => {
		Promise.all([loadUsage(), loadMobile(), loadTms(), loadEnv(), loadOffers()]).catch(() => {
			/* errors surfaced via per-loader setError* */
		});
	}, [loadUsage, loadMobile, loadTms, loadEnv, loadOffers]);

	async function onSubmitOffers(e: FormEvent) {
		e.preventDefault();
		setSavingOffers(true);
		setErrorOffers(null);
		setSuccessOffers(null);

		const parsedMax = Number.parseInt(maxOpenOfferParticipationsInput, 10);
		if (!Number.isFinite(parsedMax) || parsedMax < 1 || parsedMax > 50) {
			setErrorOffers("Enter an integer from 1 to 50.");
			setSavingOffers(false);
			return;
		}

		try {
			const res = await fetch("/api/app-settings/offers", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ maxDriverOpenOfferParticipations: parsedMax }),
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
								: "Failed to save offers settings";
				setErrorOffers(msg);
				return;
			}
			const s = parseOffersAppSettings(json);
			if (s) {
				setMaxOpenOfferParticipationsInput(String(s.maxDriverOpenOfferParticipations));
			}
			setSuccessOffers(
				"Saved. Driver apps receive this via GET /v1/app-settings and WebSocket appLocationSettingsUpdated."
			);
		} catch {
			setErrorOffers("Network error while saving");
		} finally {
			setSavingOffers(false);
		}
	}

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
				`Valid values: location interval 0–${LOCATION_INTERVAL_MAX_MINUTES} min (0 = no time gate); min distance ≥ 0 m (0 = no distance gate); reverse geocode distance 100–500000 m.`
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
			setErrorEnv(
				"Test driver external id must be a non-empty id (letters, digits, _ or -)."
			);
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
				"Saved. Live/test mode applies to PUT /users/:id/location and to the TMS batch cron."
			);
		} catch {
			setErrorEnv("Network error while saving");
		} finally {
			setSavingEnv(false);
		}
	}

	const pageLoading = loadingMobile || loadingTms || loadingEnv || loadingOffers;

	return (
		<div>
			<PageBreadcrumb pageTitle="App settings" />

			<div className="flex flex-col gap-8">
				<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Mobile app usage (ACTIVE + device registered)
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Counts are based on <code className="text-xs">users.status=ACTIVE</code> and presence of a row in{" "}
						<code className="text-xs">user_devices</code> (one row per{" "}
						<code className="text-xs">externalId</code>).
					</p>

					{loadingUsage ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">
							Loading…
						</div>
					) : errorUsage ? (
						<p className="text-sm text-red-600 dark:text-red-400" role="alert">
							{errorUsage}
						</p>
					) : (
						<div className="overflow-x-auto">
							{(() => {
								const uIos = usageStats?.users.ios ?? 0;
								const uAndroid = usageStats?.users.android ?? 0;
								const dIos = usageStats?.drivers.ios ?? 0;
								const dAndroid = usageStats?.drivers.android ?? 0;
								const allUsers = uIos + uAndroid;
								const allDrivers = dIos + dAndroid;
								const grandTotal = allUsers + allDrivers;
								return (
									<div className="w-full min-w-[520px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
										<div className="bg-brand-500 px-3 py-2 text-center text-sm font-semibold text-white">
											Grand total: {grandTotal}
										</div>
										<table className="w-full border-collapse text-sm">
										<thead>
											<tr>
												<th
													colSpan={2}
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													Users
												</th>
												<th
													colSpan={2}
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													Drivers
												</th>
											</tr>
											<tr>
												<th
													scope="col"
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													iOS
												</th>
												<th
													scope="col"
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													Android
												</th>
												<th
													scope="col"
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													iOS
												</th>
												<th
													scope="col"
													className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
												>
													Android
												</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td className="border border-gray-200 px-3 py-2 text-center dark:border-gray-700">
													{uIos}
												</td>
												<td className="border border-gray-200 px-3 py-2 text-center dark:border-gray-700">
													{uAndroid}
												</td>
												<td className="border border-gray-200 px-3 py-2 text-center dark:border-gray-700">
													{dIos}
												</td>
												<td className="border border-gray-200 px-3 py-2 text-center dark:border-gray-700">
													{dAndroid}
												</td>
											</tr>
										</tbody>
										<tfoot>
											<tr className="bg-gray-50 dark:bg-white/[0.03]">
												<td
													className="border border-gray-200 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
													colSpan={2}
												>
													Total: {allUsers}
												</td>
												<td
													className="border border-gray-200 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
													colSpan={2}
												>
													Total: {allDrivers}
												</td>
											</tr>
										</tfoot>
									</table>
									</div>
								);
							})()}
						</div>
					)}
				</div>

				<form
					onSubmit={onSendPush}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Push notifications
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Send a push to all users with status{" "}
						<strong className="font-medium">ACTIVE</strong> or to a specific user.
						Tokens are taken from <code className="text-xs">push_tokens</code>.
					</p>

					<div className="flex flex-col gap-5">
						<div className="max-w-xl">
							<Label className="mb-1">Recipient</Label>
							<div className="relative" ref={pushDropdownRef}>
								<button
									type="button"
									onClick={() => setPushOpen(v => !v)}
									className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${pushOpen ? "rounded-b-none" : ""}`}
								>
									<span className="flex min-w-0 items-center gap-2">
										{pushRecipientUserId && selectedPushUser ? (
											<>
												{renderAvatar(
													selectedPushUser,
													"w-6 h-6 flex-shrink-0"
												)}
												<span className="truncate">
													{getUserDisplayName(selectedPushUser)}
												</span>
											</>
										) : (
											<span className="truncate">All (ACTIVE)</span>
										)}
									</span>
									<span className="text-gray-400">▾</span>
								</button>

								{pushOpen && (
									<div className="absolute z-[100] w-full overflow-hidden rounded-b-lg border border-t-0 border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
										<div className="border-b border-gray-200 p-2 dark:border-gray-700">
											<input
												value={pushSearch}
												onChange={e => setPushSearch(e.target.value)}
												placeholder="Search by name or email…"
												className="h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/90"
											/>
										</div>
										<div
											className="max-h-[280px] overflow-y-auto"
											onScroll={onPushScroll}
										>
											<div
												onClick={() => {
													setPushRecipientUserId("");
													setPushOpen(false);
												}}
												className={`cursor-pointer px-3 py-2 text-sm ${
													!pushRecipientUserId
														? "bg-brand-500 text-white"
														: "text-gray-900 hover:bg-brand-500 hover:text-white dark:text-white"
												}`}
											>
												All (ACTIVE)
											</div>

											{pushUsers.map(u => {
												const isSelected = u.id === pushRecipientUserId;
												return (
													<div
														key={u.id}
														onClick={() => {
															setPushRecipientUserId(u.id);
															setPushOpen(false);
														}}
														className={`group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
															isSelected
																? "bg-brand-500 text-white"
																: "text-gray-900 hover:bg-brand-500 hover:text-white dark:text-white"
														}`}
													>
														{renderAvatar(
															u,
															`w-6 h-6 flex-shrink-0 ${
																isSelected
																	? "!bg-white !text-brand-600"
																	: "group-hover:!bg-white group-hover:!text-brand-600"
															}`
														)}
														<div className="min-w-0 flex-1">
															<div className="truncate">
																{getUserDisplayName(u)}
															</div>
															{u.email ? (
																<div
																	className={`truncate text-[11px] ${
																		isSelected
																			? "text-white/80"
																			: "text-gray-500 group-hover:text-white/80 dark:text-gray-400"
																	}`}
																>
																	{u.email}
																</div>
															) : null}
														</div>
													</div>
												);
											})}

											{pushUsersQuery.isFetchingNextPage ? (
												<div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-300">
													Loading…
												</div>
											) : null}
											{pushUsersQuery.isLoading ? (
												<div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-300">
													Loading…
												</div>
											) : null}
											{pushUsersQuery.error ? (
												<div className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
													Failed to load users
												</div>
											) : null}
										</div>
									</div>
								)}
							</div>
							<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
								The list is loaded from{" "}
								<code className="text-xs">GET /v1/users</code> with{" "}
								<code className="text-xs">status=ACTIVE</code> and cached for 2
								hours.
							</p>
						</div>

						{!pushRecipientUserId ? (
							<div className="max-w-xs">
								<Label htmlFor="pushPlatform" className="mb-1">
									Platform
								</Label>
								<select
									id="pushPlatform"
									value={pushPlatform}
									onChange={e =>
										setPushPlatform(e.target.value as "all" | "ios" | "android")
									}
									className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
								>
									<option value="all">All</option>
									<option value="ios">iOS</option>
									<option value="android">Android</option>
								</select>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Applies only when sending to{" "}
									<strong className="font-medium">All (ACTIVE)</strong>.
								</p>
							</div>
						) : null}

						<div className="max-w-2xl">
							<Label htmlFor="pushMessage" className="mb-1">
								Message
							</Label>
							<textarea
								id="pushMessage"
								value={pushMessage}
								onChange={e => setPushMessage(e.target.value)}
								placeholder="Enter push notification text…"
								className="min-h-[110px] w-full resize-y rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
							/>
						</div>
					</div>

					{pushError ? (
						<p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
							{pushError}
						</p>
					) : null}
					{pushSuccess ? (
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">
							{pushSuccess}
						</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pushSending || pageLoading}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{pushSending ? "Sending…" : "Send push"}
						</button>
					</div>
				</form>

				<form
					onSubmit={onSubmitMobile}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Mobile app — location throttling
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Shared settings for the driver app (one row in the database). Interval and
						distance control how often location is sent; reverse geocode distance
						controls how far a driver must move from the last successful address lookup
						before ZIP/city/state are resolved again.
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
										onChange={e => setIntervalMin(e.target.value)}
										placeholder="3"
										required
										className="!h-9 !min-h-0 !py-1.5"
									/>
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
										0 = no minimum time between sends (still limited by OS).
										Example: 3 = every 3 minutes. Max{" "}
										{LOCATION_INTERVAL_MAX_MINUTES} min (24 h). Stored on the
										server as milliseconds.
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
										onChange={e => setDistanceM(e.target.value)}
										placeholder="3000"
										required
										className="!h-9 !min-h-0 !py-1.5"
									/>
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
										0 = no distance gate (only interval applies). Otherwise
										displacement required before a send (together with
										interval). Mobile OS may still use at least 1 m for native
										callbacks.
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
									onChange={e => setReverseGeocodeM(e.target.value)}
									placeholder="5000"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									After moving this far from the last successful ZIP/city/state
									lookup, the app runs Expo then Nominatim. Default 5000 m (5 km).
									Range 100–500000.
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
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">
							{successMobile}
						</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingMobile || savingEnv || savingOffers}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savingMobile ? "Saving…" : "Save mobile app settings"}
						</button>
					</div>
				</form>

				<form
					onSubmit={onSubmitOffers}
					className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
				>
					<h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Offers
					</h2>
					<p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
						Maximum number of{" "}
						<strong className="font-medium">active, unassigned</strong> offers a driver
						can place a bid on at the same time. Assigned loads do not count toward this
						limit. Default 2. Mobile apps read this from GET /v1/app-settings and get
						live updates via WebSocket{" "}
						<code className="text-xs">appLocationSettingsUpdated</code>.
					</p>

					{loadingOffers ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">
							Loading…
						</div>
					) : (
						<div className="max-w-xl">
							<Label htmlFor="maxDriverOpenOfferParticipations" className="mb-1">
								Max concurrent open bids per driver
							</Label>
							<Input
								id="maxDriverOpenOfferParticipations"
								name="maxDriverOpenOfferParticipations"
								type="number"
								min="1"
								max="50"
								step={1}
								value={maxOpenOfferParticipationsInput}
								onChange={e => setMaxOpenOfferParticipationsInput(e.target.value)}
								placeholder="2"
								required
								className="!h-9 !min-h-0 !py-1.5"
							/>
							<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Integer from 1 to 50.
							</p>
						</div>
					)}

					{errorOffers ? (
						<p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
							{errorOffers}
						</p>
					) : null}
					{successOffers ? (
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">
							{successOffers}
						</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingOffers}
							className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savingOffers ? "Saving…" : "Save offers settings"}
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
						In <strong className="font-medium">test</strong> mode, only the driver with
						the configured TMS <code className="text-xs">externalId</code> may call{" "}
						<code className="text-xs">PUT /users/:id/location</code> (automatic or
						manual). All other drivers get 403. TMS batch cron also sends only that
						driver. Use <strong className="font-medium">live</strong> for production.
					</p>

					{loadingEnv ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">
							Loading…
						</div>
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
									onChange={e => setLocationTestDriverExternalId(e.target.value)}
									placeholder="3343"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Must match <code className="text-xs">users.externalId</code>{" "}
									exactly (trimmed). Default 3343.
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
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">
							{successEnv}
						</p>
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
						Server-side job that sends driver locations to TMS in batches (drivers with
						automatic location updates enabled). This does not affect how often the
						mobile app writes to our database. Saved separately from mobile throttling
						above.
					</p>

					{loadingTms ? (
						<div className="flex min-h-[80px] items-center justify-center text-sm text-gray-500">
							Loading…
						</div>
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
									onChange={e => setTmsCronIntervalMin(e.target.value)}
									placeholder="5"
									required
									className="!h-9 !min-h-0 !py-1.5"
								/>
								<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
									How often the backend may run a full TMS batch sync (e.g. 5 =
									every 5 minutes). Range 1–1440 min (1 min–24 h). Stored on the
									server as seconds.
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
									onChange={e => setTmsBatchSize(e.target.value)}
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
						<p className="mt-4 text-sm text-green-600 dark:text-green-400">
							{successTms}
						</p>
					) : null}

					<div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
						<button
							type="submit"
							disabled={pageLoading || savingTms || savingEnv || savingOffers}
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
