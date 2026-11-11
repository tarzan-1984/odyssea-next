import { clientAuth } from '@/utils/auth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  avatar?: string;
  isRead: boolean; // Global read status
  readBy?: string[]; // Array of user IDs who read the notification
  createdAt: string;
  /** Deep-link metadata from backend Notification.data */
  data?: {
    chatRoomId?: string;
    chatRoomType?: string;
    loadId?: string | null;
    offerId?: number | string | null;
    unitId?: string | null;
    removedSelf?: boolean;
  } | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total?: number;
  hasMore: boolean;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

// Helper function to check if a notification is read by a specific user
export const isNotificationReadByUser = (notification: Notification, userId: string): boolean => {
  return notification.readBy?.includes(userId) || false;
};

class NotificationsApi {
  private baseUrl = '/api/v1/notifications';

  /**
   * Get user notifications with pagination
   */
  async getNotifications(page: number = 1, limit: number = 8): Promise<NotificationsResponse> {
    try {
      const response = await clientAuth.fetch(
        `${this.baseUrl}?page=${page}&limit=${limit}&includeTotal=false`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.data.success || !result.data) {
        throw new Error(result.error || 'Failed to get notifications');
      }

      return result.data.data;
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await clientAuth.fetch(`${this.baseUrl}/unread-count`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // The backend response interceptor wraps controller responses in `data`.
      // Keep this compatible with an unwrapped response as well.
      const payload = result.data?.success ? result.data : result;

      if (!payload.success || payload.data === undefined) {
        throw new Error(payload.error || 'Failed to get unread count');
      }

      return payload.data.unreadCount;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const response = await clientAuth.fetch(`${this.baseUrl}/${notificationId}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to mark notification as read');
      }

      return result.data;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const response = await clientAuth.fetch(`${this.baseUrl}/mark-all-read`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.data.success) {
        throw new Error(result.error || 'Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }
}

export const notificationsApi = new NotificationsApi();
