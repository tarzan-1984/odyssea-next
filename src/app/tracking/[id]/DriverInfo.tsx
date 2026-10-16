"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStatusLabelForFilter } from "@/components/logistics/driversMapConstants";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";
import { formatDriverLocationLine } from "@/utils/formatDriverLocation";
import { useResolvedDriverLastActiveApp } from "@/hooks/useResolvedDriverLastActiveApp";
import { formatNyWallClockForDisplay } from "@/utils/nyWallClock";
import { useCurrentUser } from "@/stores/userStore";
import { canSeeLoadStaleLocationSystemMessage } from "@/utils/systemMessageKind";
import LoadChatRestStatusIcon from "@/components/chats/LoadChatRestStatusIcon";
import SetLoadRestModal from "@/components/chats/SetLoadRestModal";
import {
	buildLoadLocationUpdateMessage,
	formatCurrentLocationForUpdate,
	formatMilesLeftForLocationUpdate,
} from "@/utils/loadLocationUpdateMessage";
import { fetchCustomerLoadTrackingLink } from "@/lib/customerLoadTrackingLink";
import {
	Bell,
	FileText,
	Link2,
	MessageSquare,
} from "lucide-react";

const tmsCardButtonClass =
	"inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

type TrackingInfoIconProps = { className?: string };

function FigmaTrackingIcon({ name, className }: TrackingInfoIconProps & { name: string }) {
	return <img src={`/images/tracking-info/${name}.svg`} className={className} alt="" aria-hidden />;
}

function ContactInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="contact" className={className} />; }
function LocationInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="location" className={className} />; }

function CopyInfoIcon({ className }: TrackingInfoIconProps) {
	return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden><rect x="8" y="4" width="11" height="13" rx="1.8" stroke="currentColor" strokeWidth="1.6" /><path d="M16 17v1.2A1.8 1.8 0 0 1 14.2 20H5.8A1.8 1.8 0 0 1 4 18.2V8.8A1.8 1.8 0 0 1 5.8 7H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function MilesInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="total-miles" className={className} />; }
function DriverStatusInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="driver-status" className={className} />; }
function RefreshInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="last-update" className={className} />; }
function LoadStatusInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="load-status" className={className} />; }
function RouteInfoIcon({ className }: TrackingInfoIconProps) { return <FigmaTrackingIcon name="route" className={className} />; }

function StopPinIcon({ className }: TrackingInfoIconProps) {
	return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M17.5 10c0 4.1-5.5 8-5.5 8s-5.5-3.9-5.5-8a5.5 5.5 0 1 1 11 0Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

export function getDriverInfoCardWidthClass(hasRoute: boolean): string {
	return hasRoute
		? "w-full max-w-[1202px]"
		: "w-[min(calc(100vw-3rem),56rem)]";
}

function showClipboardToast(title: string, message: string, variant: "success" | "error"): void {
	const addSystemToast = (
		window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void }
	).addSystemToastNotification;
	if (typeof addSystemToast !== "function") return;

	addSystemToast({
		id: `clipboard-${Date.now()}`,
		title,
		message,
		variant,
	});
}

interface DriverData {
	id?: string | null;
	email?: string | null;
	externalId: string | null;
	firstName: string;
	lastName: string;
	phone: string;
	profilePhoto: string | null;
	driverStatus: string | null;
	status: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	latitude: number | null;
	longitude: number | null;
	lastLocationUpdateAt: string | null;
	lastActiveApp?: string | null;
}

type StaleLocationBanner = {
	thresholdLabel: string;
	/** When true, note that map and load history stay hidden until a fresh update. */
	hidesMap?: boolean;
};

