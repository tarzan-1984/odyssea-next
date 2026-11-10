"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import usersApi from "@/app-api/users";
import { GetAllUsersParams, UserListItem } from "@/app-api/api-types";
import { chatApi } from "@/app-api/chatApi";
import { renderAvatar, getRoleDisplayLabel } from "@/helpers";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { useEditorFormatState } from "@/hooks/useEditorFormatState";
import ChatFormatToolbar, { type ChatFormatAction } from "./ChatFormatToolbar";
import {
	applyEditorFormat,
	formatActionToCommand,
	htmlToMarkdown,
	isEditorEmpty,
	type EditorFormatCommand,
} from "@/utils/chatRichEditor";
import { useCurrentUser } from "@/stores/userStore";
import { canCreateLoadChat } from "@/utils/roleAccess";

interface CreateLoadChatModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type LoadChatCompany = "Odysseia" | "Martlet" | "Endurance";

const COMPANY_OPTIONS: Array<{ value: LoadChatCompany; label: string }> = [
	{ value: "Odysseia", label: "Odysseia" },
	{ value: "Martlet", label: "Martlet" },
	{ value: "Endurance", label: "Endurance" },
];

function createdLoadChatCount(data: unknown): { count: number; warnings: string[] } {
	if (!data || typeof data !== "object") {
		return { count: 0, warnings: [] };
	}
	const record = data as {
		id?: unknown;
		chats?: unknown;
		warnings?: unknown;
	};
	const warnings = Array.isArray(record.warnings)
		? record.warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
		: [];
	if (Array.isArray(record.chats)) {
		const count = record.chats.filter((chat: unknown) => {
			return Boolean(chat && typeof chat === "object" && typeof (chat as { id?: unknown }).id === "string");
		}).length;
		return { count, warnings };
	}
	if (typeof record.id === "string" && record.id.trim()) {
		return { count: 1, warnings };
	}
	return { count: 0, warnings };
}

function DispatchMessageEditor({
	disabled,
	onChange,
}: {
	disabled?: boolean;
	onChange: (markdown: string) => void;
}) {
	const editorRef = useRef<HTMLDivElement>(null);
	const { formatState, refreshFormatState } = useEditorFormatState(editorRef);
	const [isEmpty, setIsEmpty] = useState(true);

	const sync = useCallback(() => {
		const editor = editorRef.current;
		const empty = isEditorEmpty(editor);
		setIsEmpty(empty);
		onChange(empty || !editor ? "" : htmlToMarkdown(editor.innerHTML));
	}, [onChange]);

	const applyFormat = useCallback(
		(command: EditorFormatCommand) => {
			const editor = editorRef.current;
			if (!editor || disabled) return;
			editor.focus();
			applyEditorFormat(command);
			requestAnimationFrame(() => {
				sync();
				refreshFormatState();
			});
		},
		[disabled, refreshFormatState, sync]
	);

	const applyFormatAction = useCallback(
		(action: ChatFormatAction) => {
			const command = formatActionToCommand(action);
			if (command) applyFormat(command);
		},
		[applyFormat]
	);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		const shortcutMap: Record<string, EditorFormatCommand> = {
			b: "bold",
			i: "italic",
			u: "underline",
		};
		const command = shortcutMap[event.key.toLowerCase()];
		if (!command) return;
		event.preventDefault();
		applyFormat(command);
	};

	return (
		<div className="overflow-hidden rounded-lg border border-gray-300 bg-transparent dark:border-gray-700 dark:bg-gray-900">
			<ChatFormatToolbar
				disabled={disabled}
				activeFormats={formatState}
				onAction={applyFormatAction}
			/>
			<div className="relative">
				{isEmpty ? (
					<span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400 dark:text-white/30">
						Dispatch message
					</span>
				) : null}
				<div
					ref={editorRef}
					contentEditable={!disabled}
					role="textbox"
					aria-multiline
					aria-label="Dispatch message"
					suppressContentEditableWarning
					onInput={sync}
					onKeyDown={handleKeyDown}
					className="chat-compose-editor min-h-28 max-h-48 overflow-y-auto px-3 py-2 text-sm leading-snug text-gray-800 outline-none dark:text-white/90"
				/>
			</div>
		</div>
	);
}

