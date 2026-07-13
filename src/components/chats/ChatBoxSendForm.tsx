"use client";

import React, {
	useState,
	useRef,
	useEffect,
	useCallback,
	forwardRef,
	useImperativeHandle,
} from "react";
import { createPortal } from "react-dom";
import EmojiPicker from "../ui/EmojiPicker";
import { BidChatActionIcon } from "@/icons";
import ReplyPreview from "./ReplyPreview";
import MessageTemplatesModal from "./MessageTemplatesModal";
import { Message } from "@/app-api/chatApi";
import { S3Uploader } from "@/app-api/S3Uploader";
import { prefetchChatImageThumbnail } from "@/utils/ensureChatImageThumbnail";
import { isChatImageThumbnailCandidate } from "@/config/chatImagePreview";
import { useChatImageGalleryOptional } from "@/components/chats/ChatImageGalleryContext";
import ChatFormatToolbar, { type ChatFormatAction } from "./ChatFormatToolbar";
import ChatRichComposeInput from "./ChatRichComposeInput";
import { useEditorFormatState } from "@/hooks/useEditorFormatState";
import { BID_PLUS_ONE_MESSAGE_CONTENT } from "@/utils/bidPlusOneMessage";
import {
	applyEditorFormat,
	formatActionToCommand,
	getEditorPlainText,
	htmlToMarkdown,
	insertTextAtSelection,
	type EditorFormatCommand,
} from "@/utils/chatRichEditor";

export type ChatAttachmentPayload = {
	fileUrl: string;
	key: string;
	fileName: string;
	fileSize: number;
};

interface ChatBoxSendFormProps {
	chatRoomId?: string;
	onSendMessage?: (message: {
		content: string;
		fileData?: ChatAttachmentPayload[];
		replyData?: Message["replyData"];
	}) => void;
	onTyping?: (isTyping: boolean) => void;
	disabled?: boolean;
	isLoading?: boolean;
	replyingTo?: Message["replyData"];
	onCancelReply?: () => void;
	editingMessage?: Message | null;
	editDraftKey?: number;
	onCancelEdit?: () => void;
	/** BID chats: hide emoji / templates / attachments, show green action icon stub. */
	isBidChat?: boolean;
}

export type ChatBoxSendFormHandle = {
	addFiles: (files: File[] | FileList) => Promise<void>;
};

const PICKER_WIDTH = 320;
const POPOVER_ESTIMATED_HEIGHT = 384;
const VIEWPORT_PADDING = 8;

function computeEmojiPickerPosition(anchor: DOMRect): { top: number; left: number } {
	let left = anchor.left;
	if (left + PICKER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
		left = window.innerWidth - PICKER_WIDTH - VIEWPORT_PADDING;
	}
	left = Math.max(VIEWPORT_PADDING, left);

	let top = anchor.top - POPOVER_ESTIMATED_HEIGHT - VIEWPORT_PADDING;
	if (top < VIEWPORT_PADDING) {
		top = anchor.bottom + VIEWPORT_PADDING;
	}

	return { top, left };
}

