"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import { useResolvedDriverLastActiveApp } from "@/hooks/useResolvedDriverLastActiveApp";
import { formatNyWallClockForDisplay } from "@/utils/nyWallClock";

export type EmbeddedTrackingDriverSheetData = {
	id?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
	externalId?: string | null;
	phone?: string | null;
	profilePhoto?: string | null;
	driverStatus?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	lastLocationUpdateAt?: string | null;
	lastActiveApp?: string | null;
	driverStatusLabel?: string | null;
	loadStatusLabel?: string | null;
	loadNumber?: string | null;
	loadId?: string | null;
	totalMiles?: string | null;
	currentLocation?: string | null;
};

type EmbeddedTrackingDriverSheetProps = {
	isOpen: boolean;
	onToggle: () => void;
	driver: EmbeddedTrackingDriverSheetData;
	/** Offset below Map/Hybrid control (embedded: top-4 + control height + gap). */
	toggleTopClassName?: string;
};

function getInitials(firstName?: string | null, lastName?: string | null): string {
	const first = String(firstName ?? "").trim();
	const last = String(lastName ?? "").trim();
	const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
	return initials || "DR";
}

function formatPhoneDialUrl(phone?: string | null): string | null {
	const digits = String(phone ?? "").replace(/[^\d+]/g, "");
	return digits ? `tel:${digits}` : null;
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-0">
			<p className="mb-1.5 font-[Manrope,sans-serif] text-[9px] font-medium uppercase leading-[13px] text-[#637899]">
				{label}
			</p>
			<div className="font-[Manrope,sans-serif] text-[12px] font-medium leading-[17px] text-[#09172E] [overflow-wrap:anywhere]">
				{children}
			</div>
		</div>
	);
}

