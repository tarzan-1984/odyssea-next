"use client";
import React, { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "@/icons";
import { ChatRoom } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import ChatParticipantsModal from "./ChatParticipantsModal";

interface ChatBoxHeaderProps {
	chatRoom?: ChatRoom;
	isUserOnline?: (userId: string) => boolean;
}

export default function ChatBoxHeader({ chatRoom, isUserOnline }: ChatBoxHeaderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
	const currentUser = useCurrentUser();

	function toggleDropdown() {
		setIsOpen(!isOpen);
	}

	function closeDropdown() {
		setIsOpen(false);
	}

	const getChatDisplayName = (): string => {
		if (!chatRoom) return "Select a chat";

		// For direct chats, ALWAYS show the other participant's name (ignore chatRoom.name)
		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== currentUser?.id
			);
			if (otherParticipant) {
				return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
			}
		}

		// For group chats, use chatRoom.name if available, otherwise show participant names
		if (chatRoom.name) {
			return chatRoom.name;
		}

		if (chatRoom.type === "GROUP") {
			const participantNames = chatRoom.participants
				.slice(0, 2)
				.map(p => p.user.firstName)
				.join(", ");
			return participantNames + (chatRoom.participants.length > 2 ? "..." : "");
		}

		return "Unknown Chat";
	};

	const getChatAvatar = (): string => {
		if (!chatRoom) return "/images/avatars/avatar-default.jpg";

		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== currentUser?.id
			);
			if (otherParticipant?.user.avatar) {
				return otherParticipant.user.avatar;
			}
		}

		// For GROUP chats, prefer chat avatar when present
		if (chatRoom.type === "GROUP" && chatRoom.avatar) {
			return chatRoom.avatar;
		}

		// Default avatar for group chats or when no profile photo
		return "/images/avatars/avatar-default.jpg";
	};

	const getChatUserData = (): { firstName: string; lastName: string; avatar?: string } => {
		if (!chatRoom) return { firstName: "Unknown", lastName: "User" };

		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== currentUser?.id
			);
			if (otherParticipant) {
				return {
					firstName: otherParticipant.user.firstName,
					lastName: otherParticipant.user.lastName,
					avatar: otherParticipant.user.avatar,
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
			};
		}

		return { firstName: "Group", lastName: "Chat" };
	};


	return (
		<>
		<div className="sticky flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 xl:px-6">
			<div className="flex items-center gap-3">
                <div className="relative h-12 w-full max-w-[48px] rounded-full">
                    {chatRoom && chatRoom.type === "GROUP" && (!chatRoom.avatar || chatRoom.avatar === "") ? (
                        <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {(() => {
                                const name = getChatDisplayName();
                                const parts = name.trim().split(/\s+/).filter(Boolean);
                                const initials = (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || (parts[0]?.[1] || "")).toUpperCase();
                                return initials;
                            })()}
                        </div>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getChatAvatar()} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
                    )}
					{chatRoom && (() => {
						let showOnlineIndicator = false;

					if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
						// For direct chats, show if the other participant is online
						const otherParticipant = chatRoom.participants.find(p => p.user.id !== currentUser?.id);
						showOnlineIndicator = otherParticipant && isUserOnline ? isUserOnline(otherParticipant.user.id) : false;
					}

						return showOnlineIndicator ? (
							<span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
						) : null;
					})()}
				</div>

				<button
					onClick={() => setIsParticipantsModalOpen(true)}
					className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer z-10 relative"
					type="button"
				>
					{getChatDisplayName()}
				</button>
			</div>

			<div className="flex items-center gap-3">
				<div className="relative -mb-1.5">
					<button onClick={toggleDropdown} className="dropdown-toggle">
						<MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
					</button>
                    <Dropdown isOpen={isOpen} onClose={closeDropdown} className="w-40 p-2">
                        {chatRoom?.adminId === currentUser?.id && chatRoom?.type === "GROUP" && (
                            <DropdownItem
                                onItemClick={() => {
                                    closeDropdown();
                                    setIsParticipantsModalOpen(true);
                                }}
                                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                            >
                                Edit
                            </DropdownItem>
                        )}
                        <DropdownItem
                            onItemClick={closeDropdown}
                            className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                        >
                            Delete
                        </DropdownItem>
					</Dropdown>
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
	</>
	);
}
