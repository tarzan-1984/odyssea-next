import { Message, ChatRoom } from "@/app-api/chatApi";

// IndexedDB database configuration
const DB_NAME = "OdysseaChatDB";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const CHAT_ROOMS_STORE = "chatRooms";

// Interface for stored message with additional metadata
interface StoredMessage extends Message {
	// Add timestamp for cache management
	cachedAt: number;
	// Add version for potential future migrations
	version: number;
}

// Interface for stored chat room with additional metadata
interface StoredChatRoom extends ChatRoom {
	// Add timestamp for cache management
	cachedAt: number;
	// Add version for potential future migrations
	version: number;
}

class IndexedDBChatService {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<void> | null = null;

	// Initialize IndexedDB database
	private async init(): Promise<void> {
		if (this.db) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				console.error("Failed to open IndexedDB:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = event => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create messages store
				if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
					const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
					// Create index for chat room ID for efficient querying
					messagesStore.createIndex("chatRoomId", "chatRoomId", { unique: false });
					// Create index for creation time for sorting
					messagesStore.createIndex("createdAt", "createdAt", { unique: false });
					// Create compound index for chat room + creation time
					messagesStore.createIndex("chatRoomId_createdAt", ["chatRoomId", "createdAt"], {
						unique: false,
					});
				}

				// Create chat rooms store
				if (!db.objectStoreNames.contains(CHAT_ROOMS_STORE)) {
					const chatRoomsStore = db.createObjectStore(CHAT_ROOMS_STORE, {
						keyPath: "id",
					});
					// Create index for last message time for sorting
					chatRoomsStore.createIndex("updatedAt", "updatedAt", { unique: false });
				}
			};
		});

		return this.initPromise;
	}

	// Ensure database is initialized before any operation
	private async ensureDB(): Promise<IDBDatabase> {
		await this.init();
		if (!this.db) {
			throw new Error("IndexedDB not initialized");
		}
		return this.db;
	}

	// Messages operations
	async saveMessages(chatRoomId: string, messages: Message[]): Promise<void> {
		try {
			// Check if we already have messages for this chat room
			const hasExistingMessages = await this.hasMessages(chatRoomId);
			const existingCount = await this.getMessageCount(chatRoomId);

			// If we have the same or more messages, skip saving
			if (hasExistingMessages && existingCount >= messages.length) {
				return;
			}

			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readwrite");
			const store = transaction.objectStore(MESSAGES_STORE);

			// Convert messages to stored format
			const storedMessages: StoredMessage[] = messages.map(message => ({
				...message,
				cachedAt: Date.now(),
				version: 1,
			}));

			// Save each message
			for (const message of storedMessages) {
				await new Promise<void>((resolve, reject) => {
					const request = store.put(message);
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				});
			}

			//console.log(`Saved ${messages.length} messages for chat room ${chatRoomId}`);

			// Cleanup old messages to prevent cache from growing too large
			await this.cleanupOldMessages(chatRoomId);
		} catch (error) {
			console.error("Failed to save messages to IndexedDB:", error);
			throw error;
		}
	}

	async getMessages(chatRoomId: string, limit?: number, offset?: number): Promise<Message[]> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readonly");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId_createdAt");

			return new Promise((resolve, reject) => {
				const request = index.getAll(
					IDBKeyRange.bound([chatRoomId, ""], [chatRoomId, "\uffff"])
				);

				request.onsuccess = () => {
					let messages = request.result as StoredMessage[];

					// Sort by creation time (oldest first - newest at bottom)
					messages.sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);


					// Apply pagination if specified
					// For chat messages, we want the LATEST messages (reverse order)
					if (limit) {
						// Take the last N messages (most recent)
						messages = messages.slice(-limit);
					}
					if (offset) {
						// Apply offset from the beginning of the limited set
						messages = messages.slice(offset);
					}

					// Convert back to Message format (remove cache metadata)
					const result: Message[] = messages.map(
						({ cachedAt, version, ...message }) => message
					);


					resolve(result);
				};

				request.onerror = () => {
					console.error("Failed to get messages from IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to get messages from IndexedDB:", error);
			return [];
		}
	}

	// Check if messages exist in cache for a chat room
	async hasMessages(chatRoomId: string): Promise<boolean> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readonly");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId_createdAt");

			return new Promise((resolve, reject) => {
				const request = index.count(
					IDBKeyRange.bound([chatRoomId, ""], [chatRoomId, "\uffff"])
				);
				request.onsuccess = () => {
					const count = request.result;
					resolve(count > 0);
				};
				request.onerror = () => {
					console.error("Failed to check messages in IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to check messages in IndexedDB:", error);
			return false;
		}
	}

	// Get message count for a chat room
	async getMessageCount(chatRoomId: string): Promise<number> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readonly");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId_createdAt");

			return new Promise((resolve, reject) => {
				const request = index.count(
					IDBKeyRange.bound([chatRoomId, ""], [chatRoomId, "\uffff"])
				);
				request.onsuccess = () => {
					resolve(request.result);
				};
				request.onerror = () => {
					console.error("Failed to get message count from IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to get message count from IndexedDB:", error);
			return 0;
		}
	}

	async addMessage(message: Message): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readwrite");
			const store = transaction.objectStore(MESSAGES_STORE);

			const storedMessage: StoredMessage = {
				...message,
				cachedAt: Date.now(),
				version: 1,
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put(storedMessage);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

		} catch (error) {
			console.error("Failed to add message to IndexedDB:", error);
			throw error;
		}
	}

	async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readwrite");
			const store = transaction.objectStore(MESSAGES_STORE);

			// Get existing message
			const getRequest = store.get(messageId);

			await new Promise<void>((resolve, reject) => {
				getRequest.onsuccess = () => {
					const existingMessage = getRequest.result as StoredMessage;
					if (existingMessage) {
						// Update the message
						const updatedMessage: StoredMessage = {
							...existingMessage,
							...updates,
							cachedAt: Date.now(),
						};

						const putRequest = store.put(updatedMessage);
						putRequest.onsuccess = () => resolve();
						putRequest.onerror = () => reject(putRequest.error);
					} else {
						reject(new Error("Message not found"));
					}
				};
				getRequest.onerror = () => reject(getRequest.error);
			});

			console.log(`Updated message ${messageId} in IndexedDB`);
		} catch (error) {
			console.error("Failed to update message in IndexedDB:", error);
			throw error;
		}
	}

	async deleteMessages(chatRoomId: string): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readwrite");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId");

			// Get all message IDs for this chat room
			const request = index.getAllKeys(chatRoomId);

			await new Promise<void>((resolve, reject) => {
				request.onsuccess = () => {
					const messageIds = request.result;

					// Delete each message
					let deletedCount = 0;
					if (messageIds.length === 0) {
						resolve();
						return;
					}

					messageIds.forEach(messageId => {
						const deleteRequest = store.delete(messageId);
						deleteRequest.onsuccess = () => {
							deletedCount++;
							if (deletedCount === messageIds.length) {
								resolve();
							}
						};
						deleteRequest.onerror = () => reject(deleteRequest.error);
					});
				};
				request.onerror = () => reject(request.error);
			});

			//console.log(`Deleted messages for chat room ${chatRoomId}`);
		} catch (error) {
			console.error("Failed to delete messages from IndexedDB:", error);
			throw error;
		}
	}

	// Chat rooms operations
    async saveChatRooms(chatRooms: ChatRoom[]): Promise<void> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction([CHAT_ROOMS_STORE], "readwrite");
            const store = transaction.objectStore(CHAT_ROOMS_STORE);

            // Полная замена списка комнат: сначала очищаем, затем сохраняем новый список,
            // чтобы не оставались комнаты, которых уже нет на сервере
            await new Promise<void>((resolve, reject) => {
                const clearReq = store.clear();
                clearReq.onsuccess = () => resolve();
                clearReq.onerror = () => reject(clearReq.error);
            });

            // Convert chat rooms to stored format
            const storedChatRooms: StoredChatRoom[] = chatRooms.map(chatRoom => ({
                ...chatRoom,
                cachedAt: Date.now(),
                version: 1,
            }));

            // Save each chat room
            for (const chatRoom of storedChatRooms) {
                await new Promise<void>((resolve, reject) => {
                    const request = store.put(chatRoom);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            console.log(`Saved ${chatRooms.length} chat rooms to IndexedDB`);
        } catch (error) {
            console.error("Failed to save chat rooms to IndexedDB:", error);
            throw error;
        }
    }

	async getChatRooms(): Promise<ChatRoom[]> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readonly");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			return new Promise((resolve, reject) => {
				const request = store.getAll();

				request.onsuccess = () => {
					const storedChatRooms = request.result as StoredChatRoom[];

					// Sort by updated time (newest first)
					storedChatRooms.sort(
						(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
					);

					// Convert back to ChatRoom format (remove cache metadata)
					const result: ChatRoom[] = storedChatRooms.map(
						({ cachedAt, version, ...chatRoom }) => chatRoom
					);
					resolve(result);
				};

				request.onerror = () => {
					console.error("Failed to get chat rooms from IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to get chat rooms from IndexedDB:", error);
			return [];
		}
	}

	// Check if chat rooms exist in cache
	async hasChatRooms(): Promise<boolean> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readonly");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			return new Promise((resolve, reject) => {
				const request = store.count();
				request.onsuccess = () => {
					resolve(request.result > 0);
				};
				request.onerror = () => {
					console.error("Failed to check chat rooms in IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to check chat rooms in IndexedDB:", error);
			return false;
		}
	}

	// Delete a specific chat room from cache
	async deleteChatRoom(chatRoomId: string): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			await new Promise<void>((resolve, reject) => {
				const request = store.delete(chatRoomId);
				request.onsuccess = () => {
					console.log(`Deleted chat room ${chatRoomId} from IndexedDB`);
					resolve();
				};
				request.onerror = () => {
					console.error("Failed to delete chat room from IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to delete chat room from IndexedDB:", error);
			throw error;
		}
	}

	// Get chat rooms count
	async getChatRoomsCount(): Promise<number> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readonly");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			return new Promise((resolve, reject) => {
				const request = store.count();
				request.onsuccess = () => {
					resolve(request.result);
				};
				request.onerror = () => {
					console.error("Failed to get chat rooms count from IndexedDB:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to get chat rooms count from IndexedDB:", error);
			return 0;
		}
	}

	// Check if cache is fresh (less than specified minutes old)
	async isCacheFresh(storeName: string, maxAgeMinutes: number = 5): Promise<boolean> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([storeName], "readonly");
			const store = transaction.objectStore(storeName);

			return new Promise((resolve, reject) => {
				const request = store.getAll();

				request.onsuccess = () => {
					const items = request.result as Array<{ cachedAt: number }>;
					if (items.length === 0) {
						resolve(false);
						return;
					}

					const now = Date.now();
					const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
					const isFresh = items.some(item => now - item.cachedAt < maxAge);
					resolve(isFresh);
				};

				request.onerror = () => {
					console.error("Failed to check cache freshness:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to check cache freshness:", error);
			return false;
		}
	}

	// Check if messages cache is fresh for a specific chat room
	async isMessagesCacheFresh(chatRoomId: string, maxAgeMinutes: number = 2): Promise<boolean> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readonly");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId_createdAt");

			return new Promise((resolve, reject) => {
				const request = index.getAll(
					IDBKeyRange.bound([chatRoomId, ""], [chatRoomId, "\uffff"])
				);

				request.onsuccess = () => {
					const messages = request.result as StoredMessage[];
					if (messages.length === 0) {
						resolve(false);
						return;
					}

					const now = Date.now();
					const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
					// Check if the most recent message is fresh (newest at bottom after sorting)
					messages.sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
					const mostRecentMessage = messages[messages.length - 1]; // Last message is newest
					const isFresh = mostRecentMessage && now - mostRecentMessage.cachedAt < maxAge;
					resolve(isFresh);
				};

				request.onerror = () => {
					console.error("Failed to check messages cache freshness:", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to check messages cache freshness:", error);
			return false;
		}
	}

	async addChatRoom(chatRoom: ChatRoom): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			const storedChatRoom: StoredChatRoom = {
				...chatRoom,
				cachedAt: Date.now(),
				version: 1,
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put(storedChatRoom);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			console.log(`Added chat room ${chatRoom.id} to IndexedDB`);
		} catch (error) {
			console.error("Failed to add chat room to IndexedDB:", error);
			throw error;
		}
	}

	async updateChatRoom(chatRoomId: string, updates: Partial<ChatRoom>): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([CHAT_ROOMS_STORE], "readwrite");
			const store = transaction.objectStore(CHAT_ROOMS_STORE);

			// Get existing chat room
			const getRequest = store.get(chatRoomId);

			await new Promise<void>((resolve, reject) => {
				getRequest.onsuccess = () => {
					const existingChatRoom = getRequest.result as StoredChatRoom;
					if (existingChatRoom) {
						// Update the chat room
						const updatedChatRoom: StoredChatRoom = {
							...existingChatRoom,
							...updates,
							cachedAt: Date.now(),
						};

						const putRequest = store.put(updatedChatRoom);
						putRequest.onsuccess = () => resolve();
						putRequest.onerror = () => reject(putRequest.error);
					} else {
						reject(new Error("Chat room not found"));
					}
				};
				getRequest.onerror = () => reject(getRequest.error);
			});

			console.log(`Updated chat room ${chatRoomId} in IndexedDB`);
		} catch (error) {
			console.error("Failed to update chat room in IndexedDB:", error);
			throw error;
		}
	}

	// Clear old messages (keep only last 1000 messages per chat room)
	async cleanupOldMessages(chatRoomId: string, keepCount: number = 1000): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([MESSAGES_STORE], "readwrite");
			const store = transaction.objectStore(MESSAGES_STORE);
			const index = store.index("chatRoomId_createdAt");

			// Get all messages for this chat room, sorted by creation time (oldest first)
			const allMessages = await new Promise<StoredMessage[]>((resolve, reject) => {
				const request = index.getAll(
					IDBKeyRange.bound([chatRoomId, ""], [chatRoomId, "\uffff"])
				);
				request.onsuccess = () => {
					const messages = request.result as StoredMessage[];
					// Sort by creation time (oldest first)
					messages.sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
					resolve(messages);
				};
				request.onerror = () => reject(request.error);
			});

			// If we have more messages than keepCount, delete the oldest ones (from the beginning)
			if (allMessages.length > keepCount) {
				const messagesToDelete = allMessages.slice(0, allMessages.length - keepCount);
				console.log(
					`Cleaning up ${messagesToDelete.length} old messages for chat room ${chatRoomId}`
				);

				for (const message of messagesToDelete) {
					await new Promise<void>((resolve, reject) => {
						const request = store.delete(message.id);
						request.onsuccess = () => resolve();
						request.onerror = () => reject(request.error);
					});
				}
			}
		} catch (error) {
			console.error("Failed to cleanup old messages:", error);
			throw error;
		}
	}

	// Cache management operations
	async clearCache(): Promise<void> {
		try {
			const db = await this.ensureDB();

			// Clear messages
			const messagesTransaction = db.transaction([MESSAGES_STORE], "readwrite");
			const messagesStore = messagesTransaction.objectStore(MESSAGES_STORE);
			await new Promise<void>((resolve, reject) => {
				const request = messagesStore.clear();
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			// Clear chat rooms
			const chatRoomsTransaction = db.transaction([CHAT_ROOMS_STORE], "readwrite");
			const chatRoomsStore = chatRoomsTransaction.objectStore(CHAT_ROOMS_STORE);
			await new Promise<void>((resolve, reject) => {
				const request = chatRoomsStore.clear();
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			console.log("Cleared all cache from IndexedDB");
		} catch (error) {
			console.error("Failed to clear cache from IndexedDB:", error);
			throw error;
		}
	}

	async getCacheSize(): Promise<{ messages: number; chatRooms: number }> {
		try {
			const db = await this.ensureDB();

			// Count messages
			const messagesTransaction = db.transaction([MESSAGES_STORE], "readonly");
			const messagesStore = messagesTransaction.objectStore(MESSAGES_STORE);
			const messagesCount = await new Promise<number>((resolve, reject) => {
				const request = messagesStore.count();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			// Count chat rooms
			const chatRoomsTransaction = db.transaction([CHAT_ROOMS_STORE], "readonly");
			const chatRoomsStore = chatRoomsTransaction.objectStore(CHAT_ROOMS_STORE);
			const chatRoomsCount = await new Promise<number>((resolve, reject) => {
				const request = chatRoomsStore.count();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});

			return { messages: messagesCount, chatRooms: chatRoomsCount };
		} catch (error) {
			console.error("Failed to get cache size from IndexedDB:", error);
			return { messages: 0, chatRooms: 0 };
		}
	}

}

// Export singleton instance
export const indexedDBChatService = new IndexedDBChatService();
