import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { notificationsApi, Notification } from '@/app-api/notificationsApi';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  error: string | null;
}

interface NotificationsActions {
  // Actions
  loadNotifications: (page?: number) => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getUnreadCount: () => Promise<void>;
  clearNotifications: () => void;
  setError: (error: string | null) => void;
  // WebSocket actions
  addNotification: (notification: Notification) => void;
  updateUnreadCount: (unreadCount: number) => void;
}

type NotificationsStore = NotificationsState & NotificationsActions;

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  currentPage: 1,
  error: null,
};

export const useNotificationsStore = create<NotificationsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        loadNotifications: async (page: number = 1) => {
          set({ isLoading: true, error: null });

          try {
            const result = await notificationsApi.getNotifications(page, 8);

            set({
              notifications: result.notifications,
              hasMore: result.hasMore,
              currentPage: page,
              unreadCount: result.unreadCount, // Update unread count from notifications response
              isLoading: false,
            });
          } catch (error) {
            console.error('Failed to load notifications:', error);
            set({
              error: 'Failed to load notifications',
              isLoading: false,
            });
          }
        },

        loadMoreNotifications: async () => {
          const { currentPage, hasMore, isLoadingMore, notifications } = get();

          if (!hasMore || isLoadingMore) return;

          set({ isLoadingMore: true });

          try {
            const nextPage = currentPage + 1;
            const result = await notificationsApi.getNotifications(nextPage, 8);

            set({
              notifications: [...notifications, ...result.notifications],
              hasMore: result.hasMore,
              currentPage: nextPage,
              isLoadingMore: false,
            });
          } catch (error) {
            console.error('Failed to load more notifications:', error);
            set({
              error: 'Failed to load more notifications',
              isLoadingMore: false,
            });
          }
        },

        markAsRead: async (notificationId: string) => {
          try {
            await notificationsApi.markAsRead(notificationId);

            // Update local state
            const { notifications, unreadCount } = get();
            const updatedNotifications = notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, isRead: true }
                : notification
            );

            set({
              notifications: updatedNotifications,
              unreadCount: Math.max(0, unreadCount - 1),
            });
          } catch (error) {
            console.error('Failed to mark notification as read:', error);
            set({ error: 'Failed to mark notification as read' });
          }
        },

        markAllAsRead: async () => {
          try {
            await notificationsApi.markAllAsRead();

            // Update local state
            const { notifications } = get();
            const updatedNotifications = notifications.map(notification =>
              ({ ...notification, isRead: true })
            );

            set({
              notifications: updatedNotifications,
              unreadCount: 0,
            });
          } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
            set({ error: 'Failed to mark all notifications as read' });
          }
        },

        getUnreadCount: async () => {
          try {
            const count = await notificationsApi.getUnreadCount();
            set({ unreadCount: count });
          } catch (error) {
            console.error('Failed to get unread count:', error);
          }
        },

        clearNotifications: () => {
          set(initialState);
        },

        // WebSocket methods
        addNotification: (notification: any) => {
          set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
        },

        updateUnreadCount: (unreadCount: number) => {
          set({ unreadCount });
        },

        setError: (error: string | null) => {
          set({ error });
        },
      }),
      {
        name: 'notifications-store',
        partialize: (state) => ({
          unreadCount: state.unreadCount,
        }),
      }
    ),
    {
      name: 'notifications-store',
    }
  )
);

// Selectors
export const useNotifications = () => useNotificationsStore((state) => state.notifications);
export const useUnreadCount = () => useNotificationsStore((state) => state.unreadCount);
export const useNotificationsLoading = () => useNotificationsStore((state) => state.isLoading);

// Individual action selectors to avoid infinite loops
export const useLoadNotifications = () => useNotificationsStore((state) => state.loadNotifications);
export const useLoadMoreNotifications = () => useNotificationsStore((state) => state.loadMoreNotifications);
export const useMarkAsRead = () => useNotificationsStore((state) => state.markAsRead);
export const useMarkAllAsRead = () => useNotificationsStore((state) => state.markAllAsRead);
export const useGetUnreadCount = () => useNotificationsStore((state) => state.getUnreadCount);
export const useClearNotifications = () => useNotificationsStore((state) => state.clearNotifications);
export const useSetError = () => useNotificationsStore((state) => state.setError);

// WebSocket action selectors
export const useAddNotification = () => useNotificationsStore((state) => state.addNotification);
export const useUpdateUnreadCount = () => useNotificationsStore((state) => state.updateUnreadCount);
