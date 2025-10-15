import { clientAuth } from '@/utils/auth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  avatar?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

class NotificationsApi {
  private baseUrl = '/api/v1/notifications';

  /**
   * Get user notifications with pagination
   */
  async getNotifications(page: number = 1, limit: number = 8): Promise<NotificationsResponse> {
    try {
      const response = await clientAuth.fetch(
        `${this.baseUrl}?page=${page}&limit=${limit}`,
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

      if (!result.success || result.data === undefined) {
        throw new Error(result.error || 'Failed to get unread count');
      }

      return result.data.unreadCount;
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
