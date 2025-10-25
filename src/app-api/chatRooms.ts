import { CreateChatRoomData, CreateChatRoomResponse, GetUsersResponse } from "./api-types";

/**
 * Chat Rooms API functions for chat room management operations
 * Handles creating chat rooms and fetching users for participant selection
 * All functions require JWT authentication
 */
const chatRooms = {
	/**
	 * Creates a new chat room with specified participants
	 * @param roomData - Chat room data including name, type, loadId, and participant IDs
	 * @returns Promise with chat room creation result
	 */
    async createChatRoom(roomData: CreateChatRoomData): Promise<CreateChatRoomResponse> {
		try {
			const response = await fetch("/api/chat-rooms/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
                body: JSON.stringify(roomData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to create chat room",
				};
			}

			return {
				success: true,
				data: data.data,
			};
		} catch (error) {
			console.error("Error in createChatRoom:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Retrieves list of users for participant selection
	 * @returns Promise with users list for chat room creation
	 */
	async getUsers(): Promise<GetUsersResponse> {
		try {
			const response = await fetch("/api/users/list", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify({
					page: 1,
					limit: 100, // Get more users for selection
					status: "ACTIVE", // Only show active users for chat creation
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to fetch users",
				};
			}

			return {
				success: true,
				data: {
					users: data.data.data.users.map(
						(user: {
							id: string;
							email: string;
							user: { name: string; role: string; image?: string };
						}) => ({
							id: user.id,
							email: user.email,
							firstName: user.user.name.split(" ")[0] || "",
							lastName: user.user.name.split(" ").slice(1).join(" ") || "",
							role: user.user.role,
							status: "active",
							avatar: user.user.image || "",
						})
					),
				},
			};
		} catch (error) {
			console.error("Error in getUsers:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},
};

export default chatRooms;
