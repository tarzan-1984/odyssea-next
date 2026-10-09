"use client";

import type { ReactNode } from "react";

type TrackingStatusTone = "success" | "info" | "warning";
type TrackingStatusIcon = "delivered" | "phone" | "status" | "load";

type TrackingStatusCardProps = {
	tone: TrackingStatusTone;
	icon: TrackingStatusIcon;
	title: string;
	children: ReactNode;
};

const TONE_COLOR: Record<TrackingStatusTone, string> = {
	success: "#20AD6D",
	info: "#3D6EF5",
	warning: "#FB811D",
};

/** Shared map plaque: halo, title, and situation-specific copy. */
export default function TrackingStatusCard({
	tone,
	icon,
	title,
	children,
}: TrackingStatusCardProps) {
	return (
		<div className="w-full max-w-[531px] rounded-2xl bg-white px-6 pb-6 pt-1.5 text-center font-[Manrope,sans-serif] shadow-[0_4px_40px_rgba(94,97,107,0.1)] [overflow-wrap:anywhere]">
			<StatusMark color={TONE_COLOR[tone]} icon={icon} />
			<p className="text-[16px] font-bold leading-5 text-black">{title}</p>
			<div className="mt-2 text-[15px] font-medium leading-5 text-[#637899]">{children}</div>
		</div>
	);
}

function StatusMark({ color, icon }: { color: string; icon: TrackingStatusIcon }) {
	return (
		<div className="relative mx-auto mb-1 flex h-[99px] w-[99px] items-center justify-center">
			<span className="absolute inset-0 rounded-full opacity-20" style={{ backgroundColor: color }} />
			<span
				className="absolute h-[66px] w-[66px] rounded-full opacity-[0.08]"
				style={{ backgroundColor: color }}
			/>
			<span
				className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
				style={{ backgroundColor: color }}
			>
				<StatusGlyph icon={icon} />
			</span>
		</div>
	);
}

function StatusGlyph({ icon }: { icon: TrackingStatusIcon }) {
	if (icon === "delivered") {
		return (
			<svg width="18" height="18" viewBox="0 0 19 19" fill="none" aria-hidden="true">
				<path
					d="M14.8437 7.43452V4.74998C14.8437 3.54903 13.8675 2.57291 12.6666 2.57291H11.5377C11.3144 2.10662 10.8418 1.78124 10.2916 1.78124H7.12493C6.57472 1.78124 6.1021 2.10662 5.87885 2.57291H4.74993C3.54898 2.57291 2.57286 3.54903 2.57286 4.74998V15.0416C2.57286 16.2426 3.54898 17.2187 4.74993 17.2187H11.8749C14.8215 17.2187 17.2187 14.8215 17.2187 11.875C17.2187 10.0264 16.2742 8.39481 14.8437 7.43452ZM6.92701 3.16666C6.92701 3.05741 7.01568 2.96874 7.12493 2.96874H10.2916C10.4008 2.96874 10.4895 3.05741 10.4895 3.16666V3.95832C10.4895 4.06757 10.4008 4.15624 10.2916 4.15624H7.12493C7.01568 4.15624 6.92701 4.06757 6.92701 3.95832V3.16666ZM4.74993 16.0312C4.20448 16.0312 3.76035 15.5871 3.76035 15.0416V4.74998C3.76035 4.20453 4.20448 3.7604 4.74993 3.7604H5.73951V3.95832C5.73951 4.72228 6.36097 5.34373 7.12493 5.34373H10.2916C11.0555 5.34373 11.677 4.72228 11.677 3.95832V3.7604H12.6666C13.212 3.7604 13.6562 4.20453 13.6562 4.74998V6.84315C13.098 6.64523 12.5003 6.53123 11.8749 6.53123C8.92834 6.53123 6.53118 8.92839 6.53118 11.875C6.53118 13.5525 7.31018 15.0511 8.5238 16.0312H4.74993ZM11.8749 16.0312C9.58305 16.0312 7.71868 14.1668 7.71868 11.875C7.71868 9.5831 9.58305 7.71873 11.8749 7.71873C14.1668 7.71873 16.0312 9.5831 16.0312 11.875C16.0312 14.1668 14.1668 16.0312 11.8749 16.0312Z"
					fill="white"
				/>
				<path
					d="M14.6694 9.87206C14.4375 9.6401 14.0614 9.6401 13.8295 9.87206L11.0824 12.6191L9.91866 11.4554C9.68671 11.2234 9.31067 11.2234 9.07871 11.4554C8.84675 11.6873 8.84675 12.0634 9.07871 12.2953L10.3818 13.5984C10.5742 13.7916 10.8275 13.8874 11.0816 13.8874C11.3357 13.8874 11.5891 13.7916 11.7815 13.5984L14.6679 10.712C14.8998 10.4801 14.8998 10.104 14.6679 9.87206H14.6694Z"
					fill="white"
				/>
			</svg>
		);
	}

	if (icon === "phone") {
		return (
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<rect x="4.25" y="1.25" width="7.5" height="13.5" rx="1.6" stroke="white" strokeWidth="1.4" />
				<path d="M7 12.75h2" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
			</svg>
		);
	}

	if (icon === "load") {
		return (
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path
					d="M1.5 4.2A1.2 1.2 0 0 1 2.7 3h6.2A1.2 1.2 0 0 1 10.1 4.2V5.2h1.7c.3 0 .6.1.8.4l1.8 2.1c.2.2.3.5.3.8v2.2a.8.8 0 0 1-.8.8h-.6a1.45 1.45 0 0 1-2.8 0H6.5a1.45 1.45 0 0 1-2.8 0H2.7A1.2 1.2 0 0 1 1.5 10.3V4.2Zm8.6 2.1v2.6h2.6L11.4 6.7a.3.3 0 0 0-.2-.1h-1.1v-.3ZM5.1 12.2a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Zm6.1 0a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Z"
					fill="white"
				/>
			</svg>
		);
	}

	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6Zm0 2.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm.7 7.1h-1.4V6.7h1.4v4.5Z"
				fill="white"
			/>
		</svg>
	);
}
