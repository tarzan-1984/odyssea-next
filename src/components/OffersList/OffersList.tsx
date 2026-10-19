"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocketConnectionCheck } from "@/hooks/useWebSocketConnectionCheck";
import Image from "next/image";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import { useCurrentUser } from "@/stores/userStore";
import { ChevronDownIcon, ChevronUpIcon, ExtendBidTimeIcon, OfferDriverChatIcon, DeactivateOfferIcon, EditOfferIcon, AddPlusCircleIcon, CheckCircleIcon, OfferAcceptIcon, OfferDeleteIcon, OfferCounterOfferIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import offersApi, { formatRoute, routeSummary } from "@/app-api/offers";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import type { OfferRow, OfferDriver } from "@/app-api/offers";
import AddDriversModal from "@/components/tables/DataTables/DriversTable/AddDriversModal";
import CreateOfferModal, {
	type EditOfferData,
} from "@/components/tables/DataTables/DriversTable/CreateOfferModal";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import UserFilterSelect from "./UserFilterSelect";
import { buildOfferChatUrl } from "@/utils/offerChatUrl";
import {
	OfferCardUnreadBadge,
	OfferChatUnreadBadge,
} from "@/components/OffersList/OfferChatUnreadBadge";
import { buildTmsDriverPageUrl } from "@/utils/tmsUrls";
import { canModifyOffers, canViewAllOffers } from "@/utils/roleAccess";
import { formatOfferCreateTimeEst } from "@/utils/nyWallClock";
import SpecialRequirementsList from "@/components/offers/SpecialRequirementsList";
import DriverRatingBadge from "@/components/tables/DataTables/DriversTable/DriverRatingBadge";
import DriverRatingModal from "@/components/tables/DataTables/DriversTable/DriverRatingModal";
import CounterOfferModal, {
	type CounterOfferModalState,
} from "./CounterOfferModal";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";
import { getRoleDisplayLabel } from "@/helpers";

const DRIVER_ACCEPTED_MESSAGE =
	"The load has been added to the TMS Drafts section. You may now finalize and publish it to create an Active Load chat with the driver and our support team.";

function formatOfferCreatorLabel(creator: OfferRow["creator"]): string | null {
	if (!creator) return null;

	const name = [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
	const role = creator.role?.trim();

	if (!name && !role) return null;

	const parts = [name || ""];
	if (role) {
		const roleLabel = getRoleDisplayLabel(role);
		parts.push(`(${roleLabel})`);
	}

	return parts.join(" ");
}

function parseSpecialRequirementsArray(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value.map(v => String(v).trim()).filter(Boolean);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return [];
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.map(v => String(v).trim()).filter(Boolean);
			}
		} catch {
			// fall through to comma-separated
		}
		return trimmed
			.split(",")
			.map(v => v.trim())
			.filter(Boolean);
	}
	return [];
}

function buildEditOfferData(offer: OfferRow): EditOfferData {
	const route =
		offer.route && offer.route.length > 0
			? offer.route.map(point => ({
					type: point.type,
					location: point.location ?? "",
					time: point.time ?? "",
					latitude: point.latitude,
					longitude: point.longitude,
				}))
			: [
					...(offer.pick_up_location
						? [
								{
									type: "pick_up_location" as const,
									location: offer.pick_up_location,
									time: offer.pick_up_time ?? "",
								},
							]
						: []),
					...(offer.delivery_location
						? [
								{
									type: "delivery_location" as const,
									location: offer.delivery_location,
									time: offer.delivery_time ?? "",
								},
							]
						: []),
				];

	const selectedDriverIds = Array.from(
		new Set(
			(offer.drivers ?? []).flatMap(d => {
				const id = d.externalId ?? d.driver_id;
				return id ? [String(id)] : [];
			})
		)
	);

	const driverEmptyMiles: Record<string, number> = {};
	for (const driver of offer.drivers ?? []) {
		const id = driver.externalId ?? driver.driver_id;
		if (id && driver.empty_miles != null && Number.isFinite(Number(driver.empty_miles))) {
			const rounded = Math.round(Number(driver.empty_miles));
			driverEmptyMiles[String(id)] = rounded;
		}
	}

	return {
		offerId: offer.id,
		externalId: offer.external_user_id ?? offer.creator?.externalId ?? "",
		selectedDriverIds,
		driverEmptyMiles,
		offeredRate: offer.offered_rate != null ? String(offer.offered_rate) : "",
		weight: offer.weight != null ? String(offer.weight) : "",
		commodity: offer.commodity ?? "",
		specialRequirements: parseSpecialRequirementsArray(offer.special_requirements),
		notes: offer.notes ?? "",
		route,
		loadedMiles: offer.loaded_miles,
	};
}

function hasHazmat(specialRequirements: unknown): boolean {
	if (!specialRequirements) return false;
	if (Array.isArray(specialRequirements)) {
		return specialRequirements.some((v) => String(v).toLowerCase() === "hazmat");
	}
	return String(specialRequirements).toLowerCase().includes("hazmat");
}

function normalizeUnixSeconds(value: unknown): number | null {
	if (value == null || value === "") return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	return Math.floor(parsed);
}

function formatCountdown(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map((value) => String(value).padStart(2, "0"))
		.join(":");
}

const secondClockSubscribers = new Set<(nowUnixSeconds: number) => void>();
let secondClockIntervalId: number | null = null;

function subscribeToSecondClock(callback: (nowUnixSeconds: number) => void): () => void {
	secondClockSubscribers.add(callback);
	if (secondClockIntervalId == null) {
		secondClockIntervalId = window.setInterval(() => {
			const nowUnixSeconds = Math.floor(Date.now() / 1000);
			for (const subscriber of secondClockSubscribers) subscriber(nowUnixSeconds);
		}, 1000);
	}

	return () => {
		secondClockSubscribers.delete(callback);
		if (secondClockSubscribers.size === 0 && secondClockIntervalId != null) {
			window.clearInterval(secondClockIntervalId);
			secondClockIntervalId = null;
		}
	};
}

/** Subscribe only the small timer component, never the full offers list. */
function useCountdownSeconds(actionTimeUnix: number | null, enabled = true): number | null {
	const [nowUnixSeconds, setNowUnixSeconds] = useState(() =>
		Math.floor(Date.now() / 1000)
	);
	const shouldTick = enabled && actionTimeUnix != null && actionTimeUnix > nowUnixSeconds;

	useEffect(() => {
		setNowUnixSeconds(Math.floor(Date.now() / 1000));
	}, [actionTimeUnix]);

	useEffect(() => {
		if (!shouldTick) return;
		return subscribeToSecondClock(setNowUnixSeconds);
	}, [shouldTick]);

	return actionTimeUnix == null
		? null
		: Math.max(0, actionTimeUnix - nowUnixSeconds);
}

const MAX_OFFER_REMINDERS_PER_DRIVER = 3;
const OFFER_REMINDER_COOLDOWN_SECONDS = 5 * 60;

