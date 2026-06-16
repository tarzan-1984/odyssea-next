"use client";
import React, { useState, useCallback } from 'react';
import { ToastNotification } from './ToastNotification';
import { SystemToastNotification, SystemToastData } from './SystemToastNotification';
import { Message, ChatRoom } from '@/app-api/chatApi';
import {
  CHAT_TOAST_AUTO_CLOSE_MS,
  SYSTEM_TOAST_AUTO_CLOSE_MS,
  getToastContainerClass,
  getToastStackOffset,
} from '@/constants/toastNotifications';
import { useToastPositionStore } from '@/stores/toastPositionStore';

interface ToastData {
  id: string;
  message: Message;
  chatRoom: ChatRoom;
}

export const ToastNotificationManager: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [systemToasts, setSystemToasts] = useState<SystemToastData[]>([]);
  const position = useToastPositionStore(s => s.position);

  const addToast = useCallback((message: Message, chatRoom: ChatRoom) => {
    setToasts(prev => {
      // Same message may arrive twice (e.g. duplicate WebSocket delivery)
      if (prev.some(t => t.message.id === message.id)) {
        return prev;
      }
      const newToast: ToastData = {
        id: message.id,
        message,
        chatRoom,
      };
      return [...prev, newToast];
    });
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
    <div className={getToastContainerClass(position)}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="transform transition-all duration-300 ease-in-out pointer-events-auto"
          style={{
            transform: getToastStackOffset(position, index),
            zIndex: 99990 - index,
          }}
        >
          <ToastNotification
            message={toast.message}
            chatRoom={toast.chatRoom}
            onClose={() => removeToast(toast.id)}
            autoCloseDelay={CHAT_TOAST_AUTO_CLOSE_MS}
          />
        </div>
      ))}
      {systemToasts.map((toast, index) => (
        <div
          key={toast.id}
          className="transform transition-all duration-300 ease-in-out pointer-events-auto"
          style={{
            transform: getToastStackOffset(position, toasts.length + index),
            zIndex: 99990 - toasts.length - index,
          }}
        >
          <SystemToastNotification
            data={toast}
            onClose={() => removeSystemToast(toast.id)}
            autoCloseDelay={SYSTEM_TOAST_AUTO_CLOSE_MS}
          />
        </div>
      ))}
    </div>
  );
};
