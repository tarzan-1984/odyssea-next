"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import {
	useNotifications,
	useUnreadCount,
	useNotificationsLoading,
	useLoadNotifications,
	useLoadMoreNotifications,
	useMarkAllAsRead,
	useNotificationsStore,
} from "@/stores/notificationsStore";
import { useUserStore } from "@/stores/userStore";
import { getNotificationHref } from "@/utils/offerChatUrl";
import type { Notification } from "@/app-api/notificationsApi";

// Component for notification avatar (image or initials)
function NotificationAvatar({ avatar }: { avatar?: string }) {
	const isImageUrl = avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'));
	
	if (isImageUrl) {
		return (
			<span className="relative block w-10 h-10 rounded-full overflow-hidden">
				<img
					width={40}
					height={40}
					src={avatar}
					alt="User avatar"
					className="w-full h-full object-cover"
					onError={(e) => {
						// Fallback to initials if image fails to load
						const target = e.target as HTMLImageElement;
						target.style.display = 'none';
						const parent = target.parentElement;
						if (parent) {
							parent.innerHTML = `<div class="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-full">??</div>`;
						}
					}}
				/>
			</span>
		);
	} else if (avatar && avatar.length === 2) {
		// Display as initials
		return (
			<span className="relative block w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-medium">
				{avatar}
			</span>
		);
	} else {
		// Fallback to default
		return (
			<span className="relative block w-10 h-10 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm font-medium">
				??
			</span>
		);
	}
}

// Component for individual notification item
function NotificationItem({
	notification,
	onNavigate,
}: {
	notification: Notification;
	onNavigate: (href: string) => void;
}) {
	const href = getNotificationHref(notification.type, notification.data);
	const isClickable = Boolean(href);

	const formatTime = (createdAt: string): string => {
		const date = new Date(createdAt);
		const now = new Date();
		const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

		if (diffInMinutes < 1) return 'Now';
		if (diffInMinutes < 60) return `${diffInMinutes}m`;
		if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
		if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
		
		return date.toLocaleDateString('en-US', {
			day: 'numeric',
			month: 'short',
		});
	};

	const handleClick = () => {
		if (!href) return;
		onNavigate(href);
	};

	return (
		<li>
			<div
				role={isClickable ? "button" : undefined}
				tabIndex={isClickable ? 0 : undefined}
				onClick={handleClick}
				onKeyDown={(e) => {
					if (!isClickable) return;
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleClick();
					}
				}}
				className={`flex gap-3 rounded-lg p-3 px-4.5 py-3 transition-colors ${
					isClickable
						? "cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5"
						: "cursor-default"
				} ${
					!notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
				}`}
			>
				<NotificationAvatar avatar={notification.avatar} />

				<span className="block flex-1">
					<div className="flex justify-between items-start">
						<div className="flex-1">
							<span className={`mb-1.5 space-x-1 block text-theme-sm ${
								!notification.isRead 
									? 'text-gray-800 dark:text-white/90' 
									: 'text-gray-500 dark:text-gray-400'
							}`}>
								<span className="font-medium">
									{notification.title}
								</span>
							</span>

							<span className={`block text-theme-sm mb-1.5 ${
								!notification.isRead 
									? 'text-gray-700 dark:text-gray-200' 
									: 'text-gray-500 dark:text-gray-400'
							}`}>
								{notification.message}
							</span>
						</div>

						{/* Time in the right side */}
						<span className="text-gray-500 text-theme-xs dark:text-gray-400 ml-2 flex-shrink-0">
							{formatTime(notification.createdAt)}
						</span>
					</div>
				</span>
			</div>
		</li>
	);
}

export default function NotificationDropdown() {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const notifications = useNotifications();
	const unreadCount = useUnreadCount();
	const isLoading = useNotificationsLoading();
	const loadNotifications = useLoadNotifications();
	const loadMoreNotifications = useLoadMoreNotifications();
	const markAllAsRead = useMarkAllAsRead();
	const currentUser = useUserStore(state => state.currentUser);
	const hasMore = useNotificationsStore(state => state.hasMore);

	// Deduplicate by id - same notification may arrive twice via WebSocket
	const uniqueNotifications = useMemo(
		() => notifications.filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i),
		[notifications]
	);

	function toggleDropdown() {
		setIsOpen(!isOpen);
	}

	function closeDropdown() {
		setIsOpen(false);
	}

	const handleNavigate = (href: string) => {
		closeDropdown();
		router.push(href);
	};

	const handleLoadMore = async () => {
		if (!currentUser?.id || isLoadingMore) return;
		
		setIsLoadingMore(true);
		try {
			// Load more notifications
			await loadMoreNotifications();
			
			// Mark all notifications as read after loading more
			await markAllAsRead();
		} catch (error) {
			console.error('Failed to load more notifications:', error);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const handleClick = async () => {
		if (isOpen) {
			closeDropdown();
			return;
		}

		// Open immediately; fetch the heavier notification list only on demand.
		setIsOpen(true);
		if (!currentUser?.id) return;

		try {
			await loadNotifications(1);
			// Preserve the existing behavior: opening the dropdown marks all as read.
			await markAllAsRead();
		} catch (error) {
			console.error('Failed to load notifications:', error);
		}
	};
	return (
		<div className="relative inline-flex shrink-0">
			<button
				type="button"
				className="dropdown-toggle relative flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
				onClick={handleClick}
			>
				<svg
					className="block shrink-0 overflow-visible"
					width="20"
					height="20"
					viewBox="-4 -4 128.641 130.878"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						fill="currentColor"
						d="M68.16,6.889c18.129,3.653,31.889,19.757,31.889,38.921 c0,22.594-2.146,39.585,20.592,54.716c-40.277,0-80.366,0-120.641,0C22.8,85.353,20.647,68.036,20.647,45.81 c0-19.267,13.91-35.439,32.182-38.979C53.883-2.309,67.174-2.265,68.16,6.889L68.16,6.889z M76.711,109.19 c-1.398,7.785-8.205,13.688-16.392,13.688c-8.187,0-14.992-5.902-16.393-13.688H76.711L76.711,109.19z"
					/>
				</svg>
			</button>
			{/* Badge outside the button so rounded-full never clips the icon */}
			{unreadCount > 0 && (
				<span className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
					{unreadCount > 99 ? "99+" : unreadCount}
				</span>
			)}
			<Dropdown
				isOpen={isOpen}
				onClose={closeDropdown}
				className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
			>
				<div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
					<h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
						Notifications
					</h5>
					<button
						onClick={toggleDropdown}
						className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
					>
						<svg
							className="fill-current"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
								fill="currentColor"
							/>
						</svg>
					</button>
				</div>
				<ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar space-y-2">
					{isLoading ? (
						<li className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
							Loading notifications...
						</li>
					) : notifications.length === 0 ? (
						<li className="p-6 text-center text-gray-500 dark:text-gray-400">
							<svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5v-5zM9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
							</svg>
							<p className="text-sm">No notifications</p>
						</li>
					) : (
						<>
							{uniqueNotifications.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onNavigate={handleNavigate}
								/>
							))}
							
							{/* Load More Button */}
							{hasMore && (
								<li className="mt-2">
									<button
										onClick={handleLoadMore}
										disabled={isLoadingMore}
										className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:border-gray-600"
									>
										{isLoadingMore ? (
											<div className="flex items-center justify-center">
												<div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></div>
												Loading...
											</div>
										) : (
											'Load More'
										)}
									</button>
								</li>
							)}
						</>
					)}
				</ul>
			</Dropdown>
		</div>
	);
}
