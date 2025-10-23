"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileInputUploader } from "../FileInputUploader/FileInputUploader";
import EmojiPicker from "../ui/EmojiPicker";
import ReplyPreview from "./ReplyPreview";
import { Message } from "@/app-api/chatApi";

interface ChatBoxSendFormProps {
	onSendMessage?: (message: {
		content: string;
		fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number };
		replyData?: Message['replyData'];
	}) => void;
	onTyping?: (isTyping: boolean) => void;
	disabled?: boolean;
	isLoading?: boolean;
	replyingTo?: Message['replyData'];
	onCancelReply?: () => void;
}

export default function ChatBoxSendForm({
	onSendMessage,
	onTyping,
	disabled = false,
	isLoading = false,
	replyingTo,
	onCancelReply,
}: ChatBoxSendFormProps) {
	const [message, setMessage] = useState<string>("");
	const [isSending, setIsSending] = useState(false);

	const [attachedFile, setAttachedFile] = useState<{
		fileUrl: string;
		key: string;
		fileName: string;
		fileSize: number;
	} | null>(null);
	const [showFileUploader, setShowFileUploader] = useState<boolean>(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
	const emojiButtonRef = useRef<HTMLButtonElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);

	const handleSendMessage = async () => {
		if (!message.trim() && !attachedFile) return;

		try {
			setIsSending(true);

			if (onSendMessage) {
				await onSendMessage({
					content: message,
					fileData: attachedFile || undefined,
					replyData: replyingTo,
				});
			}

			// Stop typing indicator when message is sent
			if (onTyping) {
				onTyping(false);
			}

			// Reset form
			setMessage("");
			setAttachedFile(null);
			setShowFileUploader(false);
			setShowEmojiPicker(false);
			
			// Cancel reply if we were replying
			if (replyingTo && onCancelReply) {
				onCancelReply();
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setMessage(value);

		// Send typing indicator
		if (onTyping) {
			onTyping(value.trim().length > 0);
		}
	};

	const handleFileUploaded = (fileData: {
		fileUrl: string;
		key: string;
		fileName: string;
		fileSize: number;
	}) => {
		setAttachedFile(fileData);
		setShowFileUploader(false);
	};

	const handleEmojiSelect = (emoji: string) => {
		setMessage(prev => prev + emoji);
		// Focus back to input after emoji selection
		const input = document.querySelector('input[type="text"]') as HTMLInputElement;
		if (input) {
			input.focus();
		}
	};

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
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showEmojiPicker]);

	const removeAttachedFile = () => {
		setAttachedFile(null);
	};

	return (
		<div className="sticky bottom-0 p-3 border-t border-gray-200 dark:border-gray-800">
			{/* Reply Preview */}
			{replyingTo && (
				<ReplyPreview 
					replyData={replyingTo} 
					onCancel={() => onCancelReply?.()} 
				/>
			)}

			{/* File uploader overlay */}
			{showFileUploader && (
				<div className="absolute bottom-full left-0 right-0 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mb-2">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-medium text-gray-900 dark:text-white">
							Attach File
						</h3>
						<button
							onClick={() => setShowFileUploader(false)}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
					<FileInputUploader
						onFileUploaded={handleFileUploaded}
						acceptedTypes="image/*,application/pdf,.doc,.docx,.txt"
						maxSize={10}
					/>
				</div>
			)}

			{/* Attached file preview */}
			{attachedFile && (
				<div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<svg
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
						<span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">
							{attachedFile.fileName}
						</span>
						<span className="text-xs text-gray-500 dark:text-gray-400">
							({Math.round(attachedFile.fileSize / 1024)}KB)
						</span>
					</div>
					<button
						onClick={removeAttachedFile}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
			)}

			<form
				className="flex items-center justify-between"
				onSubmit={e => {
					e.preventDefault();
					handleSendMessage();
				}}
			>
				<div className="relative w-full">
					<button
						ref={emojiButtonRef}
						type="button"
						onClick={() => setShowEmojiPicker(!showEmojiPicker)}
						className="absolute text-gray-500 -translate-y-1/2 left-1 top-1/2 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 sm:left-3"
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

					{/* Emoji Picker */}
					<EmojiPicker
						ref={emojiPickerRef}
						isOpen={showEmojiPicker}
						onClose={() => setShowEmojiPicker(false)}
						onEmojiSelect={handleEmojiSelect}
					/>

					<input
						type="text"
						placeholder="Type a message"
						value={message}
						onChange={handleMessageChange}
						onKeyDown={handleKeyDown}
						disabled={disabled || isSending}
						className="w-full pl-12 pr-5 text-sm text-gray-800 bg-transparent border-none outline-hidden h-9 placeholder:text-gray-400 focus:border-0 focus:ring-0 dark:text-white/90 disabled:opacity-50"
					/>
				</div>

				<div className="flex items-center">
					{/* File attachment button */}
					<button
						type="button"
						onClick={() => setShowFileUploader(!showFileUploader)}
						disabled={disabled || isSending}
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


					{/* Send button */}
					<button
						type="submit"
						disabled={disabled || isLoading || (!message.trim() && !attachedFile)}
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
		</div>
	);
}
