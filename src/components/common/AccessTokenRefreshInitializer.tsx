"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { clientAuth } from "@/utils/auth";
import {
	runBrowserAccessTokenRefresh,
	getMsUntilProactiveRefreshCheck,
} from "@/utils/accessTokenRefresh";

const VISIBILITY_DEBOUNCE_MS = 1500;

/**
 * Proactive access JWT refresh for long-lived Next tabs: timer from JWT `exp`, plus check on tab focus.
 */
export default function AccessTokenRefreshInitializer() {
	const pathname = usePathname();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastVisibilityRef = useRef(0);

	useEffect(() => {
		const clearTimer = () => {
			if (timeoutRef.current != null) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};

		const scheduleNext = () => {
			clearTimer();
			const refresh = clientAuth.getRefreshToken();
			if (!refresh) return;
			const access = clientAuth.getAccessToken();
			const delay = getMsUntilProactiveRefreshCheck(access);
			if (delay == null) return;
			timeoutRef.current = setTimeout(() => {
				onTick().catch(() => {});
			}, delay);
		};

		const onTick = async () => {
			const refresh = clientAuth.getRefreshToken();
			if (!refresh) return;

			const outcome = await runBrowserAccessTokenRefresh();

			if (outcome === "auth_lost") {
				clearTimer();
				clientAuth.removeTokens();
				if (!pathname?.startsWith("/signin")) {
					window.location.assign("/signin");
				}
				return;
			}

			if (outcome === "refreshed" || outcome === "skipped") {
				scheduleNext();
			}
		};

		onTick().catch(() => {});

		const onVisibility = () => {
			if (document.visibilityState !== "visible") return;
			const t = Date.now();
			if (t - lastVisibilityRef.current < VISIBILITY_DEBOUNCE_MS) return;
			lastVisibilityRef.current = t;
			onTick().catch(() => {});
		};

		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			clearTimer();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [pathname]);

	return null;
}
