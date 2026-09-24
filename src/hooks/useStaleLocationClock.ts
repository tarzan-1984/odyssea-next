"use client";

import { useEffect, useState } from "react";

/** Shared 30s tick so open chat list/header re-evaluate stale location without a cron. */
const INTERVAL_MS = 30_000;

let sharedNowMs = Date.now();
const listeners = new Set<() => void>();
// `window.setInterval` returns `number` in the browser; avoid Node `Timeout` clash.
let intervalId: number | null = null;

function ensureSharedInterval(): void {
	if (typeof window === "undefined") return;
	if (intervalId != null) return;
	intervalId = window.setInterval(() => {
		sharedNowMs = Date.now();
		listeners.forEach(listener => listener());
	}, INTERVAL_MS);
}

/**
 * Returns a monotonic "now" that advances every 30s while any subscriber is mounted.
 * Used for live stale-location checks in chat (same idea as tracking map wall-clock).
 */
export function useStaleLocationClock(): number {
	const [, setTick] = useState(0);

	useEffect(() => {
		const onTick = () => setTick(n => n + 1);
		listeners.add(onTick);
		ensureSharedInterval();
		return () => {
			listeners.delete(onTick);
			if (listeners.size === 0 && intervalId != null) {
				window.clearInterval(intervalId);
				intervalId = null;
			}
		};
	}, []);

	return sharedNowMs;
}