export default function EmbeddedTrackingDriverSheet({
	isOpen,
	onToggle,
	driver,
	toggleTopClassName = "top-16",
}: EmbeddedTrackingDriverSheetProps) {
	const [isPushModalOpen, setIsPushModalOpen] = useState(false);
	const { usesMobileApp } = useResolvedDriverLastActiveApp(
		driver.externalId,
		driver.lastActiveApp
	);

	const pushModalDriver = useMemo((): CheckListDriver | null => {
		const id = driver.id?.trim() || driver.externalId?.trim();
		if (!id) return null;
		return {
			id,
			firstName: driver.firstName ?? "",
			lastName: driver.lastName ?? "",
			email: driver.email?.trim() ?? "",
			externalId: driver.externalId ?? null,
			phone: driver.phone ?? "",
			driverStatus: driver.driverStatus ?? null,
			lastActiveApp: driver.lastActiveApp ?? null,
			lastLocationUpdateAt: driver.lastLocationUpdateAt ?? null,
			trackingLoadId: driver.loadId?.trim() ?? null,
		};
	}, [driver]);

	const showSendPushButton = usesMobileApp && pushModalDriver !== null;
	const fullName =
		`${String(driver.firstName ?? "").trim()} ${String(driver.lastName ?? "").trim()}`.trim() ||
		"Driver";
	const unitLabel = driver.externalId?.trim()
		? `Unit #${driver.externalId.trim()}  ·  Tracking active`
		: "Tracking active";
	const hasCoordinates =
		Number.isFinite(driver.latitude) && Number.isFinite(driver.longitude);
	const coordinatesLabel = hasCoordinates
		? `${Number(driver.latitude).toFixed(6)}, ${Number(driver.longitude).toFixed(6)}`
		: "N/A";
	const lastUpdateLabel =
		formatNyWallClockForDisplay(driver.lastLocationUpdateAt ?? null) || "N/A";
	const phoneDialUrl = formatPhoneDialUrl(driver.phone);
	const loadNumber = driver.loadNumber?.trim() || null;
	const loadHref = driver.loadId?.trim()
		? `/tracking/load/${encodeURIComponent(driver.loadId.trim())}`
		: null;

	return (
		<>
			<button
				type="button"
				onClick={onToggle}
				className={`absolute left-4 z-[1000] inline-flex h-7 min-w-0 items-center justify-center rounded-full bg-[rgba(68,119,255,0.76)] px-2.5 font-[Manrope,sans-serif] text-[10px] font-semibold leading-[14px] text-white shadow-[0_3px_10px_rgba(13,31,61,0.08)] transition-colors hover:bg-[rgba(68,119,255,0.9)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 min-[1728px]:h-10 min-[1728px]:min-w-[121px] min-[1728px]:px-4 min-[1728px]:text-xs min-[1728px]:leading-[17px] ${toggleTopClassName}`}
				aria-expanded={isOpen}
				aria-controls="embedded-tracking-driver-sheet"
			>
				{isOpen ? "Hide driver" : "Show driver"}
			</button>

			{isOpen ? (
				<div
					id="embedded-tracking-driver-sheet"
					className="absolute inset-x-0 bottom-0 z-[1000] max-h-[70%] overflow-hidden rounded-t-[30px] bg-[#FBFCFF] shadow-[0_-7px_24px_rgba(20,51,89,0.12)]"
				>
					<div className="min-h-0 overflow-y-auto px-5 pb-5 pt-5">
						<div className="mb-4 flex items-center gap-3 border-b border-[#DBE3F0] pb-[18px]">
							<div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F2FF]">
								{driver.profilePhoto ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={driver.profilePhoto}
										alt=""
										className="h-full w-full object-cover"
									/>
								) : (
									<span className="font-[Manrope,sans-serif] text-base font-semibold leading-[22px] text-[#3D6EF5]">
										{getInitials(driver.firstName, driver.lastName)}
									</span>
								)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-[Manrope,sans-serif] text-[17px] font-semibold leading-6 text-[#09172E]">
									{fullName}
								</p>
								<p className="mt-0.5 font-[Manrope,sans-serif] text-[11px] font-medium leading-[15px] text-[#3D6EF5]">
									{unitLabel}
								</p>
							</div>
							{showSendPushButton ? (
								<button
									type="button"
									onClick={() => setIsPushModalOpen(true)}
									className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#4967f2] bg-white px-3 font-[Manrope,sans-serif] text-[11px] font-medium leading-[15px] text-[#4967f2] transition hover:bg-[#f5f7ff]"
								>
									<Bell className="h-3.5 w-3.5" strokeWidth={1.7} />
									Send Push
								</button>
							) : null}
						</div>

						<div className="grid grid-cols-2 gap-x-5 gap-y-[18px]">
							<Field label="Phone">
								{phoneDialUrl && driver.phone?.trim() ? (
									<a
										href={phoneDialUrl}
										className="text-[#4477FF] underline-offset-2 hover:underline"
									>
										{driver.phone.trim()}
									</a>
								) : (
									"N/A"
								)}
							</Field>
							<Field label="Coordinates">{coordinatesLabel}</Field>
							<Field label="Load number">
								{loadNumber && loadHref ? (
									<Link
										href={loadHref}
										className="text-[#4477FF] underline-offset-2 hover:underline"
									>
										#{loadNumber.replace(/^#/, "")}
									</Link>
								) : loadNumber ? (
									`#${loadNumber.replace(/^#/, "")}`
								) : (
									"N/A"
								)}
							</Field>
							<Field label="Last update">{lastUpdateLabel}</Field>
							<Field label="Driver status">
								{driver.driverStatusLabel?.trim() || "N/A"}
							</Field>
							<Field label="Load status">
								{driver.loadStatusLabel?.trim() || "N/A"}
							</Field>
							<Field label="Total miles">
								{driver.totalMiles?.trim()
									? `${driver.totalMiles.trim()} mi`
									: "N/A"}
							</Field>
							<Field label="Current location">
								{driver.currentLocation?.trim() || "N/A"}
							</Field>
						</div>
					</div>
				</div>
			) : null}

			<CheckListPushModal
				isOpen={isPushModalOpen}
				onClose={() => setIsPushModalOpen(false)}
				drivers={isPushModalOpen && pushModalDriver ? [pushModalDriver] : null}
			/>
		</>
	);
}