export default function CreateLoadChatModal({ isOpen, onClose }: CreateLoadChatModalProps) {
	const currentUser = useCurrentUser();
	const canSubmitCreate = canCreateLoadChat(currentUser?.role);
	const [loadId, setLoadId] = useState("");
	const [title, setTitle] = useState("");
	const [company, setCompany] = useState<LoadChatCompany>("Odysseia");
	const [dispatchMessage, setDispatchMessage] = useState("");
	const [participantIds, setParticipantIds] = useState<string[]>([]);
	const [users, setUsers] = useState<UserListItem[]>([]);
	const [selectedUsersMap, setSelectedUsersMap] = useState<Record<string, UserListItem>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState("");
	const { isUserOnline } = useOnlineStatus();
	const dispatchMessageRef = useRef(dispatchMessage);
	dispatchMessageRef.current = dispatchMessage;

	const fetchUsers = async (page: number = 1, search: string = "", append: boolean = false) => {
		if (append) {
			setIsLoadingMore(true);
		} else {
			setIsLoadingUsers(true);
		}
		setError("");

		try {
			const params: GetAllUsersParams = {
				page,
				limit: 20,
				status: "ACTIVE",
				contactsOnly: true,
			};
			if (search) params.search = search;

			const response = await usersApi.getAllUsers(params);
			if (response.success && response.data) {
				const newUsers: UserListItem[] = response.data.data?.users || [];
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
		} catch (fetchError) {
			console.error("Error fetching users:", fetchError);
			setError("Failed to load users");
		} finally {
			setIsLoadingUsers(false);
			setIsLoadingMore(false);
		}
	};

	useEffect(() => {
		if (!isOpen) {
			setLoadId("");
			setTitle("");
			setCompany("Odysseia");
			setDispatchMessage("");
			setParticipantIds([]);
			setError("");
			setUsers([]);
			setSelectedUsersMap({});
			setSearchQuery("");
			setCurrentPage(1);
			setHasMore(true);
			return;
		}

		const timeout = setTimeout(() => {
			setCurrentPage(1);
			setHasMore(true);
			void fetchUsers(1, searchQuery, false);
		}, searchQuery ? 300 : 0);
		return () => clearTimeout(timeout);
		// Fetch when the modal opens or the search query changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery, isOpen]);

	const loadMoreUsers = () => {
		if (!isLoadingMore && hasMore) {
			void fetchUsers(currentPage + 1, searchQuery, true);
		}
	};

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
		if (scrollHeight - scrollTop <= clientHeight + 100) {
			loadMoreUsers();
		}
	};

	const toggleParticipant = (user: UserListItem) => {
		const externalId = user.externalId?.trim();
		if (!externalId) {
			setError("This user has no external ID and cannot be added to a load chat");
			return;
		}
		setError("");
		setParticipantIds(prev => {
			const already = prev.includes(user.id);
			return already ? prev.filter(id => id !== user.id) : [...prev, user.id];
		});
		setSelectedUsersMap(prev => {
			if (prev[user.id]) {
				const copy = { ...prev };
				delete copy[user.id];
				return copy;
			}
			return { ...prev, [user.id]: user };
		});
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmitCreate) {
			setError("You do not have permission to create load chats");
			return;
		}
		setIsLoading(true);
		setError("");

		const trimmedLoadId = loadId.trim();
		const trimmedTitle = title.trim();
		if (!trimmedLoadId) {
			setError("Load ID is required");
			setIsLoading(false);
			return;
		}
		if (!trimmedTitle) {
			setError("Title is required");
			setIsLoading(false);
			return;
		}
		if (participantIds.length === 0) {
			setError("At least one participant is required");
			setIsLoading(false);
			return;
		}

		const participants = participantIds
			.map(id => selectedUsersMap[id])
			.filter((user): user is UserListItem => Boolean(user?.externalId?.trim() && user.role?.trim()))
			.map(user => ({
				id: user.externalId!.trim(),
				role: user.role.trim(),
			}));

		if (participants.length === 0) {
			setError("Selected participants must have an external ID");
			setIsLoading(false);
			return;
		}
		if (!participants.some(participant => participant.role.toUpperCase() === "DRIVER")) {
			setError("At least one driver is required");
			setIsLoading(false);
			return;
		}

		try {
			const dispatchText = dispatchMessageRef.current.trim();
			const result = await chatApi.createLoadChat({
				load_id: trimmedLoadId,
				title: trimmedTitle,
				company,
				...(dispatchText ? { dispatch_message: dispatchText } : {}),
				participants,
			});
			const { count, warnings } = createdLoadChatCount(result);
			if (count === 0) {
				setError(warnings.join("\n") || "Load chat was not created");
				return;
			}
			if (warnings.length > 0) {
				setError(`Load chat created.\n${warnings.join("\n")}`);
				return;
			}
			onClose();
		} catch (submitError) {
			console.error("Error creating load chat:", submitError);
			setError(submitError instanceof Error ? submitError.message : "Failed to create load chat");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDispatchChange = useCallback((markdown: string) => {
		setDispatchMessage(markdown);
	}, []);

	return (
		<Modal isOpen={isOpen} onClose={onClose} className="max-w-[584px] w-full mx-auto p-4 sm:p-6 lg:p-10">
			<form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto">
				<div className="mb-6 pr-10">
					<h4 className="text-lg font-medium text-gray-800 dark:text-white/90">Create Load Chat</h4>
				</div>

				{error ? (
					<div className="whitespace-pre-wrap p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
						{error}
					</div>
				) : null}

				<div className="space-y-6">
					<div>
						<Label htmlFor="loadChatLoadId">Load ID *</Label>
						<Input
							id="loadChatLoadId"
							type="text"
							placeholder="Enter load ID"
							value={loadId}
							onChange={event => {
								setLoadId(event.target.value);
								setError("");
							}}
						/>
					</div>

					<div>
						<Label htmlFor="loadChatTitle">Title *</Label>
						<Input
							id="loadChatTitle"
							type="text"
							placeholder="L-04117 Lafayette Hill PA - Spartanburg SC"
							value={title}
							onChange={event => {
								setTitle(event.target.value);
								setError("");
							}}
						/>
					</div>

					<div>
						<Label htmlFor="loadChatCompany">Company *</Label>
						<div className="relative">
							<select
								id="loadChatCompany"
								value={company}
								onChange={event => setCompany(event.target.value as LoadChatCompany)}
								className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
							>
								{COMPANY_OPTIONS.map(option => (
									<option
										key={option.value}
										value={option.value}
										className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
									>
										{option.label}
									</option>
								))}
							</select>
							<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
									<path
										d="M5 7.5L10 12.5L15 7.5"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</span>
						</div>
					</div>

					<div>
						<Label>Dispatch message</Label>
						{isOpen ? <DispatchMessageEditor disabled={isLoading} onChange={handleDispatchChange} /> : null}
					</div>

					<div className="space-y-3">
						<Label>Participants *</Label>
						{participantIds.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{participantIds.map(participantId => {
									const user = selectedUsersMap[participantId] ?? users.find(item => item.id === participantId);
									if (!user) return null;
									return (
										<div
											key={participantId}
											className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
										>
											{renderAvatar(user, "w-6 h-6")}
											<span className="text-xs text-gray-700 dark:text-gray-300">
												{user.firstName} {user.lastName}
											</span>
											<button
												type="button"
												className="text-gray-500 hover:text-red-600"
												onClick={() => toggleParticipant(user)}
											>
												×
											</button>
										</div>
									);
								})}
							</div>
						) : null}

						<div className="relative">
							<Input
								id="loadChatParticipantsSearch"
								type="text"
								placeholder="Search users..."
								value={searchQuery}
								onChange={event => setSearchQuery(event.target.value)}
								className="pr-10"
							/>
							{searchQuery ? (
								<button
									type="button"
									onClick={() => setSearchQuery("")}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
								>
									<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							) : null}
						</div>

						<div className="max-h-72 space-y-2 overflow-y-auto" onScroll={handleScroll}>
							{isLoadingUsers && users.length === 0 ? (
								<div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading users...</div>
							) : users.length === 0 ? (
								<div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No users found</div>
							) : (
								users.map(user => {
									const selected = participantIds.includes(user.id);
									const missingExternalId = !user.externalId?.trim();
									return (
										<button
											key={user.id}
											type="button"
											disabled={missingExternalId}
											className={`flex w-full items-center gap-3 rounded-lg p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800/50 ${
												selected ? "bg-blue-50 dark:bg-blue-900/20" : ""
											}`}
											onClick={() => toggleParticipant(user)}
										>
											<div className="relative flex-shrink-0">
												{renderAvatar(user, "w-10 h-10")}
												{isUserOnline && isUserOnline(user.id) ? (
													<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
												) : null}
											</div>
											<div className="min-w-0 flex-1 text-left">
												<div className="truncate text-sm font-medium text-gray-900 dark:text-white">
													{user.firstName} {user.lastName}
												</div>
												<div className="truncate text-xs text-gray-500 dark:text-gray-400">
													{getRoleDisplayLabel(user.role)}
													{missingExternalId ? " · No external ID" : ""}
												</div>
											</div>
											<div
												className={`h-4 w-4 rounded-full border ${
													selected ? "border-blue-600 bg-blue-600" : "border-gray-300"
												}`}
											></div>
										</button>
									);
								})
							)}

							{isLoadingMore ? (
								<div className="py-3 text-center">
									<div className="inline-block h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
								</div>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
					<Button size="sm" variant="outline" onClick={onClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						size="sm"
						type="submit"
						disabled={!canSubmitCreate || isLoading || isLoadingUsers}
					>
						{isLoading ? "Creating..." : "Create Load Chat"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
