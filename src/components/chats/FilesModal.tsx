"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "../ui/modal";
import { ChatRoom, Message } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import { DownloadIcon, FileIcon } from "@/icons";
import { chatApi } from "@/app-api/chatApi";
import { messagesArchiveApi, ArchiveDay } from "@/app-api/messagesArchiveApi";

interface FilesModalProps {
	isOpen: boolean;
	onClose: () => void;
	chatRoom: ChatRoom;
}

interface FileMessage extends Message {
	fileUrl: string;
	fileName: string;
	fileSize: number;
}


export default function FilesModal({ isOpen, onClose, chatRoom }: FilesModalProps) {
	const [files, setFiles] = useState<FileMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [page, setPage] = useState(1);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	
	// Archive-related state
	const [availableArchives, setAvailableArchives] = useState<ArchiveDay[]>([]);
	const [currentArchiveIndex, setCurrentArchiveIndex] = useState(0);
	const [isLoadingArchives, setIsLoadingArchives] = useState(false);
	const [isLoadingFromArchive, setIsLoadingFromArchive] = useState(false);
	
	
	const currentUser = useCurrentUser();


	// Load files from regular API (newest messages first)
	const loadFilesFromAPI = useCallback(async (pageNum: number, isLoadMore: boolean = false) => {
		if (!chatRoom?.id) return { fileMessages: [], hasMore: false };

		try {
			// Load messages with files from API
			const response = await chatApi.getMessages(chatRoom.id, pageNum, 10);
			const messages = response.messages;
			
			// Filter only messages with file attachments
			const fileMessages = messages.filter((msg: Message) => 
				msg.fileUrl && msg.fileName && msg.fileSize
			) as FileMessage[];

			// Sort by creation time (newest first)
			fileMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			return { fileMessages, hasMore: response.hasMore };
		} catch (error) {
			console.error("Failed to load files from API:", error);
			return { fileMessages: [], hasMore: false };
		}
	}, [chatRoom?.id]);

	// Load files from archive
	const loadFilesFromArchive = useCallback(async (archive: ArchiveDay) => {
		if (!chatRoom?.id) return [];

		try {
			setIsLoadingFromArchive(true);
			
			const archiveFile = await messagesArchiveApi.loadArchivedMessages(
				chatRoom.id,
				archive.year,
				archive.month,
				archive.day
			);

			// Filter only messages with file attachments
			const fileMessages = archiveFile.messages.filter((msg) => 
				msg.fileUrl && msg.fileName && msg.fileSize
			) as FileMessage[];

			// Sort by creation time (newest first)
			fileMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			return fileMessages;
		} catch (error) {
			console.error("Failed to load files from archive:", error);
			return [];
		} finally {
			setIsLoadingFromArchive(false);
		}
	}, [chatRoom?.id]);


	// Load available archives
	const loadAvailableArchives = useCallback(async () => {
		if (!chatRoom?.id) return;

		try {
			setIsLoadingArchives(true);
			const archives = await messagesArchiveApi.getAvailableArchiveDays(chatRoom.id);
			
			// Sort archives by date (newest first)
			archives.sort((a, b) => {
				const dateA = new Date(a.createdAt);
				const dateB = new Date(b.createdAt);
				return dateB.getTime() - dateA.getTime();
			});
			
			setAvailableArchives(archives);
			setCurrentArchiveIndex(0);
		} catch (error) {
			console.error("Failed to load available archives:", error);
		} finally {
			setIsLoadingArchives(false);
		}
	}, [chatRoom?.id]);

	const loadMoreFiles = useCallback(async () => {
		if (!isLoadingMore && hasMore) {
			setIsLoadingMore(true);
			
			try {
				const nextPage = page + 1;
				setPage(nextPage);
				
				// Try to load from API first
				const apiResult = await loadFilesFromAPI(nextPage, true);
				
				if (apiResult.fileMessages.length > 0) {
					// We have files from API
					setFiles(prev => [...prev, ...apiResult.fileMessages]);
					setHasMore(apiResult.hasMore);
				} else if (availableArchives.length > 0 && currentArchiveIndex < availableArchives.length) {
					// No more files from API, try archives
					const archive = availableArchives[currentArchiveIndex];
					const archiveFiles = await loadFilesFromArchive(archive);
					
					if (archiveFiles.length > 0) {
						setFiles(prev => [...prev, ...archiveFiles]);
					}
					
					setCurrentArchiveIndex(prev => prev + 1);
					setHasMore(currentArchiveIndex + 1 < availableArchives.length);
				} else {
					// No more files anywhere
					setHasMore(false);
				}
			} catch (error) {
				console.error("Failed to load more files:", error);
			} finally {
				setIsLoadingMore(false);
			}
		}
	}, [page, isLoadingMore, hasMore, loadFilesFromAPI, availableArchives, currentArchiveIndex, loadFilesFromArchive]);

	// Handle scroll to load more
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		if (scrollHeight - scrollTop <= clientHeight + 100) {
			loadMoreFiles();
		}
	}, [loadMoreFiles]);

	// Load initial files when modal opens
	useEffect(() => {
		if (isOpen && chatRoom?.id) {
			setPage(1);
			setFiles([]);
			setHasMore(true);
			setCurrentArchiveIndex(0);
			setAvailableArchives([]);
			
			// Load archives first, then files
			const initializeFiles = async () => {
				await loadAvailableArchives();
				// Load files after archives are loaded
				const apiResult = await loadFilesFromAPI(1, false);
				setFiles(apiResult.fileMessages);
				setHasMore(apiResult.hasMore);
			};
			
			initializeFiles();
		}
	}, [isOpen, chatRoom?.id, loadAvailableArchives, loadFilesFromAPI]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setFiles([]);
			setPage(1);
			setHasMore(true);
			setCurrentArchiveIndex(0);
			setAvailableArchives([]);
		}
	}, [isOpen]);


	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const getFileIcon = (fileName: string) => {
		const extension = fileName.toLowerCase().split('.').pop();
		switch (extension) {
			case 'pdf':
				return <FileIcon className="w-6 h-6 text-red-500" />;
			case 'jpg':
			case 'jpeg':
			case 'png':
			case 'gif':
			case 'webp':
			case 'svg':
				return <FileIcon className="w-6 h-6 text-blue-500" />;
			case 'doc':
			case 'docx':
				return <FileIcon className="w-6 h-6 text-blue-600" />;
			case 'xls':
			case 'xlsx':
				return <FileIcon className="w-6 h-6 text-green-500" />;
			case 'zip':
			case 'rar':
			case '7z':
				return <FileIcon className="w-6 h-6 text-purple-500" />;
			default:
				return <FileIcon className="w-6 h-6 text-gray-500" />;
		}
	};

	const handleDownload = (fileUrl: string, fileName: string) => {
		const link = document.createElement('a');
		link.href = fileUrl;
		link.download = fileName;
		link.target = '_blank';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
			<div className="p-6">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
						Files
					</h2>
				</div>


				{/* Files List */}
				<div
					className="max-h-96 overflow-y-auto space-y-3"
					onScroll={handleScroll}
				>
					{isLoading ? (
						<div className="flex justify-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						</div>
					) : files.length === 0 ? (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No files found
						</div>
					) : (
						files.map((file, index) => (
							<div
								key={`${file.id}-${index}`}
								className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								{getFileIcon(file.fileName)}
								<div className="flex-1 min-w-0">
									<div className="font-medium text-gray-900 dark:text-white truncate">
										{file.fileName}
									</div>
									<div className="text-sm text-gray-500 dark:text-gray-400">
										{formatFileSize(file.fileSize)} • {new Date(file.createdAt).toLocaleDateString()}
									</div>
								</div>
								<button
									onClick={() => handleDownload(file.fileUrl, file.fileName)}
									className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
								>
									<DownloadIcon className="w-5 h-5" />
								</button>
							</div>
						))
					)}

					{/* Loading More Indicator */}
					{(isLoadingMore || isLoadingFromArchive) && (
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
