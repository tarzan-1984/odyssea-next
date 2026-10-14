"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import {
	MoreDotIcon,
	TrashDeleteIcon,
	EditIcon,
	AttachmentIcon,
	LoadTrackingChatIcon,
	MobileMessageNotificationIcon,
	CopyLocationUpdateIcon,
} from "@/icons";
import { ChatRoom } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import { renderAvatar } from "@/helpers";
import { renderLoadChatAvatar } from "@/utils/loadChatAvatar";
import ChatParticipantsModal from "./ChatParticipantsModal";
import DeleteChatConfirmModal from "./DeleteChatConfirmModal";
import FilesModal from "./FilesModal";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import SetLoadRestModal from "./SetLoadRestModal";
import LoadChatRestStatusIcon from "./LoadChatRestStatusIcon";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import {
	CHAT_HEADER_AVATAR_CLASS,
	getOtherChatParticipant,
	participantUserToAvatarData,
} from "@/utils/chatOtherParticipant";
import { isMultiUserChatType } from "@/utils/chatRoomTypes";
import { getOfferChatStaffHeaderTitle } from "@/utils/offerChatDisplay";
import { formatChatPeerDisplayName } from "@/utils/chatPeerDisplayName";
import { canSeeLoadStaleLocationSystemMessage } from "@/utils/systemMessageKind";
import { canLeaveLoadChat, canSendCheckListMessages } from "@/utils/roleAccess";
import { formatLoadChatLastLocationLine } from "@/utils/nyWallClock";
import { roadEtaHeaderKindLabel } from "@/utils/loadRouteEta";
import { normalizeLoadChatStatus } from "@/utils/loadStatusLabel";
import { resolveLoadChatStaleLocationAlert } from "@/utils/loadChatStaleLocation";
import {
	buildLoadLocationUpdateMessage,
	formatCurrentLocationForUpdate,
	formatMilesLeftForLocationUpdate,
} from "@/utils/loadLocationUpdateMessage";
import BusyOnOtherLoadMessage from "./BusyOnOtherLoadMessage";
import { parseBusyOnOtherLoad } from "@/utils/busyOnOtherLoad";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";
import { useChatStore } from "@/stores/chatStore";
import { useStaleLocationClock } from "@/hooks/useStaleLocationClock";