interface DriverInfoProps {
	driverData: DriverData | null;
	/** TMS load post id for "Show in TMS" link (tracking load page). */
	loadId?: string;
	/** Display value for "Load number" (TMS meta_data.reference_number). */
	loadNumber?: string | null;
	/** Human-readable load status from TMS meta_data.load_status. */
	loadStatusLabel?: string | null;
	/** Raw TMS load status. Hides the customer tracking link for closed loads. */
	loadStatus?: string | null;
	/** Multiline route details (pick up / delivery, address, time). */
	routeDetails?: string | null;
	/** Total loaded miles for the load route (TMS meta_data.all_miles). */
	routeTotalMiles?: string | null;
	/** Remaining road miles to next stop (same snapshot as LOAD chat). */
	remainingMiles?: number | null;
	/** When false, Copy Location Update omits the miles line (busy on another load). */
	includeLocationUpdateMiles?: boolean;
	/** Load tracking page: hide chat/TMS/push only when driver has no mobile app. */
	showLoadTrackingActions?: boolean;
	/** Full-width stale location warning at the top of the card. */
	staleLocationBanner?: StaleLocationBanner | null;
	/** Load rest state from loads.is_rest. */
	isRest?: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
	onRestChanged?: (update: {
		isRest: boolean;
		restDate?: string | null;
		restStartedAt?: string | null;
	}) => void;
}

const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";
const TMS_LOAD_PAGE_URL = "https://www.endurance-tms.com/add-load/";

