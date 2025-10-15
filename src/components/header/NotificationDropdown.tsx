"use client";
import React, { useState, useEffect, useRef } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useNotifications, useUnreadCount, useLoadNotifications, useLoadMoreNotifications, useMarkAllAsRead, useGetUnreadCount, useNotificationsStore } from "@/stores/notificationsStore";
import { useUserStore } from "@/stores/userStore";

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
function NotificationItem({ notification }: { notification: any }) {
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

	return (
		<li>
			<div
				className={`flex gap-3 rounded-lg p-3 px-4.5 py-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${
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
	const [isOpen, setIsOpen] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const notifications = useNotifications();
	const unreadCount = useUnreadCount();
	const loadNotifications = useLoadNotifications();
	const loadMoreNotifications = useLoadMoreNotifications();
	const markAllAsRead = useMarkAllAsRead();
	const getUnreadCount = useGetUnreadCount();
	const currentUser = useUserStore(state => state.currentUser);
	const hasMore = useNotificationsStore(state => state.hasMore);

	function toggleDropdown() {
		setIsOpen(!isOpen);
	}

	function closeDropdown() {
		setIsOpen(false);
	}

	const handleLoadMore = async () => {
		if (!currentUser?.id || isLoadingMore) return;
		
		setIsLoadingMore(true);
		try {
			// Load more notifications
			await loadMoreNotifications(currentUser.id);
			
			// Mark all notifications as read after loading more
			await markAllAsRead(currentUser.id);
		} catch (error) {
			console.error('Failed to load more notifications:', error);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const handleClick = async () => {
		if (!isOpen && currentUser?.id) {
			// Mark all notifications as read when opening dropdown
			try {
				await markAllAsRead(currentUser.id);
			} catch (error) {
				console.error('Failed to mark notifications as read:', error);
			}
		}
		toggleDropdown();
	};

	// Notifications are now loaded automatically by NotificationsInitializer
	// Only load more if user scrolls to bottom and there are more notifications
	useEffect(() => {
		if (isOpen && notifications.length === 0) {
			// Notifications should have been loaded on app start
		}
	}, [isOpen, notifications.length]);

	// Unread count is now loaded automatically by NotificationsInitializer
	// No need to load it here
	return (
		<div className="relative">
			<button
				className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
				onClick={handleClick}
			>
				{/* Unread notification badge */}
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
				<svg
					className="fill-current"
					width="20"
					height="20"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
						fill="currentColor"
					/>
				</svg>
			</button>
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
					{notifications.length === 0 ? (
						<li className="p-6 text-center text-gray-500 dark:text-gray-400">
							<svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5v-5zM9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
							</svg>
							<p className="text-sm">No notifications</p>
						</li>
					) : (
						<>
							{notifications.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
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
