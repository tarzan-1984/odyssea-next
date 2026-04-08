/**
 * Client-side JWT access maintenance (same idea as Expo): decode `exp` without verifying signature,
 * call Next `/api/authentication/refresh` when expired or within 2 days of expiry.
 */

import authentication from "@/app-api/authentication";
import { clientAuth } from "@/utils/auth";

export const ACCESS_TOKEN_REFRESH_THRESHOLD_SEC = 2 * 24 * 60 * 60;

const MAX_TIMER_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_TIMER_MS = 60 * 1000;

function decodeJwtPayloadExp(accessToken: string): number | null {
	try {
		const parts = accessToken.split(".");
		if (parts.length < 2 || !parts[1]) return null;
		let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const pad = base64.length % 4;
		if (pad) base64 += "=".repeat(4 - pad);
		const json = atob(base64);
		const payload = JSON.parse(json) as { exp?: number };
		return typeof payload.exp === "number" ? payload.exp : null;
	} catch {
		return null;
	}
}

export function accessTokenNeedsProactiveRefresh(accessToken: string | undefined): boolean {
	if (!accessToken?.trim()) return true;
	const exp = decodeJwtPayloadExp(accessToken);
	if (exp == null) return true;
	const nowSec = Math.floor(Date.now() / 1000);
	if (nowSec >= exp) return true;
	const secondsLeft = exp - nowSec;
	return secondsLeft <= ACCESS_TOKEN_REFRESH_THRESHOLD_SEC;
}

export type BrowserRefreshOutcome = "refreshed" | "skipped" | "auth_lost" | "no_session";

let refreshInFlight: Promise<BrowserRefreshOutcome> | null = null;

/**
 * Single-flight refresh: updates encoded access cookie via clientAuth on success.
 */
export function runBrowserAccessTokenRefresh(): Promise<BrowserRefreshOutcome> {
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async (): Promise<BrowserRefreshOutcome> => {
		try {
			const refreshToken = clientAuth.getRefreshToken();
			if (!refreshToken?.trim()) {
				return "no_session";
			}

			const accessToken = clientAuth.getAccessToken();

			if (!accessTokenNeedsProactiveRefresh(accessToken)) {
				return "skipped";
			}

			const res = await authentication.refreshToken({ refreshToken });
			if (!res.success || !res.accessToken) {
				return "auth_lost";
			}

			clientAuth.setAccessToken(res.accessToken);
			return "refreshed";
		} catch {
			return "auth_lost";
		} finally {
			refreshInFlight = null;
		}
	})();

	return refreshInFlight;
}

/**
 * Milliseconds until we should run refresh again (2 days before exp), capped for long-lived tokens.
 */
export function getMsUntilProactiveRefreshCheck(accessToken: string | undefined): number | null {
	if (!accessToken?.trim()) return null;
	const exp = decodeJwtPayloadExp(accessToken);
	if (exp == null) return MIN_TIMER_MS;
	const now = Date.now();
	const thresholdMs = ACCESS_TOKEN_REFRESH_THRESHOLD_SEC * 1000;
	const targetTime = exp * 1000 - thresholdMs;
	const raw = Math.max(MIN_TIMER_MS, targetTime - now);
	return Math.min(raw, MAX_TIMER_MS);
}
