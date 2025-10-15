"use client";
import React, { useState, useCallback } from 'react';
import { ToastNotification } from './ToastNotification';
import { Message, ChatRoom } from '@/app-api/chatApi';

interface ToastData {
  id: string;
  message: Message;
  chatRoom: ChatRoom;
}

export const ToastNotificationManager: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: Message, chatRoom: ChatRoom) => {
    const toastId = `${message.id}-${Date.now()}`;
    const newToast: ToastData = {
      id: toastId,
      message,
      chatRoom,
    };

    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  // Expose addToast function globally for WebSocket to use
  React.useEffect(() => {
    (window as any).addToastNotification = addToast;
    return () => {
      delete (window as any).addToastNotification;
    };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[999999] space-y-2 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="transform transition-all duration-300 ease-in-out pointer-events-auto"
          style={{
            transform: `translateY(${index * 8}px)`,
            zIndex: 999999 - index,
          }}
        >
          <ToastNotification
            message={toast.message}
            chatRoom={toast.chatRoom}
            onClose={() => removeToast(toast.id)}
            autoCloseDelay={2000}
          />
        </div>
      ))}
    </div>
  );
};
