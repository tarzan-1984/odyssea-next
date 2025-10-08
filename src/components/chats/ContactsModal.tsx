"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "../ui/modal";
import Input from "../form/input/InputField";
import usersApi from "@/app-api/users";
import { UserListItem } from "@/app-api/api-types";
import { renderAvatar } from "@/helpers";
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useChatSync } from "@/hooks/useChatSync";

interface ContactsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function ContactsModal({ isOpen, onClose }: ContactsModalProps) {
	const [users, setUsers] = useState<UserListItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string>("");

	const ITEMS_PER_PAGE = 20;

	// Get current user and chat store
	const currentUser = useCurrentUser();
	const { chatRooms } = useChatStore();
	const { createChatRoom } = useChatSync();
	
	// Get online status functionality
	const { isUserOnline } = useWebSocketChatSync();

	// Create direct chat with selected contact or open existing one
	const handleCreateDirectChat = async (contact: UserListItem) => {
		if (!currentUser?.id) {
			setError("User not authenticated");
			return;
		}

		try {
			// Check if there's already a DIRECT chat with this user
			const existingChat = chatRooms.find(chat => 
				chat.type === "DIRECT" && 
				chat.participants.length === 2 &&
				chat.participants.some(p => p.user.id === contact.id) &&
				chat.participants.some(p => p.user.id === currentUser.id)
			);

			if (existingChat) {
				// Chat already exists, just close the modal
				// The user can select this chat from the chat list
				onClose();
				return;
			}

		// Ensure firstName and lastName are strings
		const firstName = contact?.firstName? String(contact.firstName || '').trim() : '';
		const lastName = contact?.lastName? String(contact.lastName || '').trim() : '';

		if (!firstName || !lastName) {
			setError("Contact name is required");
			return;
		}

		// Create direct chat using the same method as group chats
		const chatRoom = await createChatRoom({
			name: `${firstName} ${lastName}`, // Name for direct chat
			type: "DIRECT",
			loadId: "", // Empty for direct chats
			participantIds: [currentUser.id, contact.id], // Only 2 participants
		});

		if (chatRoom) {
			// Close modal - chat room is already added to store via createChatRoom
			onClose();
		} else {
			setError("Failed to create direct chat");
		}
		} catch (error) {
			console.error("Error creating direct chat:", error);
			setError("Network error occurred");
		}
	};

	// Fetch users with search and pagination
	const fetchUsers = useCallback(async (page: number = 1, search: string = "", append: boolean = false) => {
		try {
			if (append) {
				setIsLoadingMore(true);
			} else {
				setIsLoading(true);
			}
			setError("");

			const params = {
				page,
				limit: ITEMS_PER_PAGE,
				...(search && { search }),
			};

			const response = await usersApi.getAllUsers(params);

			if (response.success && response.data) {
				const newUsers = response.data.data?.users || [];
				const pagination = response.data.data?.pagination;

				// Exclude current user from the list
				const filtered = newUsers.filter((u: UserListItem) => u.id !== currentUser?.id);
				if (append) {
					setUsers(prev => [...prev, ...filtered]);
				} else {
					setUsers(filtered);
				}

				// Check if there are more pages using pagination data
				if (pagination) {
					setHasMore(pagination.has_next_page || false);
					setCurrentPage(pagination.current_page || page);
				} else {
					// Fallback to old logic if pagination is not available
					const totalPages = Math.ceil((response.data.data.pagination.total_count || 0) / ITEMS_PER_PAGE);
					setHasMore(page < totalPages);
					setCurrentPage(page);
				}
			} else {
				setError(response.error || "Failed to fetch contacts");
			}
		} catch (error) {
			console.error("Error fetching users:", error);
			setError("Network error occurred");
		} finally {
			setIsLoading(false);
			setIsLoadingMore(false);
		}
	}, []);

	// Load more users when scrolling to bottom
	const loadMoreUsers = useCallback(() => {
		if (!isLoadingMore && hasMore) {
			fetchUsers(currentPage + 1, searchQuery, true);
		}
	}, [currentPage, searchQuery, hasMore, isLoadingMore, fetchUsers]);

	// Handle scroll to load more
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		if (scrollHeight - scrollTop <= clientHeight + 100) {
			loadMoreUsers();
		}
	}, [loadMoreUsers]);

	// Search with debounce
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (isOpen) {
				setCurrentPage(1);
				setHasMore(true);
				fetchUsers(1, searchQuery, false);
			}
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [searchQuery, isOpen, fetchUsers]);

	// Initial load when modal opens
	useEffect(() => {
		if (isOpen) {
			setSearchQuery("");
			setCurrentPage(1);
			setHasMore(true);
			fetchUsers(1, "", false);
		}
	}, [isOpen, fetchUsers]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setUsers([]);
			setSearchQuery("");
			setCurrentPage(1);
			setHasMore(true);
			setError("");
		}
	}, [isOpen]);

	return (
		<Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
			<div className="p-6">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
						Contacts
					</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Search Input */}
				<div className="mb-6">
					<div className="relative">
						<Input
							type="text"
							placeholder="Search contacts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pr-10"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
						{error}
					</div>
				)}

				{/* Contacts List */}
				<div
					className="max-h-96 overflow-y-auto space-y-3"
					onScroll={handleScroll}
				>
					{isLoading ? (
						<div className="flex justify-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						</div>
					) : users.length === 0 ? (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							{searchQuery ? "No contacts found" : "No contacts available"}
						</div>
					) : (
						users.map((user) => {
							// Check if there's already a DIRECT chat with this user
							const existingChat = chatRooms.find(chat => 
								chat.type === "DIRECT" && 
								chat.participants.length === 2 &&
								chat.participants.some(p => p.user.id === user.id) &&
								chat.participants.some(p => p.user.id === currentUser?.id)
							);

							return (
								<div
									key={user.id}
									className={`flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
										existingChat ? 'bg-blue-50 dark:bg-blue-900/20' : ''
									}`}
									onClick={() => handleCreateDirectChat(user)}
								>
									{/* Avatar with online status */}
									<div className="relative flex-shrink-0">
										{renderAvatar(user, "w-[50px] h-[50px]")}
										{/* Online status indicator */}
										{isUserOnline && isUserOnline(user.id) && (
											<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
										)}
									</div>

									{/* User Info */}
									<div className="flex-1 min-w-0">
										<div className="font-medium text-gray-900 dark:text-white">
											{user.firstName} {user.lastName}
										</div>
										<div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
											{user.role?.toLowerCase().replace('_', ' ')}
											{existingChat && (
												<span className="ml-2 text-blue-600 dark:text-blue-400">
													• Already chatting
												</span>
											)}
										</div>
									</div>
								</div>
							);
						})
					)}

					{/* Loading More Indicator */}
					{isLoadingMore && (
						<div className="flex justify-center py-4">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
					<button
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
					>
						Close
					</button>
				</div>
			</div>
		</Modal>
	);
}
