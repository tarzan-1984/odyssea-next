"use client";
import React, { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import MultiSelect from "../form/MultiSelect";
import usersApi from "@/app-api/users";
import { UserListItem } from "@/app-api/api-types";
import { useChatSync } from "@/hooks/useChatSync";
import { renderAvatar } from "@/helpers";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useCurrentUser } from "@/stores/userStore";
import { S3Uploader } from "@/app-api/S3Uploader";

interface AddNewRoomModalProps {
	isOpen: boolean;
	onClose: () => void;
}

interface FormData {
    name: string;
    loadId: string;
    participantIds: string[];
}

export default function AddNewRoomModal({ isOpen, onClose }: AddNewRoomModalProps) {
    const [formData, setFormData] = useState<FormData>({
        name: "",
        loadId: "",
        participantIds: [],
    });
	const [users, setUsers] = useState<UserListItem[]>([]);
	const [selectedUsersMap, setSelectedUsersMap] = useState<Record<string, UserListItem>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string>("");
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const uploader = new S3Uploader();

	// Use our new chat sync hook
	const { createChatRoom } = useChatSync();
	const { isUserOnline } = useWebSocketChatSync();
	const currentUser = useCurrentUser();

	// Fetch users when modal opens
	useEffect(() => {
		if (isOpen) {
			setSearchQuery("");
			setUsers([]);
			setCurrentPage(1);
			setHasMore(true);
			fetchUsers(1, "", false);
		}
	}, [isOpen]);

	// Reset form when modal closes
	useEffect(() => {
		if (!isOpen) {
            setFormData({
                name: "",
                loadId: "",
                participantIds: [],
            });
			setError("");
			setUsers([]);
			setSelectedUsersMap({});
			setSearchQuery("");
			setCurrentPage(1);
			setHasMore(true);
		}
	}, [isOpen]);

	// cleanup preview URL
	useEffect(() => {
		return () => {
			if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		};
	}, [avatarPreview]);

/**
 * Fetch users with pagination and optional search
 */
const fetchUsers = async (page: number = 1, search: string = "", append: boolean = false) => {
	if (append) {
		setIsLoadingMore(true);
	} else {
		setIsLoadingUsers(true);
	}
	setError("");

	try {
		const params: Record<string, any> = { page, limit: 20 };
		if (search) params.search = search;

		const response = await usersApi.getAllUsers(params);
		if (response.success && response.data) {
			// Exclude current user
			const newUsers: UserListItem[] = (response.data.data?.users || []).filter((u: UserListItem) => u.id !== currentUser?.id);
			const pagination = response.data.data?.pagination;
			setUsers(prev => (append ? [...prev, ...newUsers] : newUsers));

			if (pagination) {
				setHasMore(pagination.has_next_page || false);
				setCurrentPage(pagination.current_page || page);
			} else {
				const totalCount = response.data.data?.pagination?.total_count || 0;
				const totalPages = Math.ceil(totalCount / 20);
				setHasMore(page < totalPages);
				setCurrentPage(page);
			}
		} else {
			setError(response.error || "Failed to load users");
		}
	} catch (error) {
		console.error("Error fetching users:", error);
		setError("Failed to load users");
	} finally {
		setIsLoadingUsers(false);
		setIsLoadingMore(false);
	}
};

// Debounced search
useEffect(() => {
	if (!isOpen) return;
	const t = setTimeout(() => {
		setCurrentPage(1);
		setHasMore(true);
		fetchUsers(1, searchQuery, false);
	}, 300);
	return () => clearTimeout(t);
}, [searchQuery, isOpen]);

// Infinite scroll helpers
const loadMoreUsers = () => {
	if (!isLoadingMore && hasMore) {
		fetchUsers(currentPage + 1, searchQuery, true);
	}
};

const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
	const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
	if (scrollHeight - scrollTop <= clientHeight + 100) {
		loadMoreUsers();
	}
};

	/**
	 * Handles form input changes
	 */
	const handleInputChange = (field: keyof FormData, value: string | string[]) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
		setError(""); // Clear error when user starts typing
	};

	/**
	 * Handles form submission
	 */
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		console.log("Form submission started:", {
			name: formData.name,
			participantIds: formData.participantIds,
			participantCount: formData.participantIds.length
		});

		// Validate form data
		if (!formData.name.trim()) {
			setError("Room name is required");
			setIsLoading(false);
			return;
		}

		// Load ID is optional for general chats
		// if (!formData.loadId.trim()) {
		// 	setError("Load ID is required");
		// 	setIsLoading(false);
		// 	return;
		// }

		if (formData.participantIds.length === 0) {
			setError("At least one participant is required");
			setIsLoading(false);
			return;
		}

		console.log("Validation passed, creating chat room...");

		try {
           // 1) optionally upload avatar and get path
           let avatarPath: string | undefined;
           if (avatarFile) {
               setIsUploadingAvatar(true);
               const ts = Math.floor(Date.now() / 1000);
               const ext = avatarFile.name.split('.').pop() || 'jpg';
               const tempName = `avatar-chat_temp_${ts}.${ext}`;
               const { fileUrl } = await uploader.upload(new File([avatarFile], tempName, { type: avatarFile.type }));
               avatarPath = fileUrl;
               setIsUploadingAvatar(false);
           }

           await createChatRoom({
				name: formData.name.trim(),
				type: "GROUP", // Group chat for multiple participants
				// loadId: formData.loadId.trim(), // Commented out since field is hidden
               participantIds: formData.participantIds,
               avatar: avatarPath,
			});

			console.log("Chat room created successfully");
			// Success - close modal and reset form
			onClose();
			// The chat room will be automatically added to Zustand and IndexedDB
			// via the createChatRoom function in useChatSync
		} catch (error) {
			console.error("Error creating chat room:", error);
			setError("Failed to create chat room");
		} finally {
			setIsLoading(false);
		}
	};

	// Convert users to MultiSelect options format
	const userOptions = users.map(user => ({
		value: user.id,
		text: user.firstName || user.email,
		selected: formData.participantIds.includes(user.id),
	}));

	const handleAvatarPick: React.ChangeEventHandler<HTMLInputElement> = e => {
		const f = e.target.files?.[0] || null;
		setAvatarFile(f);
		if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		setAvatarPreview(f ? URL.createObjectURL(f) : null);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="max-w-[584px] w-full mx-auto p-4 sm:p-6 lg:p-10"
		>
			<form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto">
				<div className="flex items-center justify-between mb-6">
					<h4 className="text-lg font-medium text-gray-800 dark:text-white/90">
						Create Group Chat
					</h4>
				</div>

				{/* Error message */}
				{error && (
					<div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
						{error}
					</div>
				)}

				<div className="space-y-6">
					{/* Room Name Field */}
					<div>
						<Label htmlFor="roomName">Room Name *</Label>
						<Input
							id="roomName"
							type="text"
							placeholder="Enter group name (e.g., Project Team, Marketing Group)"
							defaultValue={formData.name}
							onChange={e => handleInputChange("name", e.target.value)}
						/>
					</div>

					{/* Optional Avatar Upload */}
					<div>
						<Label htmlFor="roomAvatar">Avatar (optional)</Label>
						<div className="flex items-center gap-3">
							{avatarPreview ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={avatarPreview} alt="preview" className="w-12 h-12 rounded-full object-cover" />
							) : (
								<div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />)
							}
							<input id="roomAvatar" type="file" accept="image/*" onChange={handleAvatarPick} />
						</div>
					</div>

					{/* Load ID Field - Hidden for now */}
					{/* <div>
						<Label htmlFor="loadId">Load ID (Optional)</Label>
						<Input
							id="loadId"
							type="text"
							placeholder="Enter load ID for load-related chats (e.g., load_123)"
							defaultValue={formData.loadId}
							onChange={e => handleInputChange("loadId", e.target.value)}
						/>
					</div> */}

					{/* Participants selector - contacts-style with search and online indicators */}
					<div className="space-y-3">
						<Label>Participants *</Label>
						{/* Selected chips */}
					{formData.participantIds.length > 0 && (
							<div className="flex flex-wrap gap-2">
							{formData.participantIds.map(pid => {
								const u = selectedUsersMap[pid] ?? users.find(x => x.id === pid);
									if (!u) return null;
									return (
										<div key={pid} className="flex items-center gap-2 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
											{renderAvatar(u, "w-6 h-6")}
											<span className="text-xs text-gray-700 dark:text-gray-300">{u.firstName} {u.lastName}</span>
											<button
												type="button"
												className="text-gray-500 hover:text-red-600"
											onClick={() => {
												handleInputChange("participantIds", formData.participantIds.filter(id => id !== pid));
												setSelectedUsersMap(prev => {
													const copy = { ...prev };
													delete copy[pid];
													return copy;
												});
											}}
											>
												×
											</button>
										</div>
									);
								})}
							</div>
						)}

						{/* Search */}
						<div className="relative">
							<Input
								id="participantsSearch"
								type="text"
								placeholder="Search users..."
								value={searchQuery}
								onChange={e => setSearchQuery(String((e.target as HTMLInputElement).value))}
								className="pr-10"
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

						{/* Users list */}
						<div className="max-h-72 overflow-y-auto space-y-2" onScroll={handleScroll}>
							{isLoadingUsers && users.length === 0 ? (
								<div className="py-6 text-sm text-gray-500 dark:text-gray-400 text-center">Loading users...</div>
							) : users.length === 0 ? (
								<div className="py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No users found</div>
							) : (
								users.map(u => {
									const selected = formData.participantIds.includes(u.id);
									return (
										<button
											key={u.id}
											type="button"
											className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
											onClick={() => {
												// Use functional state update to avoid stale closures
												setFormData(prev => {
													const already = prev.participantIds.includes(u.id);
													const nextIds = already
														? prev.participantIds.filter(id => id !== u.id)
														: [...prev.participantIds, u.id];
													return { ...prev, participantIds: nextIds };
												});
												setSelectedUsersMap(prev => {
													const exists = !!prev[u.id];
													if (exists) {
														const copy = { ...prev };
														delete copy[u.id];
														return copy;
													}
													return { ...prev, [u.id]: u };
												});
											}}
										>
											<div className="relative flex-shrink-0">
												{renderAvatar(u, "w-10 h-10")}
												{isUserOnline && isUserOnline(u.id) && (
													<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
												)}
											</div>
											<div className="flex-1 min-w-0 text-left">
												<div className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName}</div>
												<div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.role?.toLowerCase().replace('_',' ')}</div>
											</div>
											<div className={`w-4 h-4 rounded-full border ${selected ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}></div>
										</button>
									);
								})
							)}

							{isLoadingMore && (
								<div className="py-3 text-center">
									<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 inline-block"></div>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Form Actions */}
				<div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
					<Button size="sm" variant="outline" onClick={onClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={() =>
							handleSubmit(
								new Event("submit") as unknown as React.FormEvent<HTMLFormElement>
							)
						}
						disabled={isLoading || isLoadingUsers}
					>
						{isLoading ? "Creating..." : "Create Group"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
