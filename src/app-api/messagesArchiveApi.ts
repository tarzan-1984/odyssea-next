import { clientAuth } from '@/utils/auth';

export interface ArchiveMessage {
  id: string;
  content: string;
  senderId: string;
  chatRoomId: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ArchiveFile {
  chatRoomId: string;
  year: number;
  month: number;
  messages: ArchiveMessage[];
  totalCount: number;
  createdAt: string;
}

export interface ArchiveDay {
  year: number;
  month: number;
  day: number;
  messageCount: number;
  createdAt: string;
}

export interface ArchiveApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class MessagesArchiveApi {
  private baseUrl = '/api/v1/messages/archive';

  /**
   * Get available archive days for a chat room
   */
  async getAvailableArchiveDays(chatRoomId: string): Promise<ArchiveDay[]> {
    try {
      const response = await clientAuth.fetch(`${this.baseUrl}/chat-rooms/${chatRoomId}/days`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // The actual API response is nested under result.data
      const apiData = result.data;

      if (!apiData || !apiData.success || !apiData.data.availableDays) {
        throw new Error(apiData?.error || 'Failed to get available archive days');
      }

      return apiData.data.availableDays;
    } catch (error) {
      console.error('Failed to get available archive days:', error);
      throw error;
    }
  }

  /**
   * Load archived messages for a specific day
   */
  async loadArchivedMessages(
    chatRoomId: string,
    year: number,
    month: number,
    day: number,
  ): Promise<ArchiveFile> {
    try {
      const response = await clientAuth.fetch(
        `${this.baseUrl}/chat-rooms/${chatRoomId}/${year}/${month}/${day}`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📋 [ARCHIVE API] Raw Response for loadArchivedMessages:', result);

      // Parse the nested response structure from Next.js API route
      const apiResponseData = result.data;

      if (!apiResponseData || !apiResponseData.success || !apiResponseData.data.messages) {
        throw new Error(apiResponseData.error || 'Failed to load archived messages: Invalid response structure');
      }

      return apiResponseData.data;
    } catch (error) {
      console.error('Failed to load archived messages:', error);
      throw error;
    }
  }

  /**
   * Check if archived messages exist for a specific day
   */
  async checkArchivedMessagesExists(
    chatRoomId: string,
    year: number,
    month: number,
    day: number,
  ): Promise<boolean> {
    try {
      const response = await clientAuth.fetch(
        `${this.baseUrl}/chat-rooms/${chatRoomId}/${year}/${month}/${day}/exists`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ArchiveApiResponse<{ exists: boolean }> = await response.json();

      if (!result.success || result.data === undefined) {
        throw new Error(result.error || 'Failed to check archived messages existence');
      }

      return result.data.exists;
    } catch (error) {
      console.error('Failed to check archived messages existence:', error);
      return false;
    }
  }
}

export const messagesArchiveApi = new MessagesArchiveApi();