const ChatBoxSendForm = forwardRef<ChatBoxSendFormHandle, ChatBoxSendFormProps>(
	function ChatBoxSendForm(
		{
			chatRoomId,
			onSendMessage,
			onTyping,
			disabled = false,
			isLoading = false,
			replyingTo,
			onCancelReply,
			editingMessage,
			editDraftKey = 0,
			onCancelEdit,
			isBidChat = false,
		},
		ref
	) {
		const [message, setMessage] = useState<string>("");
		const [composeResetKey, setComposeResetKey] = useState(0);
		const [isSending, setIsSending] = useState(false);

		const [attachedFiles, setAttachedFiles] = useState<
			(ChatAttachmentPayload & { localId: string })[]
		>([]);
		const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
		const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
		const [emojiPickerMounted, setEmojiPickerMounted] = useState(false);
		const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(
			null
		);
		const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
		const emojiButtonRef = useRef<HTMLButtonElement>(null);
		const emojiPickerRef = useRef<HTMLDivElement>(null);
		const editorRef = useRef<HTMLDivElement>(null);
		const fileInputRef = useRef<HTMLInputElement>(null);
		const { formatState, refreshFormatState } = useEditorFormatState(
			editorRef,
			composeResetKey
		);
		const isEditing = Boolean(editingMessage);
		const chatImageGallery = useChatImageGalleryOptional();

		const syncEditorContent = useCallback(() => {
			const el = editorRef.current;
			if (!el) return;
			const markdown = htmlToMarkdown(el.innerHTML);
			const plain = getEditorPlainText(el);
			setMessage(markdown);
			if (onTyping) {
				onTyping(plain.length > 0);
			}
		}, [onTyping]);

		const handleContentChange = useCallback(
			(markdown: string, plainText: string) => {
				setMessage(markdown);
				if (onTyping) {
					onTyping(plainText.length > 0);
				}
			},
			[onTyping]
		);

		const handleSendMessage = async () => {
			if (!message.trim() && attachedFiles.length === 0) return;

			try {
				setIsSending(true);

				if (onSendMessage) {
					const filePayload: ChatAttachmentPayload[] = attachedFiles.map(
						({ localId: _id, ...rest }) => rest
					);
					await onSendMessage({
						content: message,
						fileData: filePayload.length > 0 ? filePayload : undefined,
						replyData: replyingTo,
					});
				}

				// Stop typing indicator when message is sent
				if (onTyping) {
					onTyping(false);
				}

				// Reset form
				setMessage("");
				setComposeResetKey(k => k + 1);
				setAttachedFiles([]);
				setShowEmojiPicker(false);

				// Cancel reply if we were replying
				if (replyingTo && onCancelReply) {
					onCancelReply();
				}
				if (editingMessage && onCancelEdit) {
					onCancelEdit();
				}

				// Focus back to input after sending message
				requestAnimationFrame(() => {
					editorRef.current?.focus();
				});
			} catch (error) {
				console.error("Failed to send message:", error);
			} finally {
				setIsSending(false);
			}
		};

		const applyFormatAction = useCallback(
			(action: ChatFormatAction) => {
				const el = editorRef.current;
				if (!el || disabled || isSending || isUploadingAttachments) {
					return;
				}

				el.focus();
				const command = formatActionToCommand(action);
				if (command) {
					applyEditorFormat(command);
				}
				requestAnimationFrame(() => {
					syncEditorContent();
					refreshFormatState();
				});
			},
			[disabled, isSending, isUploadingAttachments, syncEditorContent, refreshFormatState]
		);

		const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
			if ((e.ctrlKey || e.metaKey) && !e.altKey) {
				const shortcutMap: Record<string, EditorFormatCommand> = {
					b: "bold",
					i: "italic",
					u: "underline",
				};
				const command = shortcutMap[e.key.toLowerCase()];
				if (command) {
					e.preventDefault();
					editorRef.current?.focus();
					applyEditorFormat(command);
					requestAnimationFrame(() => {
						syncEditorContent();
						refreshFormatState();
					});
					return;
				}
			}

			if (e.key !== "Enter" || e.shiftKey) {
				return;
			}
			if (e.nativeEvent.isComposing) {
				return;
			}
			e.preventDefault();
			handleSendMessage();
		};

		const isFileAllowed = (file: File): boolean => {
			const acceptedTypes = [
				"image/*",
				"application/pdf",
				".doc",
				".docx",
				".txt",
				".heic",
				".heif",
			];
			const fileType = file.type;
			const lowerName = file.name.toLowerCase();
			return acceptedTypes.some(type => {
				if (type.startsWith(".")) {
					return lowerName.endsWith(type);
				}
				if (type.endsWith("/*")) {
					const baseType = type.slice(0, -2);
					return fileType.startsWith(baseType);
				}
				return fileType === type;
			});
		};

		const uploadFiles = useCallback(
			async (picked: File[]) => {
				if (picked.length === 0 || disabled || isSending) return;

				const maxSize = 10 * 1024 * 1024; // 10MB
				const toUpload: File[] = [];
				const errors: string[] = [];

				for (const file of picked) {
					if (file.size > maxSize) {
						errors.push(`${file.name}: max 10MB`);
						continue;
					}
					if (!isFileAllowed(file)) {
						errors.push(`${file.name}: type not allowed`);
						continue;
					}
					toUpload.push(file);
				}

				if (errors.length > 0) {
					alert(errors.join("\n"));
				}
				if (toUpload.length === 0) {
					return;
				}

				setIsUploadingAttachments(true);
				try {
					const uploader = new S3Uploader();
					const uploaded: (ChatAttachmentPayload & { localId: string })[] = [];
					for (const file of toUpload) {
						const { fileUrl, key, fileName, fileSize } = await uploader.upload(file);
						uploaded.push({
							localId: crypto.randomUUID(),
							fileUrl,
							key,
							fileName,
							fileSize,
						});
						if (isChatImageThumbnailCandidate(fileName)) {
							prefetchChatImageThumbnail(fileUrl, fileName);
						}
					}
					setAttachedFiles(prev => [...prev, ...uploaded]);
				} catch (error) {
					console.error("Upload error:", error);
					alert(error instanceof Error ? error.message : "Upload failed");
				} finally {
					setIsUploadingAttachments(false);
					if (fileInputRef.current) {
						fileInputRef.current.value = "";
					}
				}
			},
			[disabled, isSending]
		);

		useImperativeHandle(
			ref,
			() => ({
				addFiles: async (files: File[] | FileList) => {
					const list = Array.isArray(files) ? files : Array.from(files);
					await uploadFiles(list);
				},
			}),
			[uploadFiles]
		);

		const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
			const list = e.target.files;
			if (!list?.length) return;
			await uploadFiles(Array.from(list));
		};

		const handleFileButtonClick = () => {
			if (fileInputRef.current) {
				fileInputRef.current.click();
			}
		};

		const getClipboardFileName = (file: File, index: number) => {
			if (file.name) return file.name;

			const extensionByType: Record<string, string> = {
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/gif": "gif",
				"image/webp": "webp",
				"application/pdf": "pdf",
				"text/plain": "txt",
			};
			const extension = extensionByType[file.type] || "bin";

			return `pasted-file-${index + 1}.${extension}`;
		};

		const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
			const itemFiles = Array.from(e.clipboardData.items ?? [])
				.filter(item => item.kind === "file")
				.map(item => item.getAsFile())
				.filter((file): file is File => Boolean(file));
			const clipboardFiles =
				itemFiles.length > 0 ? itemFiles : Array.from(e.clipboardData.files ?? []);
			const files = clipboardFiles.map((file, index) => {
				const name = getClipboardFileName(file, index);
				if (file.name === name) return file;

				return new File([file], name, {
					type: file.type,
					lastModified: file.lastModified,
				});
			});

			if (files.length > 0) {
				e.preventDefault();
				e.stopPropagation();
				await uploadFiles(files);
				return;
			}

			const plain = e.clipboardData.getData("text/plain");
			if (plain) {
				e.preventDefault();
				insertTextAtSelection(editorRef.current, plain);
				requestAnimationFrame(syncEditorContent);
			}
		};

		const handleEmojiSelect = (emoji: string) => {
			insertTextAtSelection(editorRef.current, emoji);
			requestAnimationFrame(syncEditorContent);
		};

		useEffect(() => {
			setEmojiPickerMounted(true);
		}, []);

		// Clear compose state when switching chat rooms
		useEffect(() => {
			if (!chatRoomId) return;

			setMessage("");
			setComposeResetKey(k => k + 1);
			setAttachedFiles([]);
			setShowEmojiPicker(false);
			onTyping?.(false);
			onCancelEdit?.();
		}, [chatRoomId, onCancelEdit, onTyping]);

		useEffect(() => {
			if (!editingMessage) return;
			setAttachedFiles([]);
			setShowEmojiPicker(false);
			if (replyingTo && onCancelReply) {
				onCancelReply();
			}
		}, [editingMessage, replyingTo, onCancelReply]);

		const updateEmojiPickerPosition = useCallback(() => {
			if (!emojiButtonRef.current) return;
			setEmojiPickerPos(
				computeEmojiPickerPosition(emojiButtonRef.current.getBoundingClientRect())
			);
		}, []);

		useEffect(() => {
			if (!showEmojiPicker) {
				setEmojiPickerPos(null);
				return;
			}

			updateEmojiPickerPosition();
			window.addEventListener("resize", updateEmojiPickerPosition);
			window.addEventListener("scroll", updateEmojiPickerPosition, true);

			return () => {
				window.removeEventListener("resize", updateEmojiPickerPosition);
				window.removeEventListener("scroll", updateEmojiPickerPosition, true);
			};
		}, [showEmojiPicker, updateEmojiPickerPosition]);

		// Close emoji picker when clicking outside
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				const target = event.target as Node;

				// Don't close if clicking on the emoji button or emoji picker itself
				if (
					emojiButtonRef.current?.contains(target) ||
					emojiPickerRef.current?.contains(target)
				) {
					return;
				}

				setShowEmojiPicker(false);
			};

			if (showEmojiPicker) {
				document.addEventListener("mousedown", handleClickOutside);
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}, [showEmojiPicker]);

		const removeAttachedFile = (localId: string) => {
			setAttachedFiles(prev => prev.filter(f => f.localId !== localId));
		};

		const openAttachedImagePreview = useCallback(
			(attachment: ChatAttachmentPayload & { localId: string }) => {
				if (!chatImageGallery) return;

				const imageAttachments = attachedFiles.filter(file =>
					isChatImageThumbnailCandidate(file.fileName)
				);

				chatImageGallery.openImage(
					{
						fileUrl: attachment.fileUrl,
						fileName: attachment.fileName,
						fileSize: attachment.fileSize,
					},
					{
						viewOnly: true,
						images: imageAttachments.map(file => ({
							fileUrl: file.fileUrl,
							fileName: file.fileName,
							fileSize: file.fileSize,
						})),
					}
				);
			},
			[attachedFiles, chatImageGallery]
		);

		const handleCancelEdit = () => {
			onCancelEdit?.();
			setMessage("");
			setComposeResetKey(k => k + 1);
			setShowEmojiPicker(false);
			onTyping?.(false);
			requestAnimationFrame(() => {
				editorRef.current?.focus();
			});
		};

		return (
			<div className="sticky bottom-0 p-3 border-t border-gray-200 dark:border-gray-800">
				{/* Reply Preview */}
				{replyingTo && (
					<ReplyPreview replyData={replyingTo} onCancel={() => onCancelReply?.()} />
				)}

				{isEditing && editingMessage && (
					<div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 dark:border-brand-500/30 dark:bg-brand-500/10">
						<div className="min-w-0">
							<p className="text-xs font-semibold text-brand-600 dark:text-brand-300">
								Editing message
							</p>
							<p className="truncate text-xs text-gray-600 dark:text-gray-300">
								{editingMessage.content}
							</p>
						</div>
						<button
							type="button"
							onClick={handleCancelEdit}
							className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
						>
							Cancel
						</button>
					</div>
				)}

				{/* Hidden file input */}
				{!isBidChat ? (
					<input
						ref={fileInputRef}
						type="file"
						multiple
						onChange={handleFileSelect}
						accept="image/*,.heic,.heif,application/pdf,.doc,.docx,.txt"
						className="hidden"
					/>
				) : null}

				{(attachedFiles.length > 0 || isUploadingAttachments) && (
					<div className="mb-2 min-w-0 rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
						<div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto">
							{isUploadingAttachments && (
								<div className="flex shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-white/80 px-2 py-1.5 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
									<svg
										className="h-3.5 w-3.5 animate-spin"
										viewBox="0 0 24 24"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										/>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										/>
									</svg>
									Uploading…
								</div>
							)}
							{attachedFiles.map(af => {
								const isImage = isChatImageThumbnailCandidate(af.fileName);

								if (isImage) {
									return (
										<div key={af.localId} className="relative shrink-0">
											<button
												type="button"
												onClick={() => openAttachedImagePreview(af)}
												disabled={!chatImageGallery}
												aria-label={`View ${af.fileName}`}
												className="block overflow-hidden rounded-lg border border-gray-200 transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100 dark:border-gray-600"
											>
												<img
													src={af.fileUrl}
													alt={af.fileName}
													className="h-16 w-16 object-cover"
												/>
											</button>
											<button
												type="button"
												onClick={() => removeAttachedFile(af.localId)}
												disabled={isUploadingAttachments}
												aria-label={`Remove ${af.fileName}`}
												className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800/85 text-white shadow-sm hover:bg-gray-900 disabled:opacity-40 dark:bg-gray-900/90 dark:hover:bg-black"
											>
												<svg
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														d="M18 6L6 18M6 6L18 18"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</button>
										</div>
									);
								}

								return (
									<div
										key={af.localId}
										className="flex max-w-[14rem] shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-800"
									>
										<svg
											className="shrink-0 text-gray-500 dark:text-gray-400"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<polyline
												points="14,2 14,8 20,8"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
										<div className="min-w-0 flex-1">
											<p
												className="truncate text-sm text-gray-800 dark:text-gray-200"
												title={af.fileName}
											>
												{af.fileName}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{Math.round(af.fileSize / 1024)}KB
											</p>
										</div>
										<button
											type="button"
											onClick={() => removeAttachedFile(af.localId)}
											disabled={isUploadingAttachments}
											className="shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-40 dark:hover:text-gray-300"
										>
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M18 6L6 18M6 6L18 18"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</button>
									</div>
								);
							})}
						</div>
					</div>
				)}

				<form
					className="flex items-end justify-between gap-2"
					onSubmit={e => {
						e.preventDefault();
						handleSendMessage();
					}}
				>
					<div className="relative w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
							<ChatFormatToolbar
								disabled={disabled || isSending || isUploadingAttachments}
							activeFormats={formatState}
							onAction={applyFormatAction}
						/>
						<div className="relative">
							<div className="absolute bottom-1.5 left-1 z-20 flex items-center gap-2 sm:left-2">
								{isBidChat ? (
									<button
										type="button"
										disabled={disabled || isSending}
										onClick={async () => {
											if (!onSendMessage || disabled || isSending) return;
											try {
												setIsSending(true);
												await onSendMessage({
													content: BID_PLUS_ONE_MESSAGE_CONTENT,
												});
												if (onTyping) {
													onTyping(false);
												}
											} catch (error) {
												console.error("Failed to send +1 message:", error);
											} finally {
												setIsSending(false);
											}
										}}
										className="text-green-500 hover:text-green-600 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
										aria-label="Send +1"
										title="Send +1"
									>
										<BidChatActionIcon className="h-6 w-6" />
									</button>
								) : (
									<>
										<button
											ref={emojiButtonRef}
											type="button"
											disabled={disabled || isSending || isUploadingAttachments}
											onClick={() => {
												setShowEmojiPicker(open => {
													const next = !open;
													if (next) {
														requestAnimationFrame(updateEmojiPickerPosition);
													}
													return next;
												});
											}}
											className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 disabled:opacity-50"
										>
											<svg
												className="fill-current"
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													fillRule="evenodd"
													clipRule="evenodd"
													d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM10.0001 9.23256C10.0001 8.5422 9.44042 7.98256 8.75007 7.98256C8.05971 7.98256 7.50007 8.5422 7.50007 9.23256V9.23266C7.50007 9.92301 8.05971 10.4827 8.75007 10.4827C9.44042 10.4827 10.0001 9.92301 10.0001 9.23266V9.23256ZM15.2499 7.98256C15.9403 7.98256 16.4999 8.5422 16.4999 9.23256V9.23266C16.4999 9.92301 15.9403 10.4827 15.2499 10.4827C14.5596 10.4827 13.9999 9.92301 13.9999 9.23266V9.23256C13.9999 8.5422 14.5596 7.98256 15.2499 7.98256ZM9.23014 13.7116C8.97215 13.3876 8.5003 13.334 8.17625 13.592C7.8522 13.85 7.79865 14.3219 8.05665 14.6459C8.97846 15.8037 10.4026 16.5481 12 16.5481C13.5975 16.5481 15.0216 15.8037 15.9434 14.6459C16.2014 14.3219 16.1479 13.85 15.8238 13.592C15.4998 13.334 15.0279 13.3876 14.7699 13.7116C14.1205 14.5274 13.1213 15.0481 12 15.0481C10.8788 15.0481 9.87961 14.5274 9.23014 13.7116Z"
													fill=""
												/>
											</svg>
										</button>
										<button
											type="button"
											disabled={
												disabled || isSending || isUploadingAttachments || isEditing
											}
											onClick={() => setTemplatesModalOpen(true)}
											className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 disabled:opacity-50"
											aria-label="Message templates"
										>
											<svg
												className="fill-current"
												xmlns="http://www.w3.org/2000/svg"
												shapeRendering="geometricPrecision"
												textRendering="geometricPrecision"
												imageRendering="optimizeQuality"
												fillRule="evenodd"
												clipRule="evenodd"
												viewBox="0 0 438 511.52"
												width={22}
												height={22}
											>
												<path
													fillRule="nonzero"
													d="M141.44 0h172.68c4.71 0 8.91 2.27 11.54 5.77L434.11 123.1a14.37 14.37 0 0 1 3.81 9.75l.08 251.18c0 17.62-7.25 33.69-18.9 45.36l-.07.07c-11.67 11.64-27.73 18.87-45.33 18.87h-20.06c-.3 17.24-7.48 32.9-18.88 44.29-11.66 11.66-27.75 18.9-45.42 18.9H64.3c-17.67 0-33.76-7.24-45.41-18.9C7.24 480.98 0 464.9 0 447.22V135.87c0-17.68 7.23-33.78 18.88-45.42C30.52 78.8 46.62 71.57 64.3 71.57h12.84V64.3c0-17.68 7.23-33.78 18.88-45.42C107.66 7.23 123.76 0 141.44 0zm30.53 250.96c-7.97 0-14.43-6.47-14.43-14.44 0-7.96 6.46-14.43 14.43-14.43h171.2c7.97 0 14.44 6.47 14.44 14.43 0 7.97-6.47 14.44-14.44 14.44h-171.2zm0 76.86c-7.97 0-14.43-6.46-14.43-14.43 0-7.96 6.46-14.43 14.43-14.43h136.42c7.97 0 14.43 6.47 14.43 14.43 0 7.97-6.46 14.43-14.43 14.43H171.97zM322.31 44.44v49.03c.96 12.3 5.21 21.9 12.65 28.26 7.8 6.66 19.58 10.41 35.23 10.69l33.39-.04-81.27-87.94zm86.83 116.78-39.17-.06c-22.79-.35-40.77-6.5-53.72-17.57-13.48-11.54-21.1-27.86-22.66-48.03l-.14-2v-64.7H141.44c-9.73 0-18.61 4-25.03 10.41C110 45.69 106 54.57 106 64.3v319.73c0 9.74 4.01 18.61 10.42 25.02 6.42 6.42 15.29 10.42 25.02 10.42H373.7c9.75 0 18.62-3.98 25.01-10.38 6.45-6.44 10.43-15.3 10.43-25.06V161.22zm-84.38 287.11H141.44c-17.68 0-33.77-7.24-45.41-18.88-11.65-11.65-18.89-27.73-18.89-45.42v-283.6H64.3c-9.74 0-18.61 4-25.03 10.41-6.41 6.42-10.41 15.29-10.41 25.03v311.35c0 9.73 4.01 18.59 10.42 25.01 6.43 6.43 15.3 10.43 25.02 10.43h225.04c9.72 0 18.59-4 25.02-10.43 6.17-6.17 10.12-14.61 10.4-23.9z"
												/>
											</svg>
										</button>
									</>
								)}
							</div>

							<ChatRichComposeInput
								editorRef={editorRef}
								resetKey={composeResetKey}
								draftKey={editDraftKey}
								draftContent={editingMessage?.content ?? ""}
								onContentChange={handleContentChange}
								onKeyDown={handleKeyDown}
								onPaste={handlePaste}
								disabled={disabled || isSending || isUploadingAttachments}
								compactLeadingIcons={isBidChat}
							/>
						</div>
					</div>

					<div className="flex flex-shrink-0 items-center pb-0.5">
						{/* File attachment button */}
						{!isBidChat ? (
							<button
								type="button"
								onClick={handleFileButtonClick}
								disabled={disabled || isSending || isUploadingAttachments || isEditing}
								className="mr-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 disabled:opacity-50"
							>
								<svg
									className="fill-current"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fillRule="evenodd"
										clipRule="evenodd"
										d="M12.9522 14.4422C12.9522 14.452 12.9524 14.4618 12.9527 14.4714V16.1442C12.9527 16.6699 12.5265 17.0961 12.0008 17.0961C11.475 17.0961 11.0488 16.6699 11.0488 16.1442V6.15388C11.0488 5.73966 10.7131 5.40388 10.2988 5.40388C9.88463 5.40388 9.54885 5.73966 9.54885 6.15388V16.1442C9.54885 17.4984 10.6466 18.5961 12.0008 18.5961C13.355 18.5961 14.4527 17.4983 14.4527 16.1442V6.15388C14.4527 6.14308 14.4525 6.13235 14.452 6.12166C14.4347 3.84237 12.5817 2 10.2983 2C8.00416 2 6.14441 3.85976 6.14441 6.15388V14.4422C6.14441 14.4492 6.1445 14.4561 6.14469 14.463V16.1442C6.14469 19.3783 8.76643 22 12.0005 22C15.2346 22 17.8563 19.3783 17.8563 16.1442V9.55775C17.8563 9.14354 17.5205 8.80775 17.1063 8.80775C16.6921 8.80775 16.3563 9.14354 16.3563 9.55775V16.1442C16.3563 18.5498 14.4062 20.5 12.0005 20.5C9.59485 20.5 7.64469 18.5498 7.64469 16.1442V9.55775C7.64469 9.55083 7.6446 9.54393 7.64441 9.53706L7.64441 6.15388C7.64441 4.68818 8.83259 3.5 10.2983 3.5C11.764 3.5 12.9522 4.68818 12.9522 6.15388L12.9522 14.4422Z"
										fill=""
									/>
								</svg>
							</button>
						) : null}

						{/* Send button */}
						<button
							type="submit"
							disabled={
								disabled ||
								isLoading ||
								isUploadingAttachments ||
								(!message.trim() && attachedFiles.length === 0)
							}
							className="flex items-center justify-center ml-3 text-white rounded-lg h-9 w-9 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 disabled:cursor-not-allowed xl:ml-5"
						>
							{isLoading ? (
								// Loading spinner
								<svg
									className="animate-spin"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
										className="opacity-25"
									/>
									<path
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										className="opacity-75"
									/>
								</svg>
							) : (
								// Send icon
								<svg
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fillRule="evenodd"
										clipRule="evenodd"
										d="M4.98481 2.44399C3.11333 1.57147 1.15325 3.46979 1.96543 5.36824L3.82086 9.70527C3.90146 9.89367 3.90146 10.1069 3.82086 10.2953L1.96543 14.6323C1.15326 16.5307 3.11332 18.4291 4.98481 17.5565L16.8184 12.0395C18.5508 11.2319 18.5508 8.76865 16.8184 7.961L4.98481 2.44399ZM3.34453 4.77824C3.0738 4.14543 3.72716 3.51266 4.35099 3.80349L16.1846 9.32051C16.762 9.58973 16.762 10.4108 16.1846 10.68L4.35098 16.197C3.72716 16.4879 3.0738 15.8551 3.34453 15.2223L5.19996 10.8853C5.21944 10.8397 5.23735 10.7937 5.2537 10.7473L9.11784 10.7473C9.53206 10.7473 9.86784 10.4115 9.86784 9.99726C9.86784 9.58304 9.53206 9.24726 9.11784 9.24726L5.25157 9.24726C5.2358 9.20287 5.2186 9.15885 5.19996 9.11528L3.34453 4.77824Z"
										fill="white"
									/>
								</svg>
							)}
						</button>
					</div>
				</form>

				{!isBidChat && showEmojiPicker && emojiPickerPos && emojiPickerMounted
					? createPortal(
							<div
								ref={emojiPickerRef}
								className="z-[10050]"
								style={{
									position: "fixed",
									top: emojiPickerPos.top,
									left: emojiPickerPos.left,
									width: PICKER_WIDTH,
								}}
							>
								<EmojiPicker
									variant="inline"
									isOpen
									onClose={() => setShowEmojiPicker(false)}
									onEmojiSelect={handleEmojiSelect}
								/>
							</div>,
							document.body
						)
					: null}

				{!isBidChat ? (
					<MessageTemplatesModal
						isOpen={templatesModalOpen}
						onClose={() => setTemplatesModalOpen(false)}
						onInsertContent={text => {
							const t = text.trim();
							if (!t) return;
							const el = editorRef.current;
							if (el) {
								el.focus();
								const existing = getEditorPlainText(el);
								const toInsert = existing ? `\n${t}` : t;
								insertTextAtSelection(el, toInsert);
								syncEditorContent();
							}
							setTemplatesModalOpen(false);
							requestAnimationFrame(() => editorRef.current?.focus());
						}}
					/>
				) : null}
			</div>
		);
	}
);

export default ChatBoxSendForm;
