import chatRooms from "../chatRooms";
import { clientAuth } from "@/utils/auth";

// Mock the clientAuth module
jest.mock("@/utils/auth", () => ({
	clientAuth: {
		getAccessToken: jest.fn(),
	},
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("chatRooms API", () => {
	const mockAccessToken = "mock-access-token";
	const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

	beforeEach(() => {
		jest.clearAllMocks();
		(clientAuth.getAccessToken as jest.Mock).mockReturnValue(mockAccessToken);
	});

	describe("createChatRoom", () => {
		const mockRoomData = {
			name: "Test Room",
			type: "DIRECT" as const,
			loadId: "load_123",
			participantIds: ["user1", "user2"],
		};

		it("creates chat room successfully", async () => {
			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					data: {
						id: "room1",
						name: "Test Room",
						type: "DIRECT",
						loadId: "load_123",
						participants: [],
						createdAt: "2023-01-01T00:00:00Z",
					},
				}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const result = await chatRooms.createChatRoom(mockRoomData);

			expect(mockFetch).toHaveBeenCalledWith("/api/chat-rooms/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockAccessToken}`,
				},
				body: JSON.stringify(mockRoomData),
			});

			expect(result).toEqual({
				success: true,
				data: {
					id: "room1",
					name: "Test Room",
					type: "DIRECT",
					loadId: "load_123",
					participants: [],
					createdAt: "2023-01-01T00:00:00Z",
				},
			});
		});

		it("handles authentication error", async () => {
			(clientAuth.getAccessToken as jest.Mock).mockReturnValue(null);

			const result = await chatRooms.createChatRoom(mockRoomData);

			expect(result).toEqual({
				success: false,
				error: "Authentication required",
			});

			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("handles API error response", async () => {
			const mockResponse = {
				ok: false,
				json: jest.fn().mockResolvedValue({
					error: "Room name already exists",
				}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const result = await chatRooms.createChatRoom(mockRoomData);

			expect(result).toEqual({
				success: false,
				error: "Room name already exists",
			});
		});

		it("handles network error", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const result = await chatRooms.createChatRoom(mockRoomData);

			expect(result).toEqual({
				success: false,
				error: "Network error occurred",
			});
		});

		it("handles missing error message in response", async () => {
			const mockResponse = {
				ok: false,
				json: jest.fn().mockResolvedValue({}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const result = await chatRooms.createChatRoom(mockRoomData);

			expect(result).toEqual({
				success: false,
				error: "Failed to create chat room",
			});
		});
	});

	describe("getUsers", () => {
		it("fetches users successfully", async () => {
			const mockUsersResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					data: {
						data: {
							users: [
								{
									id: "user1",
									email: "user1@example.com",
									user: {
										name: "John Doe",
										role: "user",
										image: "avatar1.jpg",
									},
								},
								{
									id: "user2",
									email: "user2@example.com",
									user: {
										name: "Jane Smith",
										role: "admin",
										image: "avatar2.jpg",
									},
								},
							],
						},
					},
				}),
			};

			mockFetch.mockResolvedValue(mockUsersResponse as any);

			const result = await chatRooms.getUsers();

			expect(mockFetch).toHaveBeenCalledWith("/api/users/list", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${mockAccessToken}`,
				},
				body: JSON.stringify({
					page: 1,
					limit: 100,
				}),
			});

			expect(result).toEqual({
				success: true,
				data: {
					users: [
						{
							id: "user1",
							email: "user1@example.com",
							firstName: "John",
							lastName: "Doe",
							role: "user",
							status: "active",
							avatar: "avatar1.jpg",
						},
						{
							id: "user2",
							email: "user2@example.com",
							firstName: "Jane",
							lastName: "Smith",
							role: "admin",
							status: "active",
							avatar: "avatar2.jpg",
						},
					],
				},
			});
		});

		it("handles authentication error", async () => {
			(clientAuth.getAccessToken as jest.Mock).mockReturnValue(null);

			const result = await chatRooms.getUsers();

			expect(result).toEqual({
				success: false,
				error: "Authentication required",
			});

			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("handles API error response", async () => {
			const mockResponse = {
				ok: false,
				json: jest.fn().mockResolvedValue({
					error: "Failed to fetch users",
				}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const result = await chatRooms.getUsers();

			expect(result).toEqual({
				success: false,
				error: "Failed to fetch users",
			});
		});

		it("handles network error", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const result = await chatRooms.getUsers();

			expect(result).toEqual({
				success: false,
				error: "Network error occurred",
			});
		});

		it("handles missing error message in response", async () => {
			const mockResponse = {
				ok: false,
				json: jest.fn().mockResolvedValue({}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const result = await chatRooms.getUsers();

			expect(result).toEqual({
				success: false,
				error: "Failed to fetch users",
			});
		});

		it("handles users with single name correctly", async () => {
			const mockUsersResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					data: {
						data: {
							users: [
								{
									id: "user1",
									email: "user1@example.com",
									user: {
										name: "John",
										role: "user",
										image: "avatar1.jpg",
									},
								},
							],
						},
					},
				}),
			};

			mockFetch.mockResolvedValue(mockUsersResponse as any);

			const result = await chatRooms.getUsers();

			expect(result.data?.users[0]).toEqual({
				id: "user1",
				email: "user1@example.com",
				firstName: "John",
				lastName: "",
				role: "user",
				status: "active",
				avatar: "avatar1.jpg",
			});
		});

		it("handles users with multiple name parts correctly", async () => {
			const mockUsersResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					data: {
						data: {
							users: [
								{
									id: "user1",
									email: "user1@example.com",
									user: {
										name: "John Michael Doe",
										role: "user",
										image: "avatar1.jpg",
									},
								},
							],
						},
					},
				}),
			};

			mockFetch.mockResolvedValue(mockUsersResponse as any);

			const result = await chatRooms.getUsers();

			expect(result.data?.users[0]).toEqual({
				id: "user1",
				email: "user1@example.com",
				firstName: "John",
				lastName: "Michael Doe",
				role: "user",
				status: "active",
				avatar: "avatar1.jpg",
			});
		});
	});
});
