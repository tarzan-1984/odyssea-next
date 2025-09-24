import { NextRequest } from "next/server";
import { POST } from "../login/route";

// Mock environment variables
const mockEnv = {
	NEXT_PUBLIC_BACKEND_URL: "http://localhost:3001",
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock Request for Node.js environment
// This will be handled in jest.setup.js

// Mock the token encoder
jest.mock("@/utils/tokenEncoder", () => ({
	tokenEncoder: {
		encode: jest.fn(value => `encoded_${value}`),
	},
}));

// Mock the utils
jest.mock("@/utils", () => ({
	isValidEmail: jest.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

import { tokenEncoder } from "@/utils/tokenEncoder";
import { isValidEmail } from "@/utils";

describe("POST /api/authentication/login", () => {
	const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
	const mockTokenEncoder = tokenEncoder;
	const mockIsValidEmail = isValidEmail;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.NEXT_PUBLIC_BACKEND_URL = mockEnv.NEXT_PUBLIC_BACKEND_URL;
	});

	it("successfully logs in user with valid credentials", async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			json: jest.fn().mockResolvedValue({
				success: true,
				data: {
					accessToken: "test-access-token",
					refreshToken: "test-refresh-token",
					user: {
						id: "123",
						email: "test@example.com",
						name: "Test User",
					},
				},
			}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		// Check if fetch was called with correct parameters
		expect(mockFetch).toHaveBeenCalledWith(`${mockEnv.NEXT_PUBLIC_BACKEND_URL}/v1/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		// Check if tokens were encoded
		expect(mockTokenEncoder.encode).toHaveBeenCalledWith("test-access-token");
		expect(mockTokenEncoder.encode).toHaveBeenCalledWith("test-refresh-token");

		// Check response
		expect(response.status).toBe(200);
		expect(data.data.accessToken).toBe("encoded_test-access-token");
		expect(data.data.refreshToken).toBe("encoded_test-refresh-token");
	});

	it("returns 400 error when email is missing", async () => {
		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Missing required fields");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns 400 error when password is missing", async () => {
		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Missing required fields");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns 400 error when both email and password are missing", async () => {
		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Missing required fields");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("returns 400 error for invalid email format", async () => {
		mockIsValidEmail.mockReturnValue(false);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "invalid-email",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid email format");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("handles backend authentication failure", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			json: jest.fn().mockResolvedValue({
				message: "Invalid credentials",
			}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "wrongpassword",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toBe("Invalid credentials");
		expect(mockTokenEncoder.encode).not.toHaveBeenCalled();
	});

	it("handles backend server error", async () => {
		const mockResponse = {
			ok: false,
			status: 500,
			json: jest.fn().mockResolvedValue({
				message: "Internal server error",
			}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe("Internal server error");
		expect(mockTokenEncoder.encode).not.toHaveBeenCalled();
	});

	it("handles backend response without message", async () => {
		const mockResponse = {
			ok: false,
			status: 400,
			json: jest.fn().mockResolvedValue({}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Failed to login");
		expect(mockTokenEncoder.encode).not.toHaveBeenCalled();
	});

	it("handles network errors gracefully", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe("Internal server error");
		expect(mockTokenEncoder.encode).not.toHaveBeenCalled();
	});

	it("handles response without access token", async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			json: jest.fn().mockResolvedValue({
				success: true,
				data: {
					refreshToken: "test-refresh-token",
					user: {
						id: "123",
						email: "test@example.com",
					},
				},
			}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.data.accessToken).toBeUndefined();
		expect(data.data.refreshToken).toBe("encoded_test-refresh-token");
		expect(mockTokenEncoder.encode).toHaveBeenCalledTimes(1);
	});

	it("handles response without refresh token", async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			json: jest.fn().mockResolvedValue({
				success: true,
				data: {
					accessToken: "test-access-token",
					user: {
						id: "123",
						email: "test@example.com",
					},
				},
			}),
		};

		mockFetch.mockResolvedValue(mockResponse as any);

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.data.accessToken).toBe("encoded_test-access-token");
		expect(data.data.refreshToken).toBeUndefined();
		expect(mockTokenEncoder.encode).toHaveBeenCalledTimes(1);
	});

	it("handles malformed JSON in request body", async () => {
		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: "invalid-json",
		});

		const response = await POST(request);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe("Internal server error");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("logs error to console when exception occurs", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation();
		mockFetch.mockRejectedValue(new Error("Test error"));

		const request = new NextRequest("http://localhost:3000/api/authentication/login", {
			method: "POST",
			body: JSON.stringify({
				email: "test@example.com",
				password: "password123",
			}),
		});

		await POST(request);

		expect(consoleSpy).toHaveBeenCalledWith("Error during login:", expect.any(Error));
		consoleSpy.mockRestore();
	});
});