interface ChatBoxHeaderProps {
	chatRoom?: ChatRoom;
	isUserOnline?: (userId: string) => boolean;
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

export default function ChatBoxHeader({ chatRoom, isUserOnline }: ChatBoxHeaderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownAnchorRef = useRef<HTMLButtonElement>(null);
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [chatAction, setChatAction] = useState<"delete" | "leave">("delete");
	const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
	const [isPushModalOpen, setIsPushModalOpen] = useState(false);
	const [isRestModalOpen, setIsRestModalOpen] = useState(false);
	const [locationUpdateCopied, setLocationUpdateCopied] = useState(false);
	const currentUser = useCurrentUser();
	const updateChatRoom = useChatStore(state => state.updateChatRoom);
	const showLoadTrackingHeader =
		chatRoom?.type === "LOAD" &&
		canSeeLoadStaleLocationSystemMessage(currentUser?.role);
	const busyOnLoad = showLoadTrackingHeader
		? parseBusyOnOtherLoad(chatRoom?.busyOnLoad)
		: null;
	const lastLocationLabel = showLoadTrackingHeader
		? formatLoadChatLastLocationLine({
				locationLabel: chatRoom?.lastLocationLabel,
				remainingMiles: busyOnLoad ? null : chatRoom?.roadEta?.remainingMiles,
				updatedAt: chatRoom?.lastLocationUpdateAt,
			})
		: "";
	const roadEtaLabel =
		showLoadTrackingHeader && !busyOnLoad && chatRoom?.roadEta?.arrivalLabel
			? `ETA ${chatRoom.roadEta.arrivalLabel} · ${roadEtaHeaderKindLabel(chatRoom.roadEta.kind)}`
			: "";

	const pushModalDriver = useMemo((): CheckListDriver | null => {
		if (!chatRoom || chatRoom.type !== "LOAD") return null;
		const driverParticipant = chatRoom.participants.find(
			(participant) => participant.user.role === "DRIVER"
		);
		if (!driverParticipant) return null;
		const user = driverParticipant.user;
		const id = user.id?.trim();
		if (!id) return null;
		return {
			id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: "",
			externalId: user.externalId?.trim() || null,
			phone: user.phone?.trim() || "",
			driverStatus: null,
			lastActiveApp: null,
			lastLocationUpdateAt: chatRoom.lastLocationUpdateAt ?? null,
			trackingLoadId: chatRoom.loadId?.trim() || null,
		};
	}, [chatRoom]);

	const canSetRest =
		showLoadTrackingHeader && Boolean(chatRoom?.loadId?.trim());
	const canShowStalePushButton =
		Boolean(pushModalDriver) && canSendCheckListMessages(currentUser?.role);

	const canSeeLoadHeaderAlerts = canSeeLoadStaleLocationSystemMessage(
		currentUser?.role,
	);
	const staleLocationNowMs = useStaleLocationClock();
	const staleLocationAlertText = canSeeLoadHeaderAlerts
		? resolveLoadChatStaleLocationAlert(
				{
					type: chatRoom?.type,
					loadStatus: chatRoom?.loadStatus,
					isRest: chatRoom?.isRest,
					lastLocationUpdateAt: chatRoom?.lastLocationUpdateAt,
				},
				staleLocationNowMs
			)
		: null;
	const showStaleLocationAlert = Boolean(staleLocationAlertText);
	const isLoadChatArchived = Boolean(
		chatRoom?.isLoadArchived || chatRoom?.isArchived,
	);
	const isLoadDelivered =
		normalizeLoadChatStatus(chatRoom?.loadStatus) === "delivered";
	const showCopyLocationUpdateButton =
		chatRoom?.type === "LOAD" &&
		canSeeLoadHeaderAlerts &&
		!showStaleLocationAlert &&
		!isLoadChatArchived &&
		!isLoadDelivered;

	useEffect(() => {
		setLocationUpdateCopied(false);
	}, [chatRoom?.id]);

	const handleCopyLocationUpdate = async () => {
		const location = formatCurrentLocationForUpdate(chatRoom?.lastLocationLabel);
		const miles = busyOnLoad
			? null
			: formatMilesLeftForLocationUpdate(chatRoom?.roadEta?.remainingMiles);
		const text = buildLoadLocationUpdateMessage(location, miles);

		try {
			await navigator.clipboard.writeText(text);
			setLocationUpdateCopied(true);
			showLocationUpdateCopiedToast();
		} catch {
			setLocationUpdateCopied(false);
		}
	};

	function toggleDropdown() {
		setIsOpen(!isOpen);
	}

	function closeDropdown() {
		setIsOpen(false);
	}

	const handleDeleteClick = () => {
		setChatAction("delete");
		setIsDeleteModalOpen(true);
		closeDropdown();
	};

	const handleLeaveClick = () => {
		setChatAction("leave");
		setIsDeleteModalOpen(true);
		closeDropdown();
	};

	const canLeaveThisLoadChat =
		chatRoom?.type === "LOAD" &&
		canLeaveLoadChat(currentUser?.role) &&
		Boolean(currentUser?.id) &&
		chatRoom.participants.some(
			(participant) => (participant.user?.id || participant.userId) === currentUser?.id,
		);

	const handleFilesClick = () => {
		setIsFilesModalOpen(true);
		closeDropdown();
	};

	const getChatDisplayName = (): string => {
		if (!chatRoom) return "Select a chat";

		if (chatRoom.type === "OFFER" && chatRoom.participants.length === 2) {
			return getOfferChatStaffHeaderTitle(chatRoom, currentUser?.id);
		}

		// For direct chats, ALWAYS show the other participant's name (ignore chatRoom.name)
		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(p => p.user.id !== currentUser?.id);
			if (otherParticipant) {
				return formatChatPeerDisplayName(otherParticipant.user);
			}
		}

		// For group chats, use chatRoom.name if available, otherwise show participant names
		if (chatRoom.name) {
			return chatRoom.name;
		}

		if (isMultiUserChatType(chatRoom.type)) {
			const participantNames = chatRoom.participants
				.slice(0, 2)
				.map(p => p.user.firstName)
				.join(", ");
			return participantNames + (chatRoom.participants.length > 2 ? "..." : "");
		}

		return "Unknown Chat";
	};

