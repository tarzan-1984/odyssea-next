"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStatusLabelForFilter } from "@/components/logistics/driversMapConstants";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";
import { formatDriverLocationLine } from "@/utils/formatDriverLocation";
import DriverMobileAppIcon from "@/components/tables/DataTables/DriversTable/DriverMobileAppIcon";
import { useResolvedDriverLastActiveApp } from "@/hooks/useResolvedDriverLastActiveApp";
import { formatNyWallClockForDisplay } from "@/utils/nyWallClock";
import { useCurrentUser } from "@/stores/userStore";
import { canSeeLoadStaleLocationSystemMessage } from "@/utils/systemMessageKind";
import {
	buildLoadLocationUpdateMessage,
	formatCurrentLocationForUpdate,
	formatMilesLeftForLocationUpdate,
} from "@/utils/loadLocationUpdateMessage";

const tmsCardButtonClass =
	"inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

export function getDriverInfoCardWidthClass(hasRoute: boolean): string {
	return hasRoute ? "w-fit max-w-full" : "w-[min(calc(100vw-3rem),56rem)]";
}

function showLocationUpdateCopiedToast(): void {
	const addSystemToast = (
		window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void }
	).addSystemToastNotification;
	if (typeof addSystemToast !== "function") return;

	addSystemToast({
		id: `location-update-${Date.now()}`,
		title: "Location update",
		message: "Location update copied to clipboard.",
		variant: "success",
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
	/** Multiline route details (pick up / delivery, address, time). */
	routeDetails?: string | null;
	/** Total loaded miles for the load route (TMS meta_data.all_miles). */
	routeTotalMiles?: string | null;
	/** Remaining road miles to next stop (same snapshot as LOAD chat). */
	remainingMiles?: number | null;
	/** Load tracking page: hide chat/TMS/push only when driver has no mobile app. */
	showLoadTrackingActions?: boolean;
	/** Full-width stale location warning at the top of the card. */
	staleLocationBanner?: StaleLocationBanner | null;
}

const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";
const TMS_LOAD_PAGE_URL = "https://www.endurance-tms.com/add-load/";

export default function DriverInfo({
	driverData,
	loadId,
	loadNumber,
	loadStatusLabel,
	routeDetails,
	routeTotalMiles,
	remainingMiles = null,
	showLoadTrackingActions = true,
	staleLocationBanner = null,
}: DriverInfoProps) {
	const [isPushModalOpen, setIsPushModalOpen] = useState(false);
	const [locationUpdateCopied, setLocationUpdateCopied] = useState(false);
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
	const driverPageUrl = externalId
		? `${TMS_DRIVER_PAGE_URL}?driver=${encodeURIComponent(externalId)}`
		: null;
	const tmsLoadId = loadId?.trim() || null;
	const tmsLoadPageUrl = tmsLoadId
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

	const handleCopyLocationUpdate = async () => {
		const locationParts = [driverData.city, driverData.state, driverData.zip]
			.map((value) => value?.trim() ?? "")
			.filter(Boolean);
		const location = formatCurrentLocationForUpdate(
			locationParts.length > 0 ? locationParts.join(", ") : null
		);
		const miles = formatMilesLeftForLocationUpdate(remainingMiles);
		const text = buildLoadLocationUpdateMessage(location, miles);

		try {
			await navigator.clipboard.writeText(text);
			setLocationUpdateCopied(true);
			showLocationUpdateCopiedToast();
		} catch {
			setLocationUpdateCopied(false);
		}
	};

	return (
		<div
			className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 ${getDriverInfoCardWidthClass(
				hasRoute
			)}`}
		>
			{showStaleLocationBanner ? (
				<div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center dark:border-amber-900/60 dark:bg-amber-950/50 [overflow-wrap:anywhere]">
					<p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
						{staleLocationBanner?.hidesMap
							? `No driver updates in the last ${staleThresholdLabel}`
							: `No driver location updates in the last ${staleThresholdLabel}`}
					</p>
					<p className="mt-1 break-words text-xs leading-snug text-amber-900/85 dark:text-amber-200/90">
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
			<div
				className={`flex min-w-0 items-start ${hasRoute ? "gap-4 px-4 py-3.5" : "gap-10 px-8 py-5"}`}
			>
				{/* Avatar + Name */}
				<div
					className={`flex shrink-0 flex-col items-center ${
						hasRoute ? "w-[12.5rem] max-w-[12.5rem]" : "w-[14rem] max-w-[14rem] sm:w-[16rem] sm:max-w-[16rem]"
					}`}
				>
					<div className="mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-gray-700">
						{driverData.profilePhoto ? (
							<img
								src={driverData.profilePhoto}
								alt={driverDisplayName}
								className="h-full w-full object-cover"
							/>
						) : (
							<span className="text-xl font-semibold text-slate-600 dark:text-gray-300">
								{initials}
							</span>
						)}
					</div>
					<div className="flex w-full flex-wrap items-center justify-center gap-1.5 text-center">
						{driverPageUrl ? (
							<a
								href={driverPageUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="min-w-0 max-w-full break-words text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
							>
								{driverDisplayName}
							</a>
						) : (
							<p className="min-w-0 max-w-full break-words text-sm font-medium text-slate-900 dark:text-white">
								{driverDisplayName}
							</p>
						)}
						<DriverMobileAppIcon usesApp={usesMobileAppForUi} />
					</div>
					{showSendPushButton && (
						<div className="mt-2 flex w-full justify-center">
							<button
								type="button"
								className={`${tmsCardButtonClass} border border-brand-500 bg-brand-500 text-white hover:bg-brand-600 dark:border-brand-400 dark:bg-brand-400 dark:hover:bg-brand-500`}
								onClick={() => setIsPushModalOpen(true)}
							>
								Send Push
							</button>
						</div>
					)}
				</div>

				{/* Details */}
				<div
					className={
						hasRoute
							? "flex min-w-0 shrink-0 items-start gap-3"
							: "grid min-w-0 flex-1 grid-cols-3 gap-x-8"
					}
				>
					<div
						className={`flex flex-col gap-3 ${hasRoute ? "w-[8rem] shrink-0" : "min-w-0"}`}
					>
						<div className="min-w-0">
							<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">Phone</p>
							<p className="break-words text-sm font-medium text-slate-900 dark:text-white">
								{driverData.phone || "N/A"}
							</p>
						</div>
						<div className="min-w-0">
							<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">Coordinates</p>
							<p className="break-words text-sm font-medium text-slate-900 dark:text-white">
								{coordinates}
							</p>
						</div>
						{tmsLoadId && tmsLoadPageUrl && loadNumberDisplay && (
							<div className="min-w-0">
								<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">
									Load number
								</p>
								<p className="break-words text-sm font-medium text-slate-900 dark:text-white">
									<a
										href={tmsLoadPageUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-brand-500 hover:text-brand-600 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
									>
										{loadNumberDisplay}
									</a>
								</p>
							</div>
						)}
					</div>

					<div
						className={`flex flex-col gap-3 ${hasRoute ? "w-[8.5rem] shrink-0" : "min-w-0"}`}
					>
						<div className="min-w-0">
							<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">Location</p>
							<p className="select-all break-words text-sm font-medium text-slate-900 dark:text-white">
								{locationLine}
							</p>
						</div>
						<div className="min-w-0">
							<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">
								Driver Status
							</p>
							<p className="text-sm font-medium text-slate-900 dark:text-white">
								{driverStatusLabel}
							</p>
						</div>
						{loadId && (
							<div className="min-w-0">
								<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">
									Load Status
								</p>
								<p className="text-sm font-medium text-slate-900 dark:text-white">
									{loadStatusLabel ?? "N/A"}
								</p>
							</div>
						)}
						{showCopyLocationUpdateButton ? (
							<button
								type="button"
								onClick={() => {
									handleCopyLocationUpdate().catch(() => undefined);
								}}
								className={`inline-flex w-fit max-w-full shrink-0 items-center justify-center self-start whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
									locationUpdateCopied
										? "border-success-500 bg-success-500 text-white hover:bg-success-600 dark:border-success-500 dark:bg-success-500 dark:hover:bg-success-600"
										: "border-brand-500 bg-brand-500 text-white hover:bg-brand-600 dark:border-brand-400 dark:bg-brand-400 dark:hover:bg-brand-500"
								}`}
								aria-label="Copy Location Update"
								title="Copy Location Update"
							>
								Copy Location Update
							</button>
						) : null}
					</div>

					<div
						className={`flex flex-col gap-3 ${hasRoute ? "w-[9.5rem] shrink-0" : "min-w-0"}`}
					>
						<div className="min-w-0">
							<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">
								Last Driver Update
							</p>
							<p className="text-sm font-medium text-slate-900 dark:text-white">
								{formatLastUpdate(driverData.lastLocationUpdateAt)}
							</p>
						</div>
						{routeMilesDisplay ? (
							<div className="min-w-0">
								<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">
									Total miles
								</p>
								<p className="text-sm font-medium text-slate-900 dark:text-white">
									{routeMilesDisplay}
								</p>
							</div>
						) : null}
						{showChatAndTmsButtons && (
							<div className="flex min-w-0 flex-col gap-2">
								{openChatUrl && (
									<Link
										href={openChatUrl}
										className={`${tmsCardButtonClass} border border-brand-500 bg-brand-500 text-white hover:bg-brand-600 dark:border-brand-400 dark:bg-brand-400 dark:hover:bg-brand-500`}
									>
										Open chat
									</Link>
								)}
								{tmsLoadPageUrl && (
									<a
										href={tmsLoadPageUrl}
										target="_blank"
										rel="noopener noreferrer"
										className={`${tmsCardButtonClass} border border-brand-500 text-brand-500 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-500/10`}
									>
										Show in TMS
									</a>
								)}
							</div>
						)}
					</div>

					{hasRoute && (
						<div className="flex max-w-[20rem] shrink-0 flex-col gap-3">
							<div className="min-w-0">
								<p className="mb-1 text-xs text-slate-500 dark:text-gray-400">Route</p>
								<div className="max-h-[150px] overflow-y-auto">
									<p className="min-w-0 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
										{routeDetails}
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			<CheckListPushModal
				isOpen={isPushModalOpen}
				onClose={() => setIsPushModalOpen(false)}
				drivers={isPushModalOpen && pushModalDriver ? [pushModalDriver] : null}
			/>
		</div>
	);
}
