import { NextRequest } from "next/server";
import { POST } from "../route";
import { clientAuth } from "@/utils/auth";

// Mock the clientAuth module
jest.mock("@/utils/auth", () => ({
	clientAuth: {
		getAccessToken: jest.fn(),
	},
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock NextResponse
jest.mock("next/server", () => ({
	NextRequest: jest.fn().mockImplementation((url, options) => ({
		url,
		method: options?.method || "GET",
		json: jest.fn().mockResolvedValue(JSON.parse(options?.body || "{}")),
	})),
	NextResponse: {
		json: jest.fn((data, options) => ({
			json: () => Promise.resolve(data),
			status: options?.status || 200,
		})),
	},
}));

describe("/api/chat-rooms/create", () => {
	const mockAccessToken = "mock-access-token";
	const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

	beforeEach(() => {
		jest.clearAllMocks();
		(clientAuth.getAccessToken as jest.Mock).mockReturnValue(mockAccessToken);
	});

	describe("POST", () => {
		const validRoomData = {
			name: "Test Room",
			type: "DIRECT",
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

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(validRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(mockFetch).toHaveBeenCalledWith(
				`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${mockAccessToken}`,
					},
					body: JSON.stringify(validRoomData),
				}
			);

			expect(response.status).toBe(200);
		});

		it("returns 401 when user is not authenticated", async () => {
			(clientAuth.getAccessToken as jest.Mock).mockReturnValue(null);

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(validRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(401);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when name is missing", async () => {
			const invalidData = {
				type: "DIRECT",
				loadId: "load_123",
				participantIds: ["user1"],
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when type is missing", async () => {
			const invalidData = {
				name: "Test Room",
				loadId: "load_123",
				participantIds: ["user1"],
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when loadId is missing", async () => {
			const invalidData = {
				name: "Test Room",
				type: "DIRECT",
				participantIds: ["user1"],
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when participantIds is missing", async () => {
			const invalidData = {
				name: "Test Room",
				type: "DIRECT",
				loadId: "load_123",
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when participantIds is not an array", async () => {
			const invalidData = {
				name: "Test Room",
				type: "DIRECT",
				loadId: "load_123",
				participantIds: "user1",
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when participantIds array is empty", async () => {
			const invalidData = {
				name: "Test Room",
				type: "DIRECT",
				loadId: "load_123",
				participantIds: [],
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns 400 when type is invalid", async () => {
			const invalidData = {
				name: "Test Room",
				type: "INVALID",
				loadId: "load_123",
				participantIds: ["user1"],
			};

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(invalidData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("handles backend API error response", async () => {
			const mockResponse = {
				ok: false,
				status: 409,
				json: jest.fn().mockResolvedValue({
					message: "Room name already exists",
				}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(validRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(409);
		});

		it("handles backend API error without message", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				json: jest.fn().mockResolvedValue({}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(validRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(500);
		});

		it("handles network error", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(validRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(response.status).toBe(500);
		});

		it("handles JSON parsing error", async () => {
			// Mock request.json to throw an error
			const request = {
				json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
			} as any;

			const response = await POST(request);

			expect(response.status).toBe(500);
		});

		it("accepts GROUP type", async () => {
			const groupRoomData = {
				...validRoomData,
				type: "GROUP",
			};

			const mockResponse = {
				ok: true,
				json: jest.fn().mockResolvedValue({
					data: {
						id: "room1",
						name: "Test Room",
						type: "GROUP",
						loadId: "load_123",
						participants: [],
						createdAt: "2023-01-01T00:00:00Z",
					},
				}),
			};

			mockFetch.mockResolvedValue(mockResponse as any);

			const request = new NextRequest("http://localhost:3000/api/chat-rooms/create", {
				method: "POST",
				body: JSON.stringify(groupRoomData),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const response = await POST(request);

			expect(mockFetch).toHaveBeenCalledWith(
				`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${mockAccessToken}`,
					},
					body: JSON.stringify(groupRoomData),
				}
			);

			expect(response.status).toBe(200);
		});
	});
});
