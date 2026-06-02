"use client";

import Checkbox from "@/components/form/input/Checkbox";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { HEADER_TIME_ZONES } from "@/constants/headerTimeZones";
import { useAdminNotificationSoundStore } from "@/stores/adminNotificationSoundStore";
import { useEffect, useMemo, useRef, useState } from "react";

function useTzClock(timeZone: string): string {
	const [now, setNow] = useState<Date | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		setNow(new Date());
		const id = window.setInterval(() => setNow(new Date()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const formatter = useMemo(
		() =>
			new Intl.DateTimeFormat("en-US", {
				timeZone,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false,
			}),
		[timeZone]
	);

	if (!mounted || !now) return "--:--:--";
	return formatter.format(now);
}

function TimeZoneClockCell({ label, time }: { label: string; time: string }) {
	return (
		<div className="flex min-w-max shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
			<span className="whitespace-nowrap text-sm font-semibold leading-tight text-gray-600 dark:text-gray-300">
				{label}
			</span>
			<span className="whitespace-nowrap text-sm font-medium tabular-nums leading-tight text-gray-800 dark:text-gray-100">
				{time}
			</span>
		</div>
	);
}

function TimeZoneClock({ label, timeZone }: { label: string; timeZone: string }) {
	const time = useTzClock(timeZone);
	return <TimeZoneClockCell label={label} time={time} />;
}

export default function HeaderTimeZonesBar() {
	const anchorRef = useRef<HTMLButtonElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const visibleTimeZones = useAdminNotificationSoundStore(s => s.visibleHeaderTimeZones);
	const toggleTimeZone = useAdminNotificationSoundStore(s => s.toggleHeaderTimeZoneVisibility);

	const visibleZones = useMemo(
		() => HEADER_TIME_ZONES.filter(z => visibleTimeZones.includes(z.timeZone)),
		[visibleTimeZones]
	);

	const selectedCount = visibleZones.length;

	return (
		<div className="hidden min-w-0 flex-1 items-center gap-1.5 xl:flex xl:ml-2">
			<button
				ref={anchorRef}
				type="button"
				className="dropdown-toggle flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
				onClick={() => setMenuOpen(open => !open)}
				aria-expanded={menuOpen}
				aria-haspopup="listbox"
				aria-label="Choose time zones to show in header"
			>
				<svg
					className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
					viewBox="0 0 122.88 119.08"
					fill="currentColor"
					aria-hidden
				>
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M55.27,0c29.86,0,54.19,23.69,55.23,53.29c-2.28-1.25-4.7-2.29-7.23-3.08c0.08-0.88,0.32-1.11,0.57-2.19 l1.76,0.19c-2.68-19.88-16.6-36.2-35.14-42.37l0,0l-6.81,1.98v-1.8l-1.2,0L62.4,7.69l-2.67,0.73l-0.34,1.25l-3.57-2.94l4.81,0.49 c-0.83-1.13-5.9-3-7.8-3l-1.8,0c-1.94,0-8.05,5.14-10.82,6.6l0.65,3.14l3.5-0.72l0.54,2.58l-2.27-1.41c-0.01,0.01-0.6,1.12-0.6,1.2 c0,1.37,0.2,0.7,0.37,1.96l-8.77,4.04v1.2l0.65-0.4l1.75,4l-5.4,0v6c2.38,0.2,1.45,0.6,3,0.6c2.33,0,2.94-1.12,3.25-3.35l2.89-2.77 l2.93-1.15l4.89,5.13l-1.96,0.94c2.1,2.91,2.16-1.24,2.66-2.68l-3.81-4l0.59-0.58l4.47,3.19l2.08,5.28c0.53-0.3,1.2-0.39,1.2-1.2 c0-1.37-0.2-0.7-0.58-2.33l2.08-0.55l2.09,4.56l4.81-0.47c0,2.38-0.12,5.4-2.4,5.4h-1.2c-3.31,0-4.01-1.2-6.7-1.83l-0.56,2.56 l-5.94-2.53v-4.2l-5.4,0c-1.96,0-1.58,1.8-4.8,1.8l-1.5,0.26l-2.7,2.75v3c-1.96,1.31-4.8,4.69-4.8,7.8v7.2c0,0.85,3.83,7.8,6,7.8 h2.4c2.62,0,2.18-1.2,4.8-1.2h0.6c1.66,0,1.44,0.46,1.8,1.8h2.4v4.8c0,0.76,3,4.91,3,7.8c0,3.13-1.2,3.47-1.2,6 c0,2.98,3,8.99,3,13.2l3.6,0c0.45,0,0.89-0.06,1.32-0.17c1.07,5.55,3.3,10.68,6.43,15.14c-1.36,0.1-2.74,0.15-4.12,0.15 C24.75,110.53,0,85.79,0,55.27C0,24.75,24.75,0,55.27,0L55.27,0L55.27,0z M91.57,56.46c17.29,0,31.31,14.02,31.31,31.31 c0,17.29-14.02,31.31-31.31,31.31s-31.31-14.02-31.31-31.31C60.26,70.48,74.28,56.46,91.57,56.46L91.57,56.46L91.57,56.46z M87.23,74.07h3.83c0.7,0,1.27,0.58,1.27,1.27v12.69h12.43c0.7,0,1.27,0.58,1.27,1.27v3.83c0,0.7-0.58,1.27-1.27,1.27H85.95V75.35 C85.95,74.64,86.52,74.07,87.23,74.07L87.23,74.07L87.23,74.07z M91.57,63.57c13.37,0,24.2,10.83,24.2,24.2 c0,13.37-10.83,24.2-24.2,24.2c-13.37,0-24.2-10.83-24.2-24.2C67.37,74.41,78.2,63.57,91.57,63.57L91.57,63.57L91.57,63.57z M96.16,48.71l-0.56-1.73l-1.48,1.54C94.81,48.57,95.49,48.63,96.16,48.71L96.16,48.71z M85.48,48.91l-0.27-1.52l-1.28,0.93 l-2.9-3.91l-4.33,0.13l-1.66-1.9l-1.7,0.47l-3.34-3.83l-0.64,0.44l2.07,5.29l2.4,0v-1.2l1.2,0c0.87,2.39,1.8,0.97,1.8,2.4 c0,4.99-6.16,8.66-10.2,9.6c0.11,0.48,0.14,0.95,0.3,1.29C72.18,52.9,78.53,49.99,85.48,48.91L85.48,48.91z M10.58,83.82 c-3.26-4.94-5.69-10.47-7.12-16.39l9.73,4.69l0.05,2.9c0,1.07-1.82,3.34-2.4,4.2L10.58,83.82L10.58,83.82L10.58,83.82z"
					/>
				</svg>
				<span className="whitespace-nowrap">Time zones</span>
				<span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
					{selectedCount}
				</span>
			</button>

			<Dropdown
				isOpen={menuOpen}
				onClose={() => setMenuOpen(false)}
				anchorRef={anchorRef}
				className="w-[min(100vw-2rem,22rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
					Select clocks for the header. Saved in this browser (same as notification sound
					settings).
				</p>
				<ul className="max-h-[min(60vh,20rem)] space-y-2 overflow-y-auto pr-1">
					{HEADER_TIME_ZONES.map(zone => {
						const checked = visibleTimeZones.includes(zone.timeZone);
						const isLastSelected = checked && selectedCount <= 1;
						return (
							<li key={zone.timeZone}>
								<Checkbox
									id={`header-tz-${zone.timeZone}`}
									label={zone.label}
									checked={checked}
									disabled={isLastSelected}
									onChange={() => toggleTimeZone(zone.timeZone)}
								/>
							</li>
						);
					})}
				</ul>
			</Dropdown>

			<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-visible py-0.5 [-ms-overflow-style:auto] [scrollbar-gutter:stable]">
				{visibleZones.map(zone => (
					<TimeZoneClock key={zone.timeZone} label={zone.label} timeZone={zone.timeZone} />
				))}
			</div>
		</div>
	);
}
