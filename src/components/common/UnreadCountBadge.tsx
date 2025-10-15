"use client";
import React from 'react';
import { useChatRooms } from '@/stores/chatStore';

interface UnreadCountBadgeProps {
  className?: string;
}

export const UnreadCountBadge: React.FC<UnreadCountBadgeProps> = ({ className = "" }) => {
  const chatRooms = useChatRooms();
  
  // Calculate total unread count from all chat rooms
  const totalUnreadCount = chatRooms.reduce((total, chatRoom) => {
    return total + (chatRoom.unreadCount || 0);
  }, 0);

  // Don't render if no unread messages
  if (totalUnreadCount === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-red-500 rounded-full ${className}`}
    >
      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
    </span>
  );
};