function formatReminderCountdown(totalSeconds: number): string {
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getDriverReminderEligibleAtUnix(driver: OfferDriver): number | null {
	const lastReminderAt = normalizeUnixSeconds(driver.last_reminder_at);
	if (lastReminderAt == null) return null;
	return lastReminderAt + OFFER_REMINDER_COOLDOWN_SECONDS;
}

function canDriverReceiveReminder(driver: OfferDriver, nowUnixSeconds: number): boolean {
	if (driver.active === false) return false;
	const driverKey = driver.externalId ?? driver.driver_id;
	if (!driverKey) return false;
	const reminderCount = driver.reminder_count ?? 0;
	if (reminderCount >= MAX_OFFER_REMINDERS_PER_DRIVER) return false;
	const eligibleAtUnix = getDriverReminderEligibleAtUnix(driver);
	if (eligibleAtUnix != null && eligibleAtUnix > nowUnixSeconds) return false;
	return true;
}

const SendReminderButton = memo(function SendReminderButton({
	offerId,
	driver,
	actionKey,
	canModifyOffersByRole,
	sendingReminderKey,
	onSend,
}: {
	offerId: number;
	driver: OfferDriver;
	actionKey: string | null;
	canModifyOffersByRole: boolean;
	sendingReminderKey: string | null;
	onSend: (offerId: number, driverExternalId: string, actionKey: string) => void;
}) {
	const reminderCount = driver.reminder_count ?? 0;
	const eligibleAtUnix = getDriverReminderEligibleAtUnix(driver);
	const limitReached = reminderCount >= MAX_OFFER_REMINDERS_PER_DRIVER;
	const secondsLeft = useCountdownSeconds(
		eligibleAtUnix,
		!limitReached && eligibleAtUnix != null
	);
	const onCooldown = secondsLeft != null && secondsLeft > 0;
	const isSending = actionKey != null && sendingReminderKey === actionKey;
	const driverKey = driver.externalId ?? driver.driver_id;
	const disabled =
		!canModifyOffersByRole ||
		!actionKey ||
		!driverKey ||
		limitReached ||
		onCooldown ||
		isSending;

	let title = `Send reminder (${reminderCount}/${MAX_OFFER_REMINDERS_PER_DRIVER})`;
	if (limitReached) {
		title = `Reminder limit reached (${MAX_OFFER_REMINDERS_PER_DRIVER}/${MAX_OFFER_REMINDERS_PER_DRIVER})`;
	} else if (onCooldown && secondsLeft != null) {
		title = `Available in ${formatReminderCountdown(secondsLeft)} (${reminderCount}/${MAX_OFFER_REMINDERS_PER_DRIVER})`;
	}

	const label = limitReached
		? `Send reminder (${MAX_OFFER_REMINDERS_PER_DRIVER}/${MAX_OFFER_REMINDERS_PER_DRIVER})`
		: onCooldown && secondsLeft != null
			? `Reminder ${formatReminderCountdown(secondsLeft)} (${reminderCount}/${MAX_OFFER_REMINDERS_PER_DRIVER})`
			: `Send reminder (${reminderCount}/${MAX_OFFER_REMINDERS_PER_DRIVER})`;

	return (
		<button
			type="button"
			title={title}
			disabled={disabled}
			onClick={() => {
				if (disabled || !driverKey || !actionKey) return;
				onSend(offerId, String(driverKey), actionKey);
			}}
			className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
		>
			{label}
		</button>
	);
});

const BulkSendReminderButton = memo(function BulkSendReminderButton({
	offerId,
	drivers,
	canModifyOffersByRole,
	sendingReminderKey,
	onSend,
}: {
	offerId: number;
	drivers: OfferDriver[];
	canModifyOffersByRole: boolean;
	sendingReminderKey: string | null;
	onSend: (offerId: number, drivers: OfferDriver[]) => void;
}) {
	const bulkActionKey = `${offerId}-bulk`;
	const isSending = sendingReminderKey === bulkActionKey;
	const nowUnixSeconds = Math.floor(Date.now() / 1000);

	const activeDrivers = drivers.filter((driver) => {
		const driverKey = driver.externalId ?? driver.driver_id;
		return driver.active !== false && Boolean(driverKey);
	});
	const limitReachedDrivers = activeDrivers.filter(
		(driver) => (driver.reminder_count ?? 0) >= MAX_OFFER_REMINDERS_PER_DRIVER
	);
	const waitingDrivers = activeDrivers.filter((driver) => {
		if ((driver.reminder_count ?? 0) >= MAX_OFFER_REMINDERS_PER_DRIVER) return false;
		const eligibleAtUnix = getDriverReminderEligibleAtUnix(driver);
		return eligibleAtUnix != null && eligibleAtUnix > nowUnixSeconds;
	});
	const nextEligibleAtUnix =
		waitingDrivers.length > 0
			? Math.min(
					...waitingDrivers.map(
						(driver) => getDriverReminderEligibleAtUnix(driver) as number
					)
				)
			: null;
	const secondsLeft = useCountdownSeconds(
		nextEligibleAtUnix,
		nextEligibleAtUnix != null &&
			activeDrivers.length > limitReachedDrivers.length
	);
	const onCooldown =
		activeDrivers.length > 0 &&
		activeDrivers.length === limitReachedDrivers.length + waitingDrivers.length &&
		secondsLeft != null &&
		secondsLeft > 0;
	const eligibleDrivers = activeDrivers.filter((driver) =>
		canDriverReceiveReminder(driver, nowUnixSeconds)
	);
	const allLimitReached =
		activeDrivers.length > 0 && limitReachedDrivers.length === activeDrivers.length;
	const disabled =
		!canModifyOffersByRole ||
		eligibleDrivers.length === 0 ||
		isSending;

	let title = `Send reminder to ${eligibleDrivers.length} selected driver(s)`;
	if (activeDrivers.length === 0) {
		title = "No active selected drivers";
	} else if (allLimitReached) {
		title = `Reminder limit reached (${MAX_OFFER_REMINDERS_PER_DRIVER}/${MAX_OFFER_REMINDERS_PER_DRIVER})`;
	} else if (onCooldown && secondsLeft != null) {
		title = `Available in ${formatReminderCountdown(secondsLeft)}`;
	}

	const label = allLimitReached
		? `Send reminder (${MAX_OFFER_REMINDERS_PER_DRIVER}/${MAX_OFFER_REMINDERS_PER_DRIVER})`
		: onCooldown && secondsLeft != null
			? `Reminder ${formatReminderCountdown(secondsLeft)}`
			: "Send reminder";

	return (
		<button
			type="button"
			title={title}
			disabled={disabled}
			onClick={() => {
				if (disabled) return;
				onSend(offerId, eligibleDrivers);
			}}
			className="inline-flex h-[39px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-4 py-0 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
		>
			{label}
		</button>
	);
});

function formatDriverBidRate(rate: number | null | undefined): string | null {
	if (rate == null) return null;
	return `$${Number(rate).toLocaleString("en-US")}`;
}

function formatExtensionBidRate(rate: {
	rate: number;
	creator_initials: string;
}): string | null {
	const amount = formatDriverBidRate(rate.rate);
	if (!amount) return null;
	const initials = rate.creator_initials?.trim();
	return initials ? `${amount} (${initials})` : amount;
}

function canExtendDriverBidTime(offer: OfferRow, driver: OfferDriver): boolean {
	return (
		offer.active !== false &&
		!offer.is_driver_selected &&
		driver.active !== false &&
		driver.rate != null
	);
}

function getDriverBidSortPriority(driver: OfferDriver, nowUnixSeconds: number): number {
	if (driver.active === false) return 3;

	const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
	const hasActiveTimer =
		driver.rate != null &&
		actionTimeUnix != null &&
		actionTimeUnix > nowUnixSeconds;

	if (hasActiveTimer) return 0;

	const hasExpiredTimer = actionTimeUnix != null && actionTimeUnix <= nowUnixSeconds;
	if (hasExpiredTimer) return 1;

	return 2;
}

function getDriverEmptyMilesSortValue(driver: OfferDriver): number {
	if (driver.empty_miles == null) return Number.POSITIVE_INFINITY;
	const miles = Number(driver.empty_miles);
	return Number.isFinite(miles) ? miles : Number.POSITIVE_INFINITY;
}

function sortOfferDriversByBidStatus(
	drivers: OfferDriver[],
	nowUnixSeconds: number
): OfferDriver[] {
	return [...drivers].sort((a, b) => {
		const priorityA = getDriverBidSortPriority(a, nowUnixSeconds);
		const priorityB = getDriverBidSortPriority(b, nowUnixSeconds);
		if (priorityA !== priorityB) return priorityA - priorityB;

		// Secondary: Empty miles ascending within Bid / neutral / Skip groups
		return getDriverEmptyMilesSortValue(a) - getDriverEmptyMilesSortValue(b);
	});
}

function getParticipatingOfferDrivers(drivers: OfferDriver[] | undefined): OfferDriver[] {
	return (
		drivers?.filter(
			(d) =>
				d.active !== false &&
				(d.rate != null || normalizeUnixSeconds(d.action_time) != null)
		) ?? []
	);
}

const OfferDriverBadge = memo(function OfferDriverBadge({
	offer,
	driver,
	driverIdx,
	canModifyOffersByRole,
	onPushClick,
}: {
	offer: OfferRow;
	driver: OfferDriver;
	driverIdx: number;
	canModifyOffersByRole: boolean;
	onPushClick: (offer: OfferRow, driver: OfferDriver) => void;
}) {
	const driverName = [
		driver.externalId != null ? `(${driver.externalId})` : null,
		[driver.firstName, driver.lastName].filter(Boolean).join(" ") || "",
	]
		.filter(Boolean)
		.join(" ");
	const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
	const isInactiveDriver = driver.active === false;
	const remainingSeconds = useCountdownSeconds(actionTimeUnix, !isInactiveDriver);
	const hasActiveTimer =
		!isInactiveDriver && remainingSeconds != null && remainingSeconds > 0;
	const isExpiredBid =
		!isInactiveDriver &&
		actionTimeUnix != null &&
		(remainingSeconds == null || remainingSeconds <= 0);

	return (
		<div
			className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
				isInactiveDriver
					? "border-transparent bg-[#f5b8ab] dark:border-red-800/35 dark:bg-red-950/50"
					: hasActiveTimer
						? "border-transparent bg-[#d4e8d7] dark:border-green-800/35 dark:bg-green-950/45"
						: isExpiredBid
							? "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700/70"
							: "border-gray-200 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.04]"
			}`}
		>
			{driver.rate != null ? (
				<span className="flex shrink-0 flex-col items-start leading-tight">
					<span
						className={`text-[10px] font-medium tabular-nums ${
							isInactiveDriver
								? "text-[#a20000] dark:text-red-200"
								: hasActiveTimer
									? "text-green-800 dark:text-green-200"
									: isExpiredBid
										? "text-gray-500 dark:text-gray-400"
										: "text-gray-500 dark:text-gray-400"
						}`}
					>
						{formatDriverBidRate(driver.rate)}
					</span>
					{driver.counter_offer != null ? (
						<span className="text-[10px] font-medium tabular-nums text-yellow-500 dark:text-yellow-400">
							{formatDriverBidRate(driver.counter_offer)}
						</span>
					) : null}
				</span>
			) : null}
			<span
				className={`max-w-[180px] truncate text-xs font-medium ${
					isInactiveDriver
						? "font-semibold text-[#a20000] dark:text-red-100"
						: hasActiveTimer
							? "font-semibold text-green-900 dark:text-green-100"
							: isExpiredBid
								? "text-gray-600 dark:text-gray-300"
								: "text-gray-700 dark:text-gray-300"
				}`}
			>
				{driverName}
			</span>
			<OfferChatUnreadBadge
				offerId={offer.id}
				unitId={driver.externalId ?? driver.driver_id}
			/>
			{isInactiveDriver ? null : remainingSeconds != null && remainingSeconds > 0 ? (
				<span className="inline-flex min-w-[64px] items-center justify-center rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
					{formatCountdown(remainingSeconds)}
				</span>
			) : actionTimeUnix != null ? (
				<ExtendBidTimeButton
					offer={offer}
					driver={driver}
					disabled={!canModifyOffersByRole}
					onPushClick={onPushClick}
				/>
			) : null}
		</div>
	);
});

function DriverBidTimer({
	offer,
	driver,
	canModifyOffersByRole,
	onPushClick,
}: {
	offer: OfferRow;
	driver: OfferDriver;
	canModifyOffersByRole: boolean;
	onPushClick: (offer: OfferRow, driver: OfferDriver) => void;
}) {
	const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
	const remainingSeconds = useCountdownSeconds(actionTimeUnix, driver.active !== false);
	if (actionTimeUnix == null || remainingSeconds == null) return null;

	if (remainingSeconds > 0) {
		return (
			<span className="inline-flex min-w-[78px] items-center justify-center rounded-full bg-brand-600 px-2 py-1 text-xs font-semibold text-white">
				{formatCountdown(remainingSeconds)}
			</span>
		);
	}

	return (
		<span className="inline-flex items-center justify-center gap-1">
			<span className="text-theme-sm text-gray-800 dark:text-gray-200">
				Offer Expired
			</span>
			<ExtendBidTimeButton
				offer={offer}
				driver={driver}
				disabled={!canModifyOffersByRole}
				onPushClick={onPushClick}
			/>
		</span>
	);
}

function buildExtendBidTimePushMessage(offer: OfferRow): string {
	const offerName = getOfferTitle(offer);
	return `Please extend the bid time for the offer - ${offerName}`;
}

function getOfferTitle(offer: OfferRow): string {
	const fromRoute = routeSummary(offer.route);
	if (fromRoute) return fromRoute;

	const pickUp = abbreviateStateInLocationString(offer.pick_up_location ?? "").trim();
	const delivery = abbreviateStateInLocationString(offer.delivery_location ?? "").trim();
	if (pickUp && delivery) return `${pickUp} → ${delivery}`;

	return pickUp || delivery || "";
}

function getVisibleOfferTitle(offer: OfferRow, includeId: boolean): string {
	const title =
		routeSummary(offer.route) ||
		`${abbreviateStateInLocationString(offer.pick_up_location ?? "")} - ${abbreviateStateInLocationString(offer.delivery_location ?? "")}`;
	return includeId ? `${title} (id: ${offer.id})` : title;
}

function showOfferTitleCopiedToast(): void {
	const addSystemToast = (
		window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void }
	).addSystemToastNotification;
	if (typeof addSystemToast !== "function") return;

	addSystemToast({
		id: `offer-title-copy-${Date.now()}`,
		title: "Offers",
		message: "Offer title copied to clipboard.",
		variant: "success",
	});
}

const OFFER_UNAVAILABLE_PUSH_BODY =
	"Unfortunately, this offer is no longer available. However, we are continuing to search for new load opportunities for you.\n\nWe apologize for the inconvenience and appreciate your understanding.";

function buildOfferUnavailablePushMessage(_offer: OfferRow): string {
	return OFFER_UNAVAILABLE_PUSH_BODY;
}

const DRIVER_TABLE_COL_SELECT = "40px";
const DRIVER_TABLE_COL_UNIT = "240px";
const DRIVER_TABLE_COL_EMPTY_MILES = "88px";
const DRIVER_TABLE_COL_TOTAL_MILES = "96px";
const DRIVER_TABLE_COL_DRIVER_ETA = "104px";
const DRIVER_TABLE_COL_BID_TIMER = "126px";
/** Narrow so multiple action buttons wrap instead of forcing horizontal scroll. */
const DRIVER_TABLE_COL_ACTIONS = "9.5rem";

const OFFER_DRIVER_CHECKBOX_CLASS =
	"h-4 w-4 shrink-0 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900";

function getOfferDriverSelectionKey(
	offerId: number,
	driver: Pick<OfferDriver, "externalId" | "driver_id">
): string | null {
	const driverKey = driver.externalId ?? driver.driver_id;
	if (!driverKey) return null;
	return `${offerId}:${driverKey}`;
}

function getOfferDriverSelectionKeys(
	offerId: number,
	drivers: OfferDriver[] | undefined
): string[] {
	const keys: string[] = [];
	for (const driver of drivers ?? []) {
		const key = getOfferDriverSelectionKey(offerId, driver);
		if (key) keys.push(key);
	}
	return keys;
}

function fixedDriverTableCol(width: string) {
	return { width, minWidth: width, maxWidth: width };
}

/** Actions: fixed min width; no maxWidth so cell can grow slightly if needed. */
function actionsDriverTableCol() {
	return { width: DRIVER_TABLE_COL_ACTIONS, minWidth: DRIVER_TABLE_COL_ACTIONS };
}

/** Same marks as chat receipts: one gray check = not read, two blue checks = read. */
function OfferDriverReadMarks({ read }: { read: boolean }) {
	if (read) {
		return (
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="text-blue-500"
				aria-hidden
			>
				<path
					d="M1.5 12.5L5.57574 16.5757C5.81005 16.8101 6.18995 16.8101 6.42426 16.5757L9 14"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<path d="M16 7L12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				<path
					d="M7 12L11.5757 16.5757C11.8101 16.8101 12.1899 16.8101 12.4243 16.5757L22 7"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		);
	}

	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="text-gray-500"
			aria-hidden
		>
			<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
		</svg>
	);
}

const OFFER_DRIVER_ACTIONS_CLASS =
	"offer-driver-actions flex w-full max-w-full flex-col items-stretch gap-1.5";

function offerDriverToCheckListDriver(driver: OfferDriver): CheckListDriver {
	return {
		id: driver.driver_id,
		firstName: driver.firstName,
		lastName: driver.lastName,
		email: driver.email,
		externalId: driver.externalId,
		phone: driver.phone ?? "",
		driverStatus: driver.status,
		lastActiveApp: null,
		lastLocationUpdateAt: null,
		trackingLoadId: null,
	};
}

function ExtendBidTimeButton({
	offer,
	driver,
	onPushClick,
	disabled = false,
}: {
	offer: OfferRow;
	driver: OfferDriver;
	onPushClick: (offer: OfferRow, driver: OfferDriver) => void;
	disabled?: boolean;
}) {
	const driverKey = driver.externalId ?? driver.driver_id;
	const canExtend = canExtendDriverBidTime(offer, driver);

	if (!canExtend || !driverKey) return null;

	return (
		<button
			type="button"
			title="Send push notification"
			disabled={disabled}
			onClick={(e) => {
				e.stopPropagation();
				if (disabled) return;
				onPushClick(offer, driver);
			}}
			className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-brand-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-gray-300"
		>
			<ExtendBidTimeIcon className="h-4 w-4" />
		</button>
	);
}

const OffersList = () => {
	useWebSocketConnectionCheck();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [expandedOfferId, setExpandedOfferId] = useState<number | null>(null);
	const [addDriversOfferId, setAddDriversOfferId] = useState<number | null>(null);
	const [addDriversExistingDriverIds, setAddDriversExistingDriverIds] = useState<string[]>([]);
	const [isAddingDrivers, setIsAddingDrivers] = useState(false);
	const [deletingDriverKey, setDeletingDriverKey] = useState<string | null>(null);
	const [returningDriverKey, setReturningDriverKey] = useState<string | null>(null);
	const [acceptingDriverKey, setAcceptingDriverKey] = useState<string | null>(null);
	const [creatingChatDriverKey, setCreatingChatDriverKey] = useState<string | null>(null);
	const [sendingReminderKey, setSendingReminderKey] = useState<string | null>(null);
	const [showDriverAcceptedModal, setShowDriverAcceptedModal] = useState(false);
	const [deactivatingOfferId, setDeactivatingOfferId] = useState<number | null>(null);
	const [deactivateConfirmOffer, setDeactivateConfirmOffer] = useState<OfferRow | null>(null);
	const [showBulkDeactivateConfirm, setShowBulkDeactivateConfirm] = useState(false);
	const [isBulkDeactivating, setIsBulkDeactivating] = useState(false);
	const [returningOfferId, setReturningOfferId] = useState<number | null>(null);
	const [returnConfirmOffer, setReturnConfirmOffer] = useState<OfferRow | null>(null);
	const [showBulkReturnConfirm, setShowBulkReturnConfirm] = useState(false);
	const [isBulkReturning, setIsBulkReturning] = useState(false);
	const [editOfferData, setEditOfferData] = useState<EditOfferData | null>(null);
	const [editReturnOfferId, setEditReturnOfferId] = useState<number | null>(null);
	const [pushModalState, setPushModalState] = useState<{
		drivers: OfferDriver[];
		defaultMessage: string;
		offerContext?: { offerId: number; offerTitle: string };
	} | null>(null);
	const [ratingModalDriver, setRatingModalDriver] = useState<{
		driverId: string;
		name: string;
		avgRating: number | null;
	} | null>(null);
	const [counterOfferModal, setCounterOfferModal] =
		useState<CounterOfferModalState | null>(null);
	const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
	const [userFilterId, setUserFilterId] = useState("");
	const [selectedOfferIds, setSelectedOfferIds] = useState<number[]>([]);
	const [selectedOfferDriverKeys, setSelectedOfferDriverKeys] = useState<string[]>([]);
	const [driverSortTime, setDriverSortTime] = useState(() =>
		Math.floor(Date.now() / 1000)
	);
	const handleExtendBidPush = useCallback((offer: OfferRow, driver: OfferDriver) => {
		setPushModalState({
			drivers: [driver],
			defaultMessage: buildExtendBidTimePushMessage(offer),
		});
	}, []);

	const handleSendDriverReminder = useCallback(
		async (offerId: number, driverExternalId: string, actionKey: string) => {
			setSendingReminderKey(actionKey);
			const res = await offersApi.sendDriverReminder(offerId, driverExternalId);
			setSendingReminderKey(null);
			if (res.success) {
				await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
			} else {
				console.error(res.error);
				window.alert(
					typeof res.error === "string" ? res.error : "Failed to send reminder"
				);
			}
		},
		[queryClient]
	);

	const handleBulkSendDriverReminders = useCallback(
		async (offerId: number, drivers: OfferDriver[]) => {
			const driverExternalIds = [
				...new Set(
					drivers
						.map((driver) => String(driver.externalId ?? driver.driver_id ?? "").trim())
						.filter(Boolean)
				),
			];
			if (driverExternalIds.length === 0) return;

			const bulkActionKey = `${offerId}-bulk`;
			setSendingReminderKey(bulkActionKey);
			const res = await offersApi.sendDriversReminders(offerId, driverExternalIds);
			setSendingReminderKey(null);

			if (res.success) {
				const acceptedIds = new Set(res.accepted_driver_ids ?? []);
				setSelectedOfferDriverKeys((prev) =>
					prev.filter((key) => {
						if (!key.startsWith(`${offerId}:`)) return true;
						const driverKey = key.slice(String(offerId).length + 1);
						return !acceptedIds.has(driverKey);
					})
				);
				await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
			} else {
				console.error(res.error);
				window.alert(
					typeof res.error === "string" ? res.error : "Failed to send reminders"
				);
			}
		},
		[queryClient]
	);

	const handleCopyOfferTitle = useCallback(async (text: string) => {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			showOfferTitleCopiedToast();
		} catch {
			// Clipboard may be unavailable in this context.
		}
	}, []);

	const isAdmin = currentUser?.role === "ADMINISTRATOR";
	const canSeeAllOffers = canViewAllOffers(currentUser?.role);
	const showOfferId =
		isAdmin && String(currentUser?.externalId ?? "").trim() === "83";
	const canModifyOffersByRole = canModifyOffers(currentUser?.role);

	const handleConfirmDeactivateOffer = async () => {
		if (!deactivateConfirmOffer) return;
		const offer = deactivateConfirmOffer;
		const driversToNotify = (offer.drivers ?? []).filter((d) => d.active !== false);
		setDeactivatingOfferId(offer.id);
		const res = await offersApi.deactivateOffer(offer.id);
		setDeactivatingOfferId(null);
		setDeactivateConfirmOffer(null);
		if (res.success) {
			setSelectedOfferIds((prev) => prev.filter((id) => id !== offer.id));
			await queryClient.invalidateQueries({
				queryKey: ["offers-list-cards"],
			});
			if (driversToNotify.length > 0) {
				const offerTitle = getOfferTitle(offer);
				setPushModalState({
					drivers: driversToNotify,
					defaultMessage: buildOfferUnavailablePushMessage(offer),
					...(offerTitle
						? {
								offerContext: {
									offerId: offer.id,
									offerTitle,
								},
							}
						: {}),
				});
			}
		} else {
			console.error(res.error);
		}
	};
	const queryParams = {
		page: currentPage,
		limit: itemsPerPage,
		sort_order: "action_time_asc" as const,
		status: statusFilter,
		...(canSeeAllOffers
			? userFilterId
				? { user_id: userFilterId }
				: {}
			: { user_id: currentUser?.externalId ?? "" }),
	};

	const {
		data,
		isPending,
		isPlaceholderData,
	} = useQuery({
		queryKey: ["offers-list-cards", queryParams],
		queryFn: () => offersApi.getOffers(queryParams),
		enabled: currentUser != null,
		placeholderData: keepPreviousData,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});

	const results: OfferRow[] = useMemo(
		() => data?.data?.results ?? [],
		[data?.data?.results]
	);
	const pagination = data?.data?.pagination;
	const totalItems = pagination?.total_count ?? 0;
	const totalPages = pagination?.total_pages ?? 1;

	const visibleOfferIds = useMemo(
		() => results.map((offer) => offer.id),
		[results]
	);
	const allVisibleSelected =
		visibleOfferIds.length > 0 &&
		visibleOfferIds.every((id) => selectedOfferIds.includes(id));

	const toggleAllVisible = useCallback(() => {
		setSelectedOfferIds((prev) => {
			if (allVisibleSelected) {
				return prev.filter((id) => !visibleOfferIds.includes(id));
			}
			const next = new Set(prev);
			visibleOfferIds.forEach((id) => next.add(id));
			return Array.from(next);
		});
	}, [allVisibleSelected, visibleOfferIds]);

	const toggleOfferSelected = useCallback((offerId: number) => {
		setSelectedOfferIds((prev) =>
			prev.includes(offerId)
				? prev.filter((id) => id !== offerId)
				: [...prev, offerId]
		);
	}, []);

	const toggleOfferDriverSelected = useCallback((selectionKey: string) => {
		setSelectedOfferDriverKeys((prev) =>
			prev.includes(selectionKey)
				? prev.filter((key) => key !== selectionKey)
				: [...prev, selectionKey]
		);
	}, []);

	const toggleAllOfferDriversSelected = useCallback(
		(offerId: number, drivers: OfferDriver[] | undefined) => {
			const driverKeys = getOfferDriverSelectionKeys(offerId, drivers);
			if (driverKeys.length === 0) return;
			setSelectedOfferDriverKeys((prev) => {
				const allSelected = driverKeys.every((key) => prev.includes(key));
				if (allSelected) {
					return prev.filter((key) => !driverKeys.includes(key));
				}
				const next = new Set(prev);
				driverKeys.forEach((key) => next.add(key));
				return Array.from(next);
			});
		},
		[]
	);

	const allOfferDriverKeys = useMemo(
		() =>
			results.flatMap((offer) =>
				getOfferDriverSelectionKeys(offer.id, offer.drivers)
			),
		[results]
	);

	useEffect(() => {
		setSelectedOfferDriverKeys((prev) => {
			const next = prev.filter((key) => allOfferDriverKeys.includes(key));
			return next.length === prev.length ? prev : next;
		});
	}, [allOfferDriverKeys]);

	const handleConfirmBulkDeactivateOffers = async () => {
		if (selectedOfferIds.length === 0) return;
		const selectedOffers = results.filter((offer) =>
			selectedOfferIds.includes(offer.id)
		);
		const driversByKey = new Map<string, OfferDriver>();
		for (const offer of selectedOffers) {
			for (const driver of offer.drivers ?? []) {
				if (driver.active === false) continue;
				const key = String(driver.externalId ?? driver.driver_id ?? "");
				if (!key || driversByKey.has(key)) continue;
				driversByKey.set(key, driver);
			}
		}
		setIsBulkDeactivating(true);
		const res = await offersApi.deactivateOffers(selectedOfferIds);
		setIsBulkDeactivating(false);
		setShowBulkDeactivateConfirm(false);
		if (res.success) {
			setSelectedOfferIds([]);
			setSelectedOfferDriverKeys([]);
			await queryClient.invalidateQueries({
				queryKey: ["offers-list-cards"],
			});
			const driversToNotify = Array.from(driversByKey.values());
			if (driversToNotify.length > 0) {
				setPushModalState({
					drivers: driversToNotify,
					defaultMessage: OFFER_UNAVAILABLE_PUSH_BODY,
				});
			}
		} else {
			console.error(res.error);
		}
	};

	const handleConfirmReturnOffer = async () => {
		if (!returnConfirmOffer) return;
		const offer = returnConfirmOffer;
		setReturningOfferId(offer.id);
		const res = await offersApi.returnOffer(offer.id);
		setReturningOfferId(null);
		setReturnConfirmOffer(null);
		if (res.success) {
			setSelectedOfferIds((prev) => prev.filter((id) => id !== offer.id));
			await queryClient.invalidateQueries({
				queryKey: ["offers-list-cards"],
			});
		} else {
			console.error(res.error);
			window.alert(
				typeof res.error === "string" ? res.error : "Failed to return offer"
			);
		}
	};

	const handleConfirmBulkReturnOffers = async () => {
		if (selectedOfferIds.length === 0) return;
		setIsBulkReturning(true);
		const res = await offersApi.returnOffers(selectedOfferIds);
		setIsBulkReturning(false);
		setShowBulkReturnConfirm(false);
		if (res.success) {
			setSelectedOfferIds([]);
			setSelectedOfferDriverKeys([]);
			await queryClient.invalidateQueries({
				queryKey: ["offers-list-cards"],
			});
		} else {
			console.error(res.error);
			window.alert(
				typeof res.error === "string" ? res.error : "Failed to return offers"
			);
		}
	};

	useEffect(() => {
		const nowUnixSeconds = Math.floor(Date.now() / 1000);
		const nextExpiry = results
			.flatMap(offer => offer.drivers ?? [])
			.map(driver => normalizeUnixSeconds(driver.action_time))
			.filter((time): time is number => time != null && time > nowUnixSeconds)
			.sort((a, b) => a - b)[0];
		if (nextExpiry == null) return;

		const timeoutId = window.setTimeout(
			() => setDriverSortTime(Math.floor(Date.now() / 1000)),
			Math.max(0, (nextExpiry - nowUnixSeconds) * 1000 + 50)
		);
		return () => window.clearTimeout(timeoutId);
	}, [results, driverSortTime]);

	return (
		<div className="bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header: Show X entries */}
			<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<span className="text-gray-500 dark:text-gray-400"> Show </span>
					<CustomStaticSelect
						options={[
							{ value: "5", label: "5" },
							{ value: "8", label: "8" },
							{ value: "10", label: "10" },
							{ value: "20", label: "20" },
							{ value: "50", label: "50" },
						]}
						value={itemsPerPage.toString()}
						onChangeAction={val => {
							setItemsPerPage(Number(val));
							setCurrentPage(1);
						}}
					/>
					<span className="text-gray-500 dark:text-gray-400"> entries </span>
					<Button
						size="sm"
						variant="primary"
						disabled={
							!canModifyOffersByRole ||
							visibleOfferIds.length === 0 ||
							isPending
						}
						onClick={() => {
							if (!canModifyOffersByRole) return;
							toggleAllVisible();
						}}
						className="ml-2 h-9"
					>
						{allVisibleSelected ? "Deselect all" : "Select all"}
					</Button>
					{statusFilter === "active" && selectedOfferIds.length > 0 && (
						<button
							type="button"
							disabled={!canModifyOffersByRole || isBulkDeactivating}
							onClick={() => setShowBulkDeactivateConfirm(true)}
							className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
						>
							Deactivate offers
							<DeactivateOfferIcon className="h-5 w-5 shrink-0" aria-hidden />
						</button>
					)}
					{statusFilter === "inactive" && selectedOfferIds.length > 0 && (
						<button
							type="button"
							disabled={!canModifyOffersByRole || isBulkReturning}
							onClick={() => setShowBulkReturnConfirm(true)}
							className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-0 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
						>
							Return offers
						</button>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{canSeeAllOffers && (
						<>
							<span className="text-gray-500 dark:text-gray-400"> User </span>
							<UserFilterSelect
								value={userFilterId}
								source="offer-creators"
								queryKeyPrefix="offers-user-filter"
								onChangeAction={(val) => {
									setUserFilterId(val);
									setCurrentPage(1);
								}}
							/>
						</>
					)}
					<span className="text-gray-500 dark:text-gray-400"> Status </span>
					<CustomStaticSelect
						options={[
							{ value: "active", label: "Active" },
							{ value: "inactive", label: "Inactive" },
						]}
						value={statusFilter}
						onChangeAction={(val) => {
							const nextStatus = val as "active" | "inactive";
							setStatusFilter(nextStatus);
							setCurrentPage(1);
							setSelectedOfferIds([]);
							setSelectedOfferDriverKeys([]);
						}}
					/>
				</div>
			</div>

			{/* Cards list */}
			<div className="border border-t-0 border-b-0 border-gray-100 dark:border-white/[0.05] px-4 py-4">
				{isPending ? (
					<div className="flex justify-center py-8">
						<SpinnerOne />
					</div>
				) : results.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 gap-4">

						<p className="text-sm text-gray-500 dark:text-gray-400">No offers found</p>
					</div>
				) : (
					<div className="space-y-3">
						{results.map((row) => {
							const isExpanded = expandedOfferId === row.id;
							const creatorLabel = canSeeAllOffers ? formatOfferCreatorLabel(row.creator) : null;
							const allDriversInactive =
								(row.drivers?.length ?? 0) > 0 &&
								row.drivers!.every((d) => d.active === false);
							const headerHighlightRed = row.active === false || allDriversInactive;
							const offerTitle = getVisibleOfferTitle(row, showOfferId);
							return (
								<div
									key={row.id}
									className="relative w-full rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/[0.05] dark:bg-gray-900 overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_180px]"
								>
								<div
									className={`px-4 py-3 cursor-pointer select-none transition-colors ${
										headerHighlightRed
											? "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
											: "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
									}`}
									onClick={() =>
										setExpandedOfferId((id) => (id === row.id ? null : row.id))
									}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex min-w-0 flex-1 items-center gap-2">
											<input
												type="checkbox"
												className="h-4 w-4 shrink-0 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
												checked={selectedOfferIds.includes(row.id)}
												onChange={() => toggleOfferSelected(row.id)}
												onClick={(e) => e.stopPropagation()}
												aria-label={`Select offer ${row.id}`}
											/>
											<button
												type="button"
												className="min-w-0 max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-base font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-300"
												title="Click to copy"
												onClick={(e) => {
													e.stopPropagation();
													handleCopyOfferTitle(offerTitle);
												}}
											>
												{offerTitle}
											</button>
											<OfferCardUnreadBadge offerId={row.id} drivers={row.drivers} />
											{hasHazmat(row.special_requirements) && (
												<Image
													src="/images/hazmat.png"
													alt="Hazmat"
													width={42}
													height={42}
													className="flex-shrink-0 object-contain"
												/>
											)}
										</div>
										<div className="flex flex-shrink-0 items-center justify-center gap-2">
											<button
												type="button"
												disabled={!canModifyOffersByRole}
												title="Edit offer"
												onClick={(e) => {
													e.stopPropagation();
													if (!canModifyOffersByRole) return;
													setEditReturnOfferId(row.active === false ? row.id : null);
													setEditOfferData(buildEditOfferData(row));
												}}
												className="inline-flex h-[39px] w-[39px] shrink-0 items-center justify-center p-0 border-0 bg-transparent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<EditOfferIcon className="h-[39px] w-[39px] shrink-0" aria-hidden />
											</button>
											{row.active !== false && (
												<button
													type="button"
													disabled={!canModifyOffersByRole || deactivatingOfferId === row.id}
													onClick={(e) => {
														e.stopPropagation();
														if (!canModifyOffersByRole) return;
														setDeactivateConfirmOffer(row);
													}}
													className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
												>
													Deactivate offer
													<DeactivateOfferIcon className="h-5 w-5 shrink-0" aria-hidden />
												</button>
											)}
											{row.active === false && (
												<button
													type="button"
													disabled={!canModifyOffersByRole || returningOfferId === row.id}
													onClick={(e) => {
														e.stopPropagation();
														if (!canModifyOffersByRole) return;
														setReturnConfirmOffer(row);
													}}
													className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-0 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
												>
													Return
												</button>
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													setExpandedOfferId((id) => (id === row.id ? null : row.id));
												}}
												className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:text-brand-200 dark:hover:bg-gray-800"
											>
												<span>{isExpanded ? "Show less" : "Show more"}</span>
												{isExpanded ? (
													<ChevronUpIcon className="h-4 w-4" />
												) : (
													<ChevronDownIcon className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
									<div className="flex flex-col gap-1 min-w-0">
										{row.update_date?.trim() ? (
											<p className="text-sm text-gray-500 dark:text-gray-400 truncate">
												Update at {formatOfferCreateTimeEst(row.update_date)}
											</p>
										) : null}
										{(creatorLabel || row.create_time) && (
											<p className="text-sm text-gray-500 dark:text-gray-400 truncate">
												{creatorLabel}
												{creatorLabel && row.create_time ? " " : null}
												{row.create_time ? formatOfferCreateTimeEst(row.create_time) : null}
											</p>
										)}
										{/* Driver rows: active timers first, expired timers below */}
										{(() => {
											const participatingDrivers = getParticipatingOfferDrivers(row.drivers);
											const activeTimerDrivers = sortOfferDriversByBidStatus(
												participatingDrivers.filter(
													(d) => getDriverBidSortPriority(d, driverSortTime) === 0
												),
												driverSortTime
											);
											const expiredTimerDrivers = sortOfferDriversByBidStatus(
												participatingDrivers.filter(
													(d) => getDriverBidSortPriority(d, driverSortTime) !== 0
												),
												driverSortTime
											);
											if (activeTimerDrivers.length === 0 && expiredTimerDrivers.length === 0) {
												return null;
											}
											return (
												<div className="mt-2 flex flex-col gap-2">
													{activeTimerDrivers.length > 0 && (
														<div className="flex flex-wrap items-center gap-2">
															{activeTimerDrivers.map((driver, driverIdx) => (
																<OfferDriverBadge
																	key={`${row.id}-active-${driver.driver_id ?? driver.externalId ?? driverIdx}`}
																	offer={row}
																	driver={driver}
																	driverIdx={driverIdx}
																	canModifyOffersByRole={canModifyOffersByRole}
															onPushClick={handleExtendBidPush}
																/>
															))}
														</div>
													)}
													{expiredTimerDrivers.length > 0 && (
														<div className="flex flex-wrap items-center gap-2">
															{expiredTimerDrivers.map((driver, driverIdx) => (
																<OfferDriverBadge
																	key={`${row.id}-expired-${driver.driver_id ?? driver.externalId ?? driverIdx}`}
																	offer={row}
																	driver={driver}
																	driverIdx={driverIdx}
																	canModifyOffersByRole={canModifyOffersByRole}
															onPushClick={handleExtendBidPush}
																/>
															))}
														</div>
													)}
												</div>
											);
										})()}
									</div>
								</div>
									{isExpanded && (
										<div className="border-t border-gray-100 dark:border-white/[0.05] px-4 py-3">
											<div className="w-full max-w-[1400px]">
											<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
												Details
											</h3>
											<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
												<Table className="w-full border-collapse table-fixed">
													<colgroup>
														<col style={{ width: "320px" }} />
														<col style={{ width: "90px" }} />
														<col style={{ width: "100px" }} />
														<col style={{ width: "100px" }} />
														<col style={{ width: "160px" }} />
														<col style={{ width: "90px" }} />
														<col style={{ width: "186px" }} />
													</colgroup>
													<TableHeader className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
														<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Route
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Weight
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Offered Rate
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Commodity
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Special Requirements
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																Total miles
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Notes
															</TableCell>
														</TableRow>
													</TableHeader>
													<TableBody>
														<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-pre-line">
																{formatRoute(row.route) || ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.weight != null ? `${Number(row.weight).toLocaleString("en-US")} lbs` : ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.offered_rate != null
																	? `$${Number(row.offered_rate).toLocaleString("en-US")}`
																	: ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.commodity ?? ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																<SpecialRequirementsList value={row.special_requirements} />
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																{row.loaded_miles != null
																	? Math.round(row.loaded_miles)
																	: ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.notes && String(row.notes).trim()
																	? String(row.notes).trim()
																	: ""}
															</TableCell>
														</TableRow>
													</TableBody>
												</Table>
											</div>

											{/* Drivers table */}
											{row.drivers && row.drivers.length > 0 && (
												<div className="mt-4">
													<div className="mb-2 flex items-center justify-between gap-3">
														<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
															Drivers
														</h3>
														{(() => {
															const selectedDriversForOffer = (row.drivers ?? []).filter(
																(driver) => {
																	const key = getOfferDriverSelectionKey(row.id, driver);
																	return (
																		key != null &&
																		selectedOfferDriverKeys.includes(key)
																	);
																}
															);
															const showBulkReminder =
																selectedDriversForOffer.length > 0 &&
																row.active !== false &&
																!row.is_driver_selected;
															const showAddDrivers =
																row.active !== false && !row.is_driver_selected;
															if (!showBulkReminder && !showAddDrivers) return null;
															return (
																<div className="flex shrink-0 items-center gap-2">
																	{showBulkReminder && (
																		<BulkSendReminderButton
																			offerId={row.id}
																			drivers={selectedDriversForOffer}
																			canModifyOffersByRole={canModifyOffersByRole}
																			sendingReminderKey={sendingReminderKey}
																			onSend={handleBulkSendDriverReminders}
																		/>
																	)}
																	{showAddDrivers && (
																		<button
																			type="button"
																			disabled={!canModifyOffersByRole}
																			onClick={() => {
																				if (!canModifyOffersByRole) return;
																				setAddDriversOfferId(row.id);
																				setAddDriversExistingDriverIds(
																					Array.from(
																						new Set(
																							(row.drivers ?? []).flatMap(d =>
																								[d.driver_id, d.externalId].filter(
																									(x): x is string => Boolean(x)
																								)
																							)
																						)
																					)
																				);
																			}}
																			className="inline-flex h-[39px] shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-0 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-600 dark:disabled:hover:bg-brand-500"
																		>
																			Add drivers
																			<AddPlusCircleIcon />
																		</button>
																	)}
																</div>
															);
														})()}
													</div>
													<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
													<Table className="w-full min-w-0 border-collapse table-fixed">
												<colgroup>
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_SELECT)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_UNIT)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_EMPTY_MILES)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_TOTAL_MILES)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_DRIVER_ETA)} />
													<col
														style={fixedDriverTableCol(row.is_driver_selected ? "96px" : "88px")}
													/>
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_BID_TIMER)} />
													{!row.is_driver_selected && (
														<col style={actionsDriverTableCol()} />
													)}
												</colgroup>
														<TableHeader className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
															<TableRow className="border-gray-200 dark:border-white/[0.08]">
															{(() => {
																const offerDriverKeys = getOfferDriverSelectionKeys(
																	row.id,
																	row.drivers
																);
																const allDriversSelected =
																	offerDriverKeys.length > 0 &&
																	offerDriverKeys.every((key) =>
																		selectedOfferDriverKeys.includes(key)
																	);
																const someDriversSelected =
																	offerDriverKeys.some((key) =>
																		selectedOfferDriverKeys.includes(key)
																	);
																return (
																	<TableCell
																		isHeader
																		className="px-2 py-2 text-center border-b border-r border-gray-200 dark:border-white/[0.08]"
																	>
																		<input
																			type="checkbox"
																			className={OFFER_DRIVER_CHECKBOX_CLASS}
																			checked={allDriversSelected}
																			ref={(el) => {
																				if (el) {
																					el.indeterminate =
																						someDriversSelected &&
																						!allDriversSelected;
																				}
																			}}
																			disabled={offerDriverKeys.length === 0}
																			onChange={() =>
																				toggleAllOfferDriversSelected(
																					row.id,
																					row.drivers
																				)
																			}
																			aria-label={`Select all drivers for offer ${row.id}`}
																		/>
																	</TableCell>
																);
															})()}
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Unit
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																Empty miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	Total miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	Driver&apos;s ETA
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Rate
																</TableCell>
																<TableCell isHeader className="px-2 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	Bid timer
																</TableCell>
																{!row.is_driver_selected && (
																	<TableCell isHeader className="px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/[0.08]">
																		Actions
																	</TableCell>
																)}
															</TableRow>
														</TableHeader>
														<TableBody>
											{sortOfferDriversByBidStatus(row.drivers ?? [], driverSortTime).map((driver, driverIndex) => {
																const driverUnitId = driver.externalId ?? driver.driver_id;
																const driverSelectionKey = getOfferDriverSelectionKey(
																	row.id,
																	driver
																);
																const isDriverChecked =
																	driverSelectionKey != null &&
																	selectedOfferDriverKeys.includes(driverSelectionKey);
																const driverDisplayName = [
																	driver.externalId != null ? `(${driver.externalId})` : null,
																	[driver.firstName, driver.lastName].filter(Boolean).join(" ") || "",
																]
																	.filter(Boolean)
																	.join(" ");
																const tmsDriverUrl = buildTmsDriverPageUrl(driver.externalId);

																return (
																<TableRow
																	key={`${row.id}-${driver.driver_id ?? driver.externalId ?? driverIndex}`}
																	className={`border-gray-200 dark:border-white/[0.08] ${driver.is_selected ? "bg-green-100 dark:bg-green-900/25" : driver.active === false ? "bg-red-100 dark:bg-red-900/25" : ""}`}
																>
															<TableCell className="px-2 py-2 text-center border-b border-r border-gray-200 dark:border-white/[0.08]">
																{driverSelectionKey ? (
																	<input
																		type="checkbox"
																		className={OFFER_DRIVER_CHECKBOX_CLASS}
																		checked={isDriverChecked}
																		onChange={() =>
																			toggleOfferDriverSelected(driverSelectionKey)
																		}
																		aria-label={`Select driver ${driverDisplayName || driverSelectionKey}`}
																	/>
																) : null}
															</TableCell>
															<TableCell className="relative min-w-0 px-3 py-2 pr-7 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																<span
																	className="absolute right-1.5 top-1.5 inline-flex"
																	title={driver.is_read ? "Read" : "Not read"}
																>
																	<OfferDriverReadMarks read={Boolean(driver.is_read)} />
																</span>
																<div className="flex min-w-0 flex-col items-start gap-0.5">
																	<span className="inline-flex max-w-full items-center gap-1.5">
																		{tmsDriverUrl ? (
																			<a
																				href={tmsDriverUrl}
																				target="_blank"
																				rel="noopener noreferrer"
																				onClick={(e) => e.stopPropagation()}
																				className="truncate text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
																			>
																				{driverDisplayName}
																			</a>
																		) : (
																			<span className="truncate">{driverDisplayName}</span>
																		)}
																		{driverUnitId ? (
																			<span onClick={(e) => e.stopPropagation()}>
																				<DriverRatingBadge
																					avgRating={driver.driver_rating}
																					onClick={() =>
																						setRatingModalDriver({
																							driverId: String(driverUnitId),
																							name: driverDisplayName,
																							avgRating: driver.driver_rating ?? null,
																						})
																					}
																				/>
																			</span>
																		) : null}
																	</span>
																	{driver.phone ? (
																		<a
																			href={`tel:${driver.phone.replace(/\s/g, "")}`}
																			onClick={(e) => e.stopPropagation()}
																			className="text-theme-xs text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 whitespace-nowrap"
																		>
																			{driver.phone}
																		</a>
																	) : null}
																</div>
															</TableCell>
															<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																{driver.empty_miles != null
																			? Math.round(driver.empty_miles)
																			: ""}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 border-r dark:border-white/[0.08] whitespace-nowrap">
																		{driver.total_miles != null
																			? Math.round(driver.total_miles)
																			: ""}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																		{driver.driver_eta?.trim() || ""}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																		<div className="flex flex-col items-center gap-0.5">
																			{driver.rate != null ? (
																				<span>{formatDriverBidRate(driver.rate)}</span>
																			) : null}
																			{driver.extension_rates?.map((extensionRate) => {
																				const label = formatExtensionBidRate(extensionRate);
																				if (!label) return null;
																				return (
																					<span
																						key={extensionRate.offer_id}
																						className="text-gray-400 dark:text-gray-500"
																					>
																						{label}
																					</span>
																				);
																			})}
																			{driver.counter_offer != null && (
																				<span className="text-xs font-medium text-yellow-500 dark:text-yellow-400">
																					{formatDriverBidRate(driver.counter_offer)}
																				</span>
																			)}
																		</div>
																	</TableCell>
																	<TableCell className="px-2 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																			<DriverBidTimer
																				offer={row}
																				driver={driver}
																				canModifyOffersByRole={canModifyOffersByRole}
																				onPushClick={(offer, driverItem) => {
																					setPushModalState({
																						drivers: [driverItem],
																						defaultMessage: buildExtendBidTimePushMessage(offer),
																					});
																				}}
																			/>
																	</TableCell>
																	{!row.is_driver_selected && (
																		<TableCell className="min-w-0 px-2 py-2 text-center text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-white/[0.08] align-top">
																			{(() => {
																				const driverKey = driver.externalId ?? driver.driver_id;
																				const actionKey = driverKey ? `${row.id}-${driverKey}` : null;
																				const createChatButton =
																					driverUnitId && actionKey ? (
																						<button
																							type="button"
																							title={
																								driver.has_offer_chat
																									? "Open chat"
																									: "Add chat"
																							}
																							disabled={
																								!canModifyOffersByRole ||
																								creatingChatDriverKey === actionKey
																							}
																							onClick={async () => {
																								if (!canModifyOffersByRole || !driverUnitId) return;
																								const chatUrl = buildOfferChatUrl(
																									String(row.id),
																									driverUnitId
																								);
																								if (driver.has_offer_chat) {
																									window.location.href = chatUrl;
																									return;
																								}
																								setCreatingChatDriverKey(actionKey);
																								const res = await offersApi.createOfferDriverChat(
																									row.id,
																									String(driverUnitId)
																								);
																								setCreatingChatDriverKey(null);
																								if (res.success) {
																									window.location.href = chatUrl;
																								} else {
																									console.error(res.error);
																									window.alert(
																										typeof res.error === "string"
																											? res.error
																											: "Failed to create offer chat"
																									);
																								}
																							}}
																							className="relative inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
																						>
																							<OfferDriverChatIcon className="h-3.5 w-3.5 shrink-0" />
																							{driver.has_offer_chat ? "Open chat" : "Add chat"}
																							<OfferChatUnreadBadge
																								offerId={row.id}
																								unitId={driverUnitId}
																								placement="corner"
																							/>
																						</button>
																					) : null;

																				if (driver.active === false) {
																					return (
																						<div className={OFFER_DRIVER_ACTIONS_CLASS}>
																							{createChatButton}
																							<button
																								type="button"
																								disabled={
																									!canModifyOffersByRole ||
																									returningDriverKey === actionKey
																								}
																								onClick={async () => {
																									if (!canModifyOffersByRole) return;
																									if (!driverKey) return;
																									setReturningDriverKey(`${row.id}-${driverKey}`);
																									const res = await offersApi.returnDriverToOffer(row.id, driverKey);
																									setReturningDriverKey(null);
																									if (res.success) {
																										await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																									} else {
																										console.error(res.error);
																									}
																								}}
																								className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
																							>
																								Return
																							</button>
																						</div>
																					);
																				}

																				return (
																					<div className={OFFER_DRIVER_ACTIONS_CLASS}>
																						{createChatButton}
																						<SendReminderButton
																							offerId={row.id}
																							driver={driver}
																							actionKey={actionKey}
																							canModifyOffersByRole={canModifyOffersByRole}
																							sendingReminderKey={sendingReminderKey}
																							onSend={handleSendDriverReminder}
																						/>
																						<button
																							type="button"
																							disabled={
																								!canModifyOffersByRole ||
																								deletingDriverKey === actionKey
																							}
																							onClick={async () => {
																								if (!canModifyOffersByRole) return;
																								if (!driverKey) return;
																								setDeletingDriverKey(`${row.id}-${driverKey}`);
																								const res = await offersApi.removeDriverFromOffer(row.id, driverKey);
																								setDeletingDriverKey(null);
																								if (res.success) {
																									await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																									const offerTitle = getOfferTitle(row);
																									setPushModalState({
																										drivers: [driver],
																										defaultMessage: buildOfferUnavailablePushMessage(row),
																										...(offerTitle
																											? {
																													offerContext: {
																														offerId: row.id,
																														offerTitle,
																													},
																												}
																											: {}),
																									});
																								} else {
																									console.error(res.error);
																								}
																							}}
																							className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
																						>
																							<OfferDeleteIcon className="h-3.5 w-3.5 shrink-0" />
																							Delete
																						</button>
																						<button
																							type="button"
																							disabled={
																								!canModifyOffersByRole ||
																								acceptingDriverKey === actionKey ||
																								driver.rate == null
																							}
																							title={driver.rate == null ? "Rate is not set" : undefined}
																							onClick={() => {
																								if (!canModifyOffersByRole) return;
																								if (!driverKey) return;
																								setAcceptingDriverKey(`${row.id}-${driverKey}`);
																								offersApi
																									.selectDriverForOffer(row.id, driverKey)
																									.then(async (res) => {
																										if (res.success) {
																											await queryClient.invalidateQueries({
																												queryKey: ["offers-list-cards"],
																											});
																											setShowDriverAcceptedModal(true);
																										} else {
																											console.error(res.error);
																											window.alert(
																												typeof res.error === "string"
																													? res.error
																													: "Failed to accept driver"
																											);
																										}
																									})
																									.finally(() => {
																										setAcceptingDriverKey(null);
																									});
																							}}
																							className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
																						>
																							<OfferAcceptIcon className="h-3.5 w-3.5 shrink-0" />
																							Accept
																						</button>
																						{driver.rate != null && driver.counter_offer == null && (
																							<button
																								type="button"
																								disabled={!canModifyOffersByRole}
																								onClick={() => {
																									if (!canModifyOffersByRole) return;
																									if (!driverKey) return;
																									setCounterOfferModal({
																										offerId: row.id,
																										driverExternalId: driverKey,
																										driverName: driverDisplayName || "Driver",
																										driverRate: driver.rate,
																									});
																								}}
																								className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
																							>
																								<OfferCounterOfferIcon className="h-3.5 w-3.5 shrink-0" />
																								Counter offer
																							</button>
																						)}
																					</div>
																				);
																			})()}
																		</TableCell>
																	)}
																</TableRow>
															);
															})}
														</TableBody>
													</Table>
													</div>
												</div>
											)}
											</div>
										</div>
									)}
									{(deactivatingOfferId === row.id ||
										(deletingDriverKey != null && deletingDriverKey.startsWith(`${row.id}-`)) ||
										(returningDriverKey != null && returningDriverKey.startsWith(`${row.id}-`)) ||
										(acceptingDriverKey != null && acceptingDriverKey.startsWith(`${row.id}-`)) ||
										(creatingChatDriverKey != null && creatingChatDriverKey.startsWith(`${row.id}-`)) ||
										(sendingReminderKey != null && sendingReminderKey.startsWith(`${row.id}-`))) && (
										<div
											className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-white/70 dark:bg-white/10"
											aria-hidden
										>
											<SpinnerOne />
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer: pagination */}
			<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
					<div className="pb-3 xl:pb-0">
						<p className="pb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
							{totalItems === 0
								? "Showing 0 entries"
								: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
										currentPage * itemsPerPage,
										totalItems
									)} of ${totalItems} entries`}
						</p>
					</div>
					{totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => setCurrentPage(page)}
						/>
					)}
				</div>
			</div>

			{addDriversOfferId && (
				<AddDriversModal
					isOpen={true}
					onClose={() => {
						setAddDriversOfferId(null);
						setAddDriversExistingDriverIds([]);
					}}
					offerId={addDriversOfferId}
					existingDriverIds={addDriversExistingDriverIds}
					isSubmitting={isAddingDrivers}
					onAddDrivers={async (offerId, selectedDriverIds, driverEmptyMiles) => {
						setIsAddingDrivers(true);
						try {
							const res = await offersApi.addDriversToOffer(
								offerId,
								selectedDriverIds,
								driverEmptyMiles
							);
							if (res.success) {
								await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
							}
						} finally {
							setIsAddingDrivers(false);
						}
					}}
				/>
			)}

			{editOfferData && (
				<CreateOfferModal
					isOpen={true}
					onClose={() => {
						setEditOfferData(null);
						setEditReturnOfferId(null);
					}}
					externalId={editOfferData.externalId}
					selectedDriverIds={editOfferData.selectedDriverIds}
					driverEmptyMiles={editOfferData.driverEmptyMiles}
					editData={editOfferData}
					onSubmit={async () => {
						if (editReturnOfferId != null) {
							const res = await offersApi.returnOffer(editReturnOfferId);
							if (!res.success) {
								throw new Error(
									typeof res.error === "string"
										? res.error
										: "Failed to return offer"
								);
							}
							setSelectedOfferIds((prev) =>
								prev.filter((id) => id !== editReturnOfferId)
							);
						}
						await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
					}}
				/>
			)}

			<CheckListPushModal
				isOpen={pushModalState != null}
				onClose={() => setPushModalState(null)}
				drivers={
					pushModalState
						? pushModalState.drivers.map(offerDriverToCheckListDriver)
						: null
				}
				defaultMessage={pushModalState?.defaultMessage}
				offerContext={pushModalState?.offerContext}
			/>

			{ratingModalDriver && (
				<DriverRatingModal
					isOpen
					onClose={() => setRatingModalDriver(null)}
					driverId={ratingModalDriver.driverId}
					driverName={ratingModalDriver.name}
					ratingsCount={0}
					avgRating={ratingModalDriver.avgRating}
				/>
			)}

			<CounterOfferModal
				isOpen={counterOfferModal != null}
				state={counterOfferModal}
				onClose={() => setCounterOfferModal(null)}
				onSaved={async () => {
					await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
				}}
			/>

			<ConfirmModal
				isOpen={deactivateConfirmOffer != null}
				onClose={() => setDeactivateConfirmOffer(null)}
				onConfirm={handleConfirmDeactivateOffer}
				title="Deactivate offer"
				message="Are you sure you want to delete this offer?"
				confirmText="Confirm"
				cancelText="Cancel"
				isLoading={deactivatingOfferId === deactivateConfirmOffer?.id}
				icon={<DeactivateOfferIcon className="h-6 w-6" aria-hidden />}
				variant="danger"
			/>

			<ConfirmModal
				isOpen={returnConfirmOffer != null}
				onClose={() => setReturnConfirmOffer(null)}
				onConfirm={handleConfirmReturnOffer}
				title="Return offer"
				message="Return this offer to active? Driver bids will be cleared and drivers will get a new offer notification."
				confirmText="Confirm"
				cancelText="Cancel"
				isLoading={returningOfferId === returnConfirmOffer?.id}
				icon={<CheckCircleIcon className="h-6 w-6" aria-hidden />}
				variant="info"
			/>

			<ConfirmModal
				isOpen={showBulkReturnConfirm}
				onClose={() => setShowBulkReturnConfirm(false)}
				onConfirm={handleConfirmBulkReturnOffers}
				title="Return offers"
				message={`Return ${selectedOfferIds.length} selected offer(s) to active? Driver bids will be cleared and drivers will get a new offer notification.`}
				confirmText="Confirm"
				cancelText="Cancel"
				isLoading={isBulkReturning}
				icon={<CheckCircleIcon className="h-6 w-6" aria-hidden />}
				variant="info"
			/>

			<ConfirmModal
				isOpen={showBulkDeactivateConfirm}
				onClose={() => setShowBulkDeactivateConfirm(false)}
				onConfirm={handleConfirmBulkDeactivateOffers}
				title="Deactivate offers"
				message={`Are you sure you want to deactivate ${selectedOfferIds.length} selected offer(s)?`}
				confirmText="Confirm"
				cancelText="Cancel"
				isLoading={isBulkDeactivating}
				icon={<DeactivateOfferIcon className="h-6 w-6" aria-hidden />}
				variant="danger"
			/>

			<Modal
				isOpen={showDriverAcceptedModal}
				onClose={() => setShowDriverAcceptedModal(false)}
				className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900 sm:m-0"
				closeOnBackdropClick
			>
				<div className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
						<CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
					</div>
					<h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
						Driver accepted
					</h3>
					<p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
						{DRIVER_ACCEPTED_MESSAGE}
					</p>
					<Button
						variant="primary"
						onClick={() => setShowDriverAcceptedModal(false)}
						className="w-full"
					>
						OK
					</Button>
				</div>
			</Modal>
		</div>
	);
};

export default OffersList;
