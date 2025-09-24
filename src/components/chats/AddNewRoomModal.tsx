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
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [error, setError] = useState<string>("");

	// Use our new chat sync hook
	const { createChatRoom } = useChatSync();

	// Fetch users when modal opens
	useEffect(() => {
		if (isOpen) {
			fetchUsers();
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
		}
	}, [isOpen]);

	/**
	 * Fetches users list for participant selection
	 */
	const fetchUsers = async () => {
		setIsLoadingUsers(true);
		setError("");

		try {
			const response = await usersApi.getAllUsers({
				page: 1,
				limit: 100, // Get more users for selection
			});

			if (response.success && response.data) {
				const newUsers = response.data.data || [];
				setUsers(newUsers);
			} else {
				setError(response.error || "Failed to load users");
				setUsers([]);
			}
		} catch (error) {
			console.error("Error fetching users:", error);
			setError("Failed to load users");
			setUsers([]);
		} finally {
			setIsLoadingUsers(false);
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

		// Validate form data
		if (!formData.name.trim()) {
			setError("Room name is required");
			setIsLoading(false);
			return;
		}

		if (!formData.loadId.trim()) {
			setError("Load ID is required");
			setIsLoading(false);
			return;
		}

		if (formData.participantIds.length === 0) {
			setError("At least one participant is required");
			setIsLoading(false);
			return;
		}

		try {
			// Use our new createChatRoom function from useChatSync
			await createChatRoom({
				name: formData.name.trim(),
				type: "DIRECT", // Default to DIRECT as specified in requirements
				loadId: formData.loadId.trim(),
				participantIds: formData.participantIds,
			});

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
		text: user.driver_name || user.driver_email,
		selected: formData.participantIds.includes(user.id),
	}));

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="max-w-[584px] w-full mx-auto p-4 sm:p-6 lg:p-10"
		>
			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="flex items-center justify-between mb-6">
					<h4 className="text-lg font-medium text-gray-800 dark:text-white/90">
						Create New Chat Room
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
							placeholder="Enter room name (e.g., Load #12345 Discussion)"
							defaultValue={formData.name}
							onChange={e => handleInputChange("name", e.target.value)}
						/>
					</div>

					{/* Load ID Field */}
					<div>
						<Label htmlFor="loadId">Load ID *</Label>
						<Input
							id="loadId"
							type="text"
							placeholder="Enter load ID (e.g., load_123)"
							defaultValue={formData.loadId}
							onChange={e => handleInputChange("loadId", e.target.value)}
						/>
					</div>

					{/* Participants Multi-Select */}
					<div>
						<MultiSelect
							label="Participants *"
							options={userOptions}
							defaultSelected={formData.participantIds}
							onChange={selectedIds =>
								handleInputChange("participantIds", selectedIds)
							}
						/>
						{isLoadingUsers && (
							<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
								Loading users...
							</p>
						)}
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
						{isLoading ? "Creating..." : "Create Room"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