	const getChatUserData = (): {
		firstName: string;
		lastName: string;
		avatar?: string;
		role?: string;
		userColor?: string | null;
	} => {
		if (!chatRoom) return { firstName: "Unknown", lastName: "User" };

		if ((chatRoom.type === "DIRECT" || chatRoom.type === "OFFER") && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(p => p.user.id !== currentUser?.id);
			if (otherParticipant) {
				return {
					firstName: otherParticipant.user.firstName,
					lastName: otherParticipant.user.lastName,
					avatar: otherParticipant.user.avatar,
					role: otherParticipant.user.role,
					userColor: otherParticipant.user.userColor ?? null,
				};
			}
		}

		// For group chats, use first participant or default
		if (chatRoom.participants.length > 0) {
			const firstParticipant = chatRoom.participants[0];
			return {
				firstName: firstParticipant.user.firstName,
				lastName: firstParticipant.user.lastName,
				avatar: firstParticipant.user.avatar,
				role: firstParticipant.user.role,
				userColor: firstParticipant.user.userColor ?? null,
			};
		}

		return { firstName: "Group", lastName: "Chat" };
	};

	return (
		<>
			<div className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
			<div className="flex items-center justify-between px-5 py-4 xl:px-6">
				<div className="flex items-start gap-3 min-w-0">
					<div className="relative flex w-12 shrink-0 flex-col items-center">
						<div className="relative h-12 w-12">
						{(() => {
							if (!chatRoom) {
								return renderAvatar(null, "w-12 h-12");
							}

							if (chatRoom.type === "DIRECT" || chatRoom.type === "OFFER") {
								const otherParticipant = getOtherChatParticipant(
									chatRoom,
									currentUser?.id
								);
								if (otherParticipant) {
									return renderAvatar(
										participantUserToAvatarData(otherParticipant.user),
										CHAT_HEADER_AVATAR_CLASS
									);
								}
							}

							if (chatRoom.type === "LOAD") {
								return renderLoadChatAvatar(chatRoom, "w-12 h-12");
							}

							if (chatRoom.type === "BID") {
								const creator =
									chatRoom.participants.find(
										p => p.user.id === chatRoom.adminId || p.userId === chatRoom.adminId,
									) ?? null;
								if (creator) {
									return renderAvatar(
										participantUserToAvatarData(creator.user),
										CHAT_HEADER_AVATAR_CLASS,
									);
								}
							}

							if (isMultiUserChatType(chatRoom.type) && chatRoom.avatar) {
								return (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={chatRoom.avatar}
										alt="avatar"
										className="w-12 h-12 rounded-full object-cover"
									/>
								);
							}

							if (isMultiUserChatType(chatRoom.type)) {
								const name = getChatDisplayName();
								const parts = name.trim().split(/\s+/).filter(Boolean);
								const initials =
									(parts[0]?.[0] || "").toUpperCase() +
									(parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
								return (
									<div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-800 dark:text-gray-100">
										{initials}
									</div>
								);
							}

							return renderAvatar(null, CHAT_HEADER_AVATAR_CLASS);
						})()}
						{chatRoom &&
							chatRoom.type !== "LOAD" &&
							(() => {
								let showOnlineIndicator = false;

								if (
									(chatRoom.type === "DIRECT" || chatRoom.type === "OFFER") &&
									chatRoom.participants.length === 2
								) {
									// For direct and offer chats, show if the other participant is online
									const otherParticipant = chatRoom.participants.find(
										p => p.user.id !== currentUser?.id
									);
									showOnlineIndicator =
										otherParticipant && isUserOnline
											? isUserOnline(otherParticipant.user.id)
											: false;
								}

								return showOnlineIndicator ? (
									<span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
								) : null;
							})()}
						</div>
						{chatRoom?.type === "LOAD" ? (
							<LoadChatRestStatusIcon
								isRest={Boolean(chatRoom.isRest)}
								restDate={chatRoom.restDate}
								restStartedAt={chatRoom.restStartedAt}
								onClick={canSetRest ? () => setIsRestModalOpen(true) : undefined}
							/>
						) : null}
					</div>

					<div className="min-w-0">
					<button
						onClick={() => setIsParticipantsModalOpen(true)}
						className={`text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer z-10 relative text-left ${
							chatRoom?.type === "OFFER" ? "whitespace-pre-line" : ""
						}`}
						type="button"
					>
						{getChatDisplayName()}
					</button>
					{busyOnLoad || roadEtaLabel || lastLocationLabel || showCopyLocationUpdateButton ? (
						<div className="mt-1 space-y-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">
							{busyOnLoad ? (
								<BusyOnOtherLoadMessage
									busy={busyOnLoad}
									className="font-medium text-brand-600 dark:text-brand-400"
								/>
							) : null}
							{roadEtaLabel || showCopyLocationUpdateButton ? (
								<div className="flex max-w-full flex-wrap items-center gap-2">
									{!busyOnLoad && roadEtaLabel ? (
										<p className="font-medium text-brand-600 dark:text-brand-400">
											{roadEtaLabel}
										</p>
									) : null}
									{showCopyLocationUpdateButton ? (
										<button
											type="button"
											onClick={() => {
												handleCopyLocationUpdate().catch(() => undefined);
											}}
											className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-white/5"
											aria-label="Copy Location Update"
											title="Copy Location Update"
										>
											{locationUpdateCopied ? (
												<CopyLocationUpdateIcon className="h-4 w-4 shrink-0" />
											) : null}
											<span>Copy Location Update</span>
										</button>
									) : null}
								</div>
							) : null}
							{lastLocationLabel ? (
								<p className="[overflow-wrap:anywhere]">{lastLocationLabel}</p>
							) : null}
						</div>
					) : null}
					{showStaleLocationAlert ? (
						<div className="mt-1 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded bg-red-500 px-2 py-1.5 text-xs font-medium leading-snug text-white">
							<span className="min-w-0 [overflow-wrap:anywhere]">
								{staleLocationAlertText}
							</span>
							{canShowStalePushButton ? (
								<button
									type="button"
									onClick={() => setIsPushModalOpen(true)}
									className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
									aria-label="Send push to driver"
									title="Send push"
								>
									<MobileMessageNotificationIcon className="h-5 w-auto" />
								</button>
							) : null}
						</div>
					) : null}
					</div>
				</div>

				<div className="flex items-center gap-3">
					{chatRoom?.type === "LOAD" && chatRoom.loadId?.trim() ? (
						<Link
							href={`/tracking/load/${encodeURIComponent(chatRoom.loadId.trim())}`}
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400"
							aria-label="Track load on map"
							title="Track load"
						>
							<LoadTrackingChatIcon className="h-[22px] w-[22px]" />
						</Link>
					) : null}
					{chatRoom?.type !== "BID" ? (
						<div className="relative -mb-1.5">
							<button
								ref={dropdownAnchorRef}
								onClick={toggleDropdown}
								className="dropdown-toggle"
							>
								<MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
							</button>
							<Dropdown
								isOpen={isOpen}
								onClose={closeDropdown}
								className="w-40 p-2"
								anchorRef={dropdownAnchorRef}
								anchorAlign="right"
							>
								{chatRoom?.adminId === currentUser?.id &&
									isMultiUserChatType(chatRoom?.type) && (
										<DropdownItem
											onItemClick={() => {
												closeDropdown();
												setIsParticipantsModalOpen(true);
											}}
											className="flex w-full items-center gap-2 font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
										>
											<EditIcon className="w-4 h-4" />
											Edit
										</DropdownItem>
									)}
								<DropdownItem
									onItemClick={handleFilesClick}
									className="flex w-full items-center gap-2 font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
								>
									<AttachmentIcon className="w-4 h-4" />
									Files
								</DropdownItem>
								{chatRoom?.type === "LOAD" &&
								chatRoom.loadId?.trim() &&
								currentUser?.role?.trim().toUpperCase() !== "DRIVER" ? (
									<a
										href={`https://www.endurance-tms.com/add-load/?post_id=${encodeURIComponent(
											chatRoom.loadId.trim()
										)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left text-sm font-normal text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
										onClick={closeDropdown}
									>
										<ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
										show in TMS
									</a>
								) : null}
								{canLeaveThisLoadChat ? (
									<DropdownItem
										onItemClick={handleLeaveClick}
										className="flex w-full items-center gap-2 font-normal text-left rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
									>
										<LogOut className="h-4 w-4" />
										Leave chat
									</DropdownItem>
								) : null}
								{/* Show delete/leave button only if user is allowed to */}
								{(() => {
									// For LOAD chats: only administrators can delete
									if (chatRoom?.type === "LOAD") {
										if (currentUser?.role !== "ADMINISTRATOR") {
											return null; // Hide the button
										}
									}

									// For the rest of chat types show the action
									return (
										<DropdownItem
											onItemClick={handleDeleteClick}
											className="flex w-full items-center gap-2 font-normal text-left rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
										>
											<TrashDeleteIcon className="w-4 h-4" />
											{isMultiUserChatType(chatRoom?.type) &&
											chatRoom?.adminId !== currentUser?.id
												? "Leave"
												: "Delete"}
										</DropdownItem>
									);
								})()}
							</Dropdown>
						</div>
					) : null}
				</div>
			</div>
			</div>

			{/* Participants Modal */}
			<ChatParticipantsModal
				isOpen={isParticipantsModalOpen}
				onClose={() => setIsParticipantsModalOpen(false)}
				chatRoom={chatRoom || null}
				isUserOnline={isUserOnline}
			/>
			<DeleteChatConfirmModal
				isOpen={isDeleteModalOpen}
				onClose={() => setIsDeleteModalOpen(false)}
				chatRoom={chatRoom}
				mode={chatAction}
				onDeleteSuccess={() => {
					// Handle successful deletion if needed
					// The WebSocket event will handle the actual removal from state
				}}
			/>

			{chatRoom && (
				<FilesModal
					isOpen={isFilesModalOpen}
					onClose={() => setIsFilesModalOpen(false)}
					chatRoom={chatRoom}
				/>
			)}
			<CheckListPushModal
				isOpen={isPushModalOpen}
				onClose={() => setIsPushModalOpen(false)}
				drivers={isPushModalOpen && pushModalDriver ? [pushModalDriver] : null}
			/>
			<SetLoadRestModal
				isOpen={isRestModalOpen}
				onClose={() => setIsRestModalOpen(false)}
				loadId={chatRoom?.loadId}
				isRest={Boolean(chatRoom?.isRest)}
				restDate={chatRoom?.restDate}
				onSaved={update => {
					if (chatRoom?.id) {
						updateChatRoom(chatRoom.id, {
							isRest: update.isRest,
							restDate: update.restDate ?? null,
							restStartedAt: update.restStartedAt ?? null,
						});
					}
				}}
			/>
		</>
	);
}