export default function DriverInfo({
	driverData,
	loadId,
	loadNumber,
	loadStatusLabel,
	loadStatus,
	routeDetails,
	routeTotalMiles,
	remainingMiles = null,
	includeLocationUpdateMiles = true,
	showLoadTrackingActions = true,
	staleLocationBanner = null,
	isRest = false,
	restDate = null,
	restStartedAt = null,
	onRestChanged,
}: DriverInfoProps) {
	const [isPushModalOpen, setIsPushModalOpen] = useState(false);
	const [isRestModalOpen, setIsRestModalOpen] = useState(false);
	const [locationUpdateCopied, setLocationUpdateCopied] = useState(false);
	const [isCopyingTrackingLink, setIsCopyingTrackingLink] = useState(false);
	const currentUser = useCurrentUser();
	const { resolvedLastActiveApp, usesMobileApp } = useResolvedDriverLastActiveApp(
		driverData?.externalId,
		driverData?.lastActiveApp
	);

	const pushModalDriver = useMemo((): CheckListDriver | null => {
		if (!driverData) return null;
		const id = driverData.id?.trim() || driverData.externalId?.trim();
		if (!id) return null;
		return {
			id,
			firstName: driverData.firstName,
			lastName: driverData.lastName,
			email: driverData.email?.trim() ?? "",
			externalId: driverData.externalId,
			phone: driverData.phone ?? "",
			driverStatus: driverData.driverStatus,
			lastActiveApp: driverData.lastActiveApp ?? null,
			lastLocationUpdateAt: driverData.lastLocationUpdateAt,
			trackingLoadId: loadId?.trim() ?? null,
		};
	}, [driverData, loadId]);

	useEffect(() => {
		setLocationUpdateCopied(false);
	}, [loadId, driverData?.id, driverData?.lastLocationUpdateAt]);

	if (!driverData) {
		return null;
	}

	// Get initials from first and last name
	const getInitials = (firstName: string, lastName: string) => {
		const first = firstName?.charAt(0)?.toUpperCase() || "";
		const last = lastName?.charAt(0)?.toUpperCase() || "";
		return `${first}${last}` || "?";
	};

	const initials = getInitials(driverData.firstName, driverData.lastName);
	const fullName = `${driverData.firstName} ${driverData.lastName}`.trim();
	const externalId = driverData.externalId?.trim() || null;
	const driverDisplayName = externalId ? `(${externalId}) ${fullName}` : fullName;
	const showTmsLinks = currentUser?.role?.trim().toUpperCase() !== "DRIVER";
	const isClosedLoadStatus = ["delivered", "tonu", "cancelled", "canceled"].includes(
		String(loadStatus ?? "")
			.trim()
			.toLowerCase()
			.replace(/_/g, "-")
	);
	const driverPageUrl =
		showTmsLinks && externalId
			? `${TMS_DRIVER_PAGE_URL}?driver=${encodeURIComponent(externalId)}`
			: null;
	const tmsLoadId = loadId?.trim() || null;
	const tmsLoadPageUrl =
		showTmsLinks && tmsLoadId
			? `${TMS_LOAD_PAGE_URL}?post_id=${encodeURIComponent(tmsLoadId)}`
			: null;
	const loadNumberDisplay = loadNumber?.trim() || tmsLoadId;
	const openChatUrl = tmsLoadId ? `/chat?load=${encodeURIComponent(tmsLoadId)}` : null;

	// Format coordinates
	const coordinates =
		driverData.latitude !== null && driverData.longitude !== null
			? `${driverData.latitude.toFixed(6)}, ${driverData.longitude.toFixed(6)}`
			: "N/A";

	const formatLastUpdate = (dateString: string | null) =>
		formatNyWallClockForDisplay(dateString);

	const driverStatusLabel = getStatusLabelForFilter(driverData.driverStatus);
	const locationLine = formatDriverLocationLine(
		driverData.city,
		driverData.state,
		driverData.zip
	);

	const suppressLoadActions = Boolean(loadId?.trim()) && !showLoadTrackingActions;
	const usesMobileAppForUi = suppressLoadActions ? false : usesMobileApp;
	const showSendPushButton = usesMobileAppForUi && pushModalDriver !== null;
	const showChatAndTmsButtons =
		usesMobileAppForUi && Boolean(openChatUrl || tmsLoadPageUrl);
	const routeMilesDisplay = routeTotalMiles?.trim() || "";
	const hasRoute = Boolean(routeDetails?.trim());

	const staleThresholdLabel = staleLocationBanner?.thresholdLabel?.trim() || "";
	const showStaleLocationBanner = Boolean(staleThresholdLabel);
	const showCopyLocationUpdateButton =
		Boolean(loadId?.trim()) &&
		canSeeLoadStaleLocationSystemMessage(currentUser?.role) &&
		!showStaleLocationBanner;
	const canSetRest =
		Boolean(loadId?.trim()) &&
		canSeeLoadStaleLocationSystemMessage(currentUser?.role);

	const handleCopyTrackingLink = async () => {
		if (!tmsLoadId || isCopyingTrackingLink) return;
		setIsCopyingTrackingLink(true);
		try {
			const link = await fetchCustomerLoadTrackingLink(tmsLoadId);
			const path = link.path.startsWith("/") ? link.path : `/${link.path}`;
			await navigator.clipboard.writeText(`${window.location.origin}${path}`);
			showClipboardToast("Tracking link", "Tracking link copied to clipboard.", "success");
		} catch (error) {
			showClipboardToast(
				"Tracking link",
				error instanceof Error ? error.message : "Failed to copy tracking link.",
				"error"
			);
		} finally {
			setIsCopyingTrackingLink(false);
		}
	};

	const handleCopyLocationUpdate = async () => {
		const locationParts = [driverData.city, driverData.state, driverData.zip]
			.map((value) => value?.trim() ?? "")
			.filter(Boolean);
		const location = formatCurrentLocationForUpdate(
			locationParts.length > 0 ? locationParts.join(", ") : null
		);
		const miles = includeLocationUpdateMiles
			? formatMilesLeftForLocationUpdate(remainingMiles)
			: null;
		const text = buildLoadLocationUpdateMessage(location, miles);

		try {
			await navigator.clipboard.writeText(text);
			setLocationUpdateCopied(true);
			showClipboardToast(
				"Location update",
				"Location update copied to clipboard.",
				"success"
			);
		} catch {
			setLocationUpdateCopied(false);
		}
	};

	const routeStops = (routeDetails ?? "")
		.split(/\n\s*\n/)
		.map(section => {
			const lines = section.split("\n").map(line => line.trim()).filter(Boolean);
			return {
				label: (lines.shift() ?? "").replace(/:$/, ""),
				address: lines.shift() ?? "N/A",
				time: lines.join(" ").replace(/^Date\s*&\s*time:\s*/i, ""),
			};
		})
		.filter(stop => stop.label || stop.address !== "N/A");

	return (
		<div
			className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_40px_rgba(37,50,75,0.14)] ${getDriverInfoCardWidthClass(hasRoute)}`}
		>
			{showStaleLocationBanner ? (
				<div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center [overflow-wrap:anywhere]">
					<p className="text-sm font-semibold text-amber-950">
						{staleLocationBanner?.hidesMap
							? `No driver updates in the last ${staleThresholdLabel}`
							: `No driver location updates in the last ${staleThresholdLabel}`}
					</p>
					<p className="mt-1 break-words text-xs leading-snug text-amber-900/85">
						{staleLocationBanner?.hidesMap ? (
							<>
								The driver&apos;s last location update is older than {staleThresholdLabel}{" "}
								(Eastern Time). Map and load history are hidden until a new update is
								received.
							</>
						) : (
							<>
								The driver has not sent a location update in the last {staleThresholdLabel}{" "}
								(Eastern Time).
							</>
						)}
					</p>
				</div>
			) : null}
			<div className={`grid min-w-0 gap-2 p-4 ${hasRoute ? "min-h-[225px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_267px]" : "grid-cols-1"}`}>
				<div className="flex min-w-0 flex-col">
				<div className="flex min-h-[57px] min-w-0 flex-wrap items-center gap-3 border-b border-[#e9edf5] pb-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1f4ff]">
						{driverData.profilePhoto ? (
							<img
								src={driverData.profilePhoto}
								alt={driverDisplayName}
								className="h-full w-full object-cover"
							/>
						) : (
							<span className="text-sm font-semibold text-[#5367d9]">
								{initials}
							</span>
						)}
					</div>
					<div className="min-w-0">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						{driverPageUrl ? (
							<a
								href={driverPageUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="min-w-0 max-w-full break-words text-sm font-semibold text-slate-800 hover:text-brand-600 hover:underline"
							>
								{driverDisplayName}
							</a>
						) : (
							<p className="min-w-0 max-w-full break-words text-sm font-semibold text-slate-800">
								{driverDisplayName}
							</p>
						)}
					</div>
					<span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online</span>
					</div>
					{canSetRest ? (
						<LoadChatRestStatusIcon
							isRest={Boolean(isRest)}
							restDate={restDate}
							restStartedAt={restStartedAt}
							onClick={() => setIsRestModalOpen(true)}
							className="flex min-w-[44px] flex-col items-center justify-center"
						/>
					) : null}
					<div className="flex items-center gap-2.5">
					{showSendPushButton && (
						<div className="flex justify-center">
							<button
								type="button"
								className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#4967f2] bg-white px-5 text-sm font-medium text-[#4967f2] transition hover:bg-[#f5f7ff]"
								onClick={() => setIsPushModalOpen(true)}
							>
								<Bell className="h-4 w-4" strokeWidth={1.7} /> Send Push
							</button>
						</div>
					)}
					{showChatAndTmsButtons && tmsLoadPageUrl ? (
						<a
							href={tmsLoadPageUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#edf0f5] px-5 text-sm font-medium text-[#63718f] transition hover:bg-[#e5e9f0]"
						>
							<FileText className="h-4 w-4" strokeWidth={1.7} /> Show in TMS
						</a>
					) : null}
					{showTmsLinks && tmsLoadId && !isClosedLoadStatus ? (
						<button
							type="button"
							disabled={isCopyingTrackingLink}
							onClick={() => {
								handleCopyTrackingLink().catch(() => undefined);
							}}
							className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#edf0f5] px-5 text-sm font-medium text-[#63718f] transition hover:bg-[#e5e9f0] disabled:cursor-wait disabled:opacity-70"
						>
							<Link2 className="h-4 w-4" strokeWidth={1.7} /> Copy tracking link
						</button>
					) : null}
					</div>
				</div>

				<div className="mt-2 grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.12fr_1.08fr_1.08fr] lg:grid-rows-2">
						<div className="flex min-w-0 flex-col rounded-xl bg-[#f7f8fc] p-3 lg:row-span-2">
							<div className="flex items-start gap-3"><ContactInfoIcon className="h-8 w-8 shrink-0" /><div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Contact</p><p className="mt-1 break-words text-xs font-semibold text-[#202b45]">{driverData.phone || "N/A"}</p></div></div>
							{showChatAndTmsButtons && openChatUrl ? <Link href={openChatUrl} className="ml-11 mt-auto inline-flex h-9 w-fit items-center gap-2 rounded-full bg-[#4967f2] px-4 text-xs font-medium text-white hover:bg-[#4058dc]"><MessageSquare className="h-4 w-4" strokeWidth={1.8} /> Open chat</Link> : null}
						</div>
						<div className="flex min-w-0 flex-col rounded-xl bg-[#f7f8fc] p-3 lg:row-span-2">
							<div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f6ef7]"><LocationInfoIcon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Location</p><p className="mt-1 select-all break-words text-xs font-semibold text-[#202b45]">{locationLine}</p><p className="mt-1 select-all break-words text-[10px] text-[#8f99af]">{coordinates}</p></div></div>
							{showCopyLocationUpdateButton ? <button type="button" onClick={() => { handleCopyLocationUpdate().catch(() => undefined); }} className={`ml-11 mt-auto inline-flex w-fit items-center gap-2 text-xs font-medium ${locationUpdateCopied ? "text-emerald-600" : "text-[#4967f2] hover:text-[#4058dc]"}`} aria-label="Copy Location Update" title="Copy Location Update"><CopyInfoIcon className="h-4 w-4" /> Copy Location Update</button> : null}
						</div>
						<div className="flex items-start gap-3 rounded-xl bg-[#f7f8fc] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f6ef7]"><MilesInfoIcon className="h-5 w-5" /></span><div>
							<p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Total miles</p><p className="mt-1 text-xs font-semibold text-[#202b45]">{routeMilesDisplay || "N/A"}</p></div>
						</div>
						<div className="flex items-start gap-3 rounded-xl bg-[#f7f8fc] p-3"><DriverStatusInfoIcon className="h-8 w-8 shrink-0" /><div>
							<p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Driver status</p><p className="mt-1 text-xs font-semibold text-[#202b45]">{driverStatusLabel}</p></div>
						</div>
						<div className="flex items-start gap-3 rounded-xl bg-[#f7f8fc] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f6ef7]"><RefreshInfoIcon className="h-5 w-5" /></span><div>
							<p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Last driver update</p><p className="mt-1 text-xs font-semibold text-[#202b45]">{formatLastUpdate(driverData.lastLocationUpdateAt)}</p></div>
						</div>
						<div className="flex items-start gap-3 rounded-xl bg-[#f7f8fc] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f6ef7]"><LoadStatusInfoIcon className="h-5 w-5" /></span><div>
							<p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Load status</p><p className="mt-1 text-xs font-semibold text-[#202b45]">{loadStatusLabel ?? "N/A"}</p></div>
						</div>
					</div>
				</div>
					{hasRoute ? (
						/* Out of flow on wide screens so a long route matches the info column and scrolls. */
						<div className="relative min-h-[193px] xl:min-h-0">
							<div className="flex max-h-[min(22rem,46vh)] min-h-[193px] flex-col overflow-hidden rounded-2xl bg-[#f7f8fc] p-4 xl:absolute xl:inset-0 xl:max-h-none xl:min-h-0">
								<div className="flex shrink-0 items-center gap-3">
									<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f6ef7]">
										<RouteInfoIcon className="h-5 w-5" />
									</span>
									<p className="text-[10px] uppercase tracking-wide text-[#7f8aa5]">Route</p>
								</div>
								<div
									className={`mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain custom-scrollbar ${
										routeStops.length > 2 ? "" : "justify-between"
									}`}
								>
									{routeStops.map((stop, index) => (
										<div key={`${stop.label}-${index}`} className="relative flex shrink-0 gap-2.5">
											<div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"}`}>
												<StopPinIcon className="h-4 w-4" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-[9px] uppercase text-[#7f8aa5]">{stop.label}</p>
												<p className="truncate text-xs font-semibold text-[#202b45]">{stop.address}</p>
												{stop.time ? <p className="truncate text-[9px] text-[#8f99af]">{stop.time}</p> : null}
												{index === 0 && routeStops.length > 1 ? <div className="mt-3 h-px bg-[#dfe4ee]" /> : null}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					) : null}
			</div>
			<CheckListPushModal
				isOpen={isPushModalOpen}
				onClose={() => setIsPushModalOpen(false)}
				drivers={isPushModalOpen && pushModalDriver ? [pushModalDriver] : null}
			/>
			<SetLoadRestModal
				isOpen={isRestModalOpen}
				onClose={() => setIsRestModalOpen(false)}
				loadId={loadId}
				isRest={Boolean(isRest)}
				restDate={restDate}
				onSaved={update => {
					onRestChanged?.(update);
				}}
			/>
		</div>
	);
}
