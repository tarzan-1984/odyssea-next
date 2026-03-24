"use client";
import React, { useState, useCallback } from 'react';
import { ToastNotification } from './ToastNotification';
import { SystemToastNotification, SystemToastData } from './SystemToastNotification';
import { Message, ChatRoom } from '@/app-api/chatApi';

interface ToastData {
  id: string;
  message: Message;
  chatRoom: ChatRoom;
}

export const ToastNotificationManager: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [systemToasts, setSystemToasts] = useState<SystemToastData[]>([]);

  const addToast = useCallback((message: Message, chatRoom: ChatRoom) => {
    const toastId = `${message.id}-${Date.now()}`;
    const newToast: ToastData = {
      id: toastId,
      message,
      chatRoom,
    };

    setToasts(prev => [...prev, newToast]);
  }, []);

  const addSystemToastNotification = useCallback((notification: SystemToastData) => {
    setSystemToasts(prev => {
      // Prevent duplicates - same notification may arrive twice via WebSocket
      if (prev.some(t => t.id === notification.id)) return prev;
      return [...prev, notification];
    });
  }, []);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const removeSystemToast = useCallback((toastId: string) => {
    setSystemToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  // Expose addToast and addSystemToastNotification globally for WebSocket to use
  React.useEffect(() => {
    (window as any).addToastNotification = addToast;
    (window as any).addSystemToastNotification = addSystemToastNotification;
    return () => {
      delete (window as any).addToastNotification;
      delete (window as any).addSystemToastNotification;
    };
  }, [addToast, addSystemToastNotification]);

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
      {systemToasts.map((toast, index) => (
        <div
          key={toast.id}
          className="transform transition-all duration-300 ease-in-out pointer-events-auto"
          style={{
            transform: `translateY(${(toasts.length + index) * 8}px)`,
            zIndex: 999999 - toasts.length - index,
          }}
        >
          <SystemToastNotification
            data={toast}
            onClose={() => removeSystemToast(toast.id)}
            autoCloseDelay={5000}
          />
        </div>
      ))}
    </div>
  );
};
