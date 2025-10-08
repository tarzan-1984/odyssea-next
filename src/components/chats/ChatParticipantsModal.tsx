"use client";
import React, { useState, useEffect, useRef } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { ChatRoom, chatApi } from "@/app-api/chatApi";
import { UserListItem } from "@/app-api/api-types";
import { useCurrentUser } from "@/stores/userStore";
import { renderAvatar } from "@/helpers";
import usersApi from "@/app-api/users";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useWebSocketChatRooms } from "@/hooks/useWebSocketChatRooms";
import { useWebSocket } from "@/context/WebSocketContext";
import { S3Uploader } from "@/app-api/S3Uploader";
import { useChatStore } from "@/stores/chatStore";
import Image from "next/image";

interface ChatParticipantsModalProps {
	isOpen: boolean;
	onClose: () => void;
	chatRoom: ChatRoom | null;
	onAddParticipant?: () => void;
}

export default function ChatParticipantsModal({
	isOpen,
	onClose,
	chatRoom,
	onAddParticipant,
}: ChatParticipantsModalProps) {
	const [users, setUsers] = useState<UserListItem[]>([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showAddSection, setShowAddSection] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [hasMoreUsers, setHasMoreUsers] = useState(true);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [addingUserIds, setAddingUserIds] = useState<string[]>([]); // Track users being added to prevent double clicks
	const [localParticipants, setLocalParticipants] = useState(chatRoom?.participants ?? []);
	const [addedUserIds, setAddedUserIds] = useState<string[]>([]);
	const [removedUserIds, setRemovedUserIds] = useState<string[]>([]);
	const currentUser = useCurrentUser();
	const { isUserOnline } = useWebSocketChatSync();
	const { addParticipants, removeParticipant, updateChatRoom } = useWebSocketChatRooms({});
	const { socket, isConnected } = useWebSocket();
	const updateChatRoomInStore = useChatStore(state => state.updateChatRoom);

	// Check if current user is admin of this chat
	const isCurrentUserAdmin = chatRoom?.adminId === currentUser?.id;
	const isGroupChat = chatRoom?.type === "GROUP";

	const addSectionRef = useRef<HTMLDivElement | null>(null);
	const addSearchInputRef = useRef<HTMLInputElement | null>(null);

	const focusAddParticipants = () => {
		setShowAddSection(true);
		if (addSectionRef.current) {
			addSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		setTimeout(() => addSearchInputRef.current?.focus(), 250);
	};

	// Keep localParticipants in sync with store when room updates while modal is open
	useEffect(() => {
		if (!isOpen) return;
		setLocalParticipants(chatRoom?.participants ?? []);
		setAddedUserIds([]);
		setRemovedUserIds([]);
		setAddingUserIds([]);
	}, [isOpen, chatRoom?.participants]);

	// Cleanup avatar preview URL
	useEffect(() => {
		return () => {
			if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		};
	}, [avatarPreview]);

	const fetchUsers = async (page: number = 1, append: boolean = false, search: string = "") => {
		if (append) {
			setIsLoadingMore(true);
		} else {
			setIsLoadingUsers(true);
		}

		try {
			const params: Record<string, any> = { page, limit: 20 };
			if (search) params.search = search;
			const response = await usersApi.getAllUsers(params);
			if (response.success && response.data) {
				// Exclude current user and CURRENT local participants (reflect in-modal changes)
				const existingParticipantIds = (localParticipants || []).map(p => p.userId);
				const allUsers = response.data.data?.users || [];
				const newUsers: UserListItem[] = allUsers.filter(
					(u: UserListItem) => u.id !== currentUser?.id && !existingParticipantIds.includes(u.id)
				);

				setUsers(prev => (append ? [...prev, ...newUsers] : newUsers));

				// Use pagination info from API response
				const pagination = response.data.data?.pagination;
				if (pagination) {
					setHasMoreUsers(pagination.has_next_page || false);
					setCurrentPage(pagination.current_page || page);
				} else {
					// Fallback if pagination block absent
					const totalCount = (response.data.data as any)?.total_count ?? 0;
					const totalPages = Math.ceil(Number(totalCount) / 20);
					setHasMoreUsers(page < totalPages);
					setCurrentPage(page);
				}
			}
		} catch (error) {
			console.error("Error fetching users:", error);
		} finally {
			setIsLoadingUsers(false);
			setIsLoadingMore(false);
		}
	};

	const loadMoreUsers = () => {
		if (!isLoadingMore && hasMoreUsers) {
			const nextPage = currentPage + 1;
			setCurrentPage(nextPage);
			void fetchUsers(nextPage, true, searchQuery);
		}
	};

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		if (scrollHeight - scrollTop <= clientHeight + 100) {
			loadMoreUsers();
		}
	};

	const handleAddParticipant = (userId: string) => {
		if (!chatRoom) return;

		// Prevent double clicks
		if (addingUserIds.includes(userId)) {
			return;
		}

		// find user in current fetched users to build UI entry
		const user = users.find(u => u.id === userId);
		if (!user) return;
		// prevent duplicates
		if (localParticipants.some(p => p.userId === userId)) {
			return;
		}

		// Mark user as being added to prevent double clicks
		setAddingUserIds(prev => [...prev, userId]);
	const tempParticipant = {
		id: `temp-${userId}`,
		chatRoomId: chatRoom.id,
		userId,
		joinedAt: new Date().toISOString(),
		user: {
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			avatar: user.avatar || "",
			role: user.role || "USER",
		},
	};
	setLocalParticipants(prev => [...prev, tempParticipant as any]);
	setAddedUserIds(prev => {
		if (prev.includes(userId)) {
			return prev;
		}
		return [...prev, userId];
	});
	// if this user was scheduled for removal, cancel that
	setRemovedUserIds(prev => prev.filter(id => id === userId ? false : true));
	// remove from add-list immediately
	setUsers(prev => prev.filter(u => u.id !== userId));

	// Clear from addingUserIds after a short delay to allow UI to update
	setTimeout(() => {
		setAddingUserIds(prev => prev.filter(id => id !== userId));
	}, 100);
};

	const handleRemoveParticipant = (userId: string) => {
		// admin can remove any non-admin; UI already restricts rendering of the button
		// userId is user.id from users table, so compare with p.user?.id
		setLocalParticipants(prev => prev.filter(p => (p.user?.id || p.userId) !== userId));
		if (addedUserIds.includes(userId)) {
			// was newly added in this session; just undo the add
			setAddedUserIds(prev => prev.filter(id => id !== userId));
		} else {
			setRemovedUserIds(prev => (prev.includes(userId) ? prev : [...prev, userId]));
		}
		// refresh current user list so the removed user becomes eligible to appear
		void fetchUsers(1, false, searchQuery);
	};

	// Debounced search
	useEffect(() => {
		if (!isOpen) return;
		const t = setTimeout(() => {
			setCurrentPage(1);
			setHasMoreUsers(true);
			void fetchUsers(1, false, searchQuery);
		}, 300);
		return () => clearTimeout(t);
	}, [searchQuery, isOpen]);

	const handleSave = async () => {
		if (!chatRoom) return;

		// Check WebSocket connection
		if (!socket || !isConnected) {
			console.error("WebSocket not connected, cannot save changes");
			return;
		}

		// Prevent double submission
		if (isSaving) return;
		setIsSaving(true);

		try {

			// 1) Avatar upload if changed
			let newAvatarPath: string | undefined;
			if (avatarFile) {
				setIsUploadingAvatar(true);
				const uploader = new S3Uploader();
				const ts = Math.floor(Date.now() / 1000);
				const ext = avatarFile.name.split('.').pop() || 'jpg';
				const tempName = `avatar-chat_${chatRoom.id}_${ts}.${ext}`;
				const { fileUrl } = await uploader.upload(new File([avatarFile], tempName, { type: avatarFile.type }));
				newAvatarPath = fileUrl;
				setIsUploadingAvatar(false);
				console.log("Avatar uploaded:", newAvatarPath);
			}

			// 2) Persist avatar update
			if (newAvatarPath) {
				updateChatRoom({ chatRoomId: chatRoom.id, updates: { avatar: newAvatarPath } });
			}

			// 3) Persist participants add/remove
			if (addedUserIds.length > 0) {
				const uniqueIds = Array.from(new Set(addedUserIds));
				addParticipants({ chatRoomId: chatRoom.id, participantIds: uniqueIds });
			}

			if (removedUserIds.length > 0) {
				for (const removedId of removedUserIds) {
					removeParticipant({ chatRoomId: chatRoom.id, participantId: removedId });
				}
			}

			if (newAvatarPath) {
				updateChatRoomInStore(chatRoom.id, { avatar: newAvatarPath });
			}

			// Close modal
			onClose();
		} catch (e) {
			console.error("Failed to save chat participant changes:", e);
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarPick: React.ChangeEventHandler<HTMLInputElement> = e => {
		const f = e.target.files?.[0];
		setAvatarFile(f || null);
		if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		setAvatarPreview(f ? URL.createObjectURL(f) : null);
	};

	const filteredUsers = users.filter(user =>
		`${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="max-w-[500px] w-full mx-auto p-4 sm:p-6"
		>
			<div className="pb-4 pt-16">
				{/* Chat Avatar Section - Only for group chats and admins */}
				{isGroupChat && isCurrentUserAdmin && (
					<div className="mb-6">
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
							Chat Avatar
						</label>
						<div className="flex items-center gap-4">
							<div className="relative group">
								{avatarPreview ? (
									<Image
										src={avatarPreview}
										alt="Chat avatar preview"
										width={64}
										height={64}
										className="w-16 h-16 rounded-full object-cover"
									/>
								) : chatRoom?.avatar ? (
									<Image
										src={chatRoom.avatar}
										alt="Current chat avatar"
										width={64}
										height={64}
										className="w-16 h-16 rounded-full object-cover"
									/>
								) : (
									<div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-lg font-semibold text-gray-800 dark:text-gray-100">
										{(() => {
											const name = chatRoom?.name || "Group";
											const parts = name.trim().split(/\s+/).filter(Boolean);
											const initials = (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || (parts[0]?.[1] || "")).toUpperCase();
											return initials;
										})()}
									</div>
								)}
								{/* Overlay with camera icon on hover */}
								<div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
									<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<input
									id="chatAvatar"
									type="file"
									accept="image/*"
									onChange={handleAvatarPick}
									className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								/>
							</div>
							<div className="flex-1">
								<p className="text-sm text-gray-500 dark:text-gray-400">
									Click on the avatar to change it. Supported formats: JPG, PNG, GIF
								</p>
								{avatarFile && (
									<p className="text-xs text-green-600 dark:text-green-400 mt-1">
										New avatar selected: {avatarFile.name}
									</p>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Second row: title left, add icon right (admin only) */}
				<div className="flex mb-4 items-center justify-between gap-4">
					<h4 className="text-lg font-medium text-gray-800 dark:text-white/90">
						Participants ({chatRoom?.participants.length || 0})
					</h4>
					{isGroupChat && isCurrentUserAdmin && (
						<button
							onClick={focusAddParticipants}
							className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
							title="Add participants"
							type="button"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3,21.016l.78984-2.87249C5.0964,13.3918,8.5482,10.984,12,10.984"/>
								<circle strokeLinejoin="bevel" cx="12" cy="5.98404" r="5"/>
								<circle strokeLinecap="round" strokeLinejoin="round" cx="17" cy="18" r="5"/>
								<line strokeLinecap="round" strokeLinejoin="round" x1="15" x2="19" y1="18" y2="18"/>
								<line strokeLinecap="round" strokeLinejoin="round" x1="17" x2="17" y1="16" y2="20"/>
							</svg>
						</button>
					)}
				</div>

				{/* Participants List */}
				<div className="max-h-[400px] overflow-y-auto space-y-2">
					{/* Existing Participants (local state) */}
					{localParticipants.map(participant => {
						const isAdmin = participant.userId === chatRoom?.adminId;
						const isOnline = isUserOnline && isUserOnline(participant.userId);
						const safeUser = {
							firstName: participant.user?.firstName || "",
							lastName: participant.user?.lastName || "",
							avatar: participant.user?.avatar || (participant.user as any)?.profilePhoto || "",
							role: participant.user?.role || "USER",
						};

						return (
							<div
								key={participant.id}
								className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
							>
								<div className="relative flex-shrink-0">
								{renderAvatar(safeUser as any, "w-10 h-10")}
									{isOnline && (
										<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900"></span>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
									{safeUser.firstName} {safeUser.lastName}
										</h5>
										{isAdmin && (
											<span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
												Admin
											</span>
										)}
									</div>
									<p className="text-xs text-gray-500 dark:text-gray-400">
									{safeUser.role.toLowerCase().replace('_', ' ')}
									</p>
								</div>
								{isGroupChat && isCurrentUserAdmin && !isAdmin && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											// Backend expects user.id from users table, not participant.userId
											const userIdToRemove = participant.user?.id || participant.userId;
											console.log("Removing participant:", { userId: userIdToRemove, participant });
											if (userIdToRemove) {
												handleRemoveParticipant(userIdToRemove);
											}
										}}
										className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
										title="Remove participant"
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
											<path d="m9 12a6 6 0 1 0 -6-6 6.006 6.006 0 0 0 6 6zm0-10a4 4 0 1 1 -4 4 4 4 0 0 1 4-4zm9 21a1 1 0 0 1 -2 0 7 7 0 0 0 -14 0 1 1 0 0 1 -2 0 9 9 0 0 1 18 0zm5.707-8.707a1 1 0 1 1 -1.414 1.414l-1.793-1.793-1.793 1.793a1 1 0 0 1 -1.414-1.414l1.793-1.793-1.793-1.793a1 1 0 0 1 1.414-1.414l1.793 1.793 1.793-1.793a1 1 0 0 1 1.414 1.414l-1.793 1.793z"/>
										</svg>
									</button>
								)}
							</div>
						);
					})}

					{/* Add Participant Section - Only for group chats and admins */}
					{isGroupChat && isCurrentUserAdmin && showAddSection && (
						<>
							<div ref={addSectionRef} className="border-t border-gray-200 dark:border-gray-700 pt-4">
								<div className="flex items-center justify-between mb-3">
									<h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">
										Add Participants
									</h6>
									<button
										onClick={() => setShowAddSection(false)}
										className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
									>
										Cancel
									</button>
								</div>

								{/* Search */}
								<div className="relative mb-4">
									<input
										ref={addSearchInputRef}
										type="text"
										placeholder="Search users to add..."
										value={searchQuery}
										onChange={e => setSearchQuery(e.target.value)}
										className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
									/>
									<svg
										className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
									</svg>
								</div>

								{isLoadingUsers ? (
									<div className="text-center py-4 text-gray-500 dark:text-gray-400">
										Loading users...
									</div>
								) : filteredUsers.length === 0 ? (
									<div className="text-center py-4 text-gray-500 dark:text-gray-400">
										No users available to add
									</div>
								) : (
									<div className="max-h-[200px] overflow-y-auto space-y-2" onScroll={handleScroll}>
										{filteredUsers.map(user => {
											const isBeingAdded = addingUserIds.includes(user.id);
											return (
												<div
													key={user.id}
													className={`flex items-center gap-3 p-3 rounded-lg ${
														isBeingAdded
															? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
															: 'hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer'
													}`}
													onClick={() => !isBeingAdded && handleAddParticipant(user.id)}
												>
												<div className="relative flex-shrink-0">
													{renderAvatar(user, "w-10 h-10")}
													{isUserOnline && isUserOnline(user.id) && (
														<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900"></span>
													)}
												</div>
												<div className="flex-1 min-w-0">
													<h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
														{user.firstName} {user.lastName}
													</h5>
													<p className="text-xs text-gray-500 dark:text-gray-400">
														{user.role?.toLowerCase().replace('_', ' ')}
													</p>
												</div>
											</div>
										);
										})}

										{/* Loading indicator for infinite scroll */}
										{isLoadingMore && (
											<div className="flex justify-center py-2">
												<div className="text-sm text-gray-500 dark:text-gray-400">Loading more users...</div>
											</div>
										)}
									</div>
								)}
							</div>
						</>
					)}
				</div>

				{/* Action Buttons */}
				<div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
					<Button size="sm" variant="outline" onClick={onClose}>
						Close
					</Button>
			{isGroupChat && isCurrentUserAdmin && (
				<Button size="sm" variant="primary" onClick={handleSave} disabled={isUploadingAvatar || isSaving}>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			)}
				</div>
			</div>
		</Modal>
	);
}
