import Cookies from "js-cookie";
import { clientAuth } from "../auth";

// Mock js-cookie
jest.mock("js-cookie", () => ({
	get: jest.fn(),
	set: jest.fn(),
	remove: jest.fn(),
}));

// Mock the token encoder
jest.mock("../tokenEncoder", () => ({
	tokenEncoder: {
		encode: jest.fn(value => `encoded_${value}`),
		decode: jest.fn(value => value.replace("encoded_", "")),
	},
}));

import { tokenEncoder } from "../tokenEncoder";

describe("clientAuth", () => {
	const mockCookies = Cookies as jest.Mocked<typeof Cookies>;
	const mockTokenEncoder = tokenEncoder;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("setAccessToken", () => {
		it("sets access token with correct parameters", () => {
			const token = "test-access-token";

			clientAuth.setAccessToken(token);

			expect(mockCookies.set).toHaveBeenCalledWith("accessToken", token, {
				expires: 7,
				sameSite: "strict",
				secure: true,
			});
		});
	});

	describe("setRefreshToken", () => {
		it("sets refresh token with correct parameters", () => {
			const token = "test-refresh-token";

			clientAuth.setRefreshToken(token);

			expect(mockCookies.set).toHaveBeenCalledWith("refreshToken", token, {
				expires: 30,
				sameSite: "strict",
				secure: true,
			});
		});
	});

	describe("setTokens", () => {
		it("sets both access and refresh tokens", () => {
			const accessToken = "test-access-token";
			const refreshToken = "test-refresh-token";

			clientAuth.setTokens(accessToken, refreshToken);

			expect(mockCookies.set).toHaveBeenCalledTimes(2);
			expect(mockCookies.set).toHaveBeenCalledWith("accessToken", accessToken, {
				expires: 7,
				sameSite: "strict",
				secure: true,
			});
			expect(mockCookies.set).toHaveBeenCalledWith("refreshToken", refreshToken, {
				expires: 30,
				sameSite: "strict",
				secure: true,
			});
		});
	});

	describe("setUserData", () => {
		it("encodes and sets user data in cookie", () => {
			const userData = {
				id: "123",
				email: "test@example.com",
				firstName: "John",
				lastName: "Doe",
				role: "user",
				status: "active",
				avatar: "avatar.jpg",
			};

			clientAuth.setUserData(userData);

			expect(mockTokenEncoder.encode).toHaveBeenCalledWith(JSON.stringify(userData));
			expect(mockCookies.set).toHaveBeenCalledWith(
				"userData",
				`encoded_${JSON.stringify(userData)}`,
				{
					expires: 30,
					sameSite: "strict",
					secure: true,
				}
			);
		});
	});

	describe("getUserData", () => {
		it("retrieves and decodes user data successfully", () => {
			const userData = {
				id: "123",
				email: "test@example.com",
				firstName: "John",
				lastName: "Doe",
				role: "user",
				status: "active",
				avatar: "avatar.jpg",
			};

			const encodedData = `encoded_${JSON.stringify(userData)}`;
			mockCookies.get.mockReturnValue(encodedData);

			const result = clientAuth.getUserData();

			expect(mockCookies.get).toHaveBeenCalledWith("userData");
			expect(mockTokenEncoder.decode).toHaveBeenCalledWith(encodedData);
			expect(result).toEqual(userData);
		});

		it("returns null when no user data cookie exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.getUserData();

			expect(result).toBeNull();
			expect(mockTokenEncoder.decode).not.toHaveBeenCalled();
		});

		it("returns null when decoding fails", () => {
			mockCookies.get.mockReturnValue("invalid-encoded-data");
			mockTokenEncoder.decode.mockImplementation(() => {
				throw new Error("Decoding failed");
			});

			const consoleSpy = jest.spyOn(console, "error").mockImplementation();

			const result = clientAuth.getUserData();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to decrypt user data:",
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it("returns null when parsed data is invalid JSON", () => {
			mockCookies.get.mockReturnValue("encoded_invalid-json");
			mockTokenEncoder.decode.mockReturnValue("invalid-json");

			const consoleSpy = jest.spyOn(console, "error").mockImplementation();

			const result = clientAuth.getUserData();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to decrypt user data:",
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});
	});

	describe("removeUserData", () => {
		it("removes user data cookie", () => {
			clientAuth.removeUserData();

			expect(mockCookies.remove).toHaveBeenCalledWith("userData");
		});
	});

	describe("setLoginSuccess", () => {
		it("sets temporary login success cookie with correct parameters", () => {
			const email = "test@example.com";

			clientAuth.setLoginSuccess(email);

			expect(mockCookies.set).toHaveBeenCalledWith("login-success", email, {
				expires: 1 / 24, // 1 hour
				sameSite: "strict",
				secure: true,
			});
		});
	});

	describe("getLoginSuccess", () => {
		it("retrieves login success cookie value", () => {
			const email = "test@example.com";
			mockCookies.get.mockReturnValue(email);

			const result = clientAuth.getLoginSuccess();

			expect(mockCookies.get).toHaveBeenCalledWith("login-success");
			expect(result).toBe(email);
		});

		it("returns undefined when no login success cookie exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.getLoginSuccess();

			expect(result).toBeUndefined();
		});
	});

	describe("removeLoginSuccess", () => {
		it("removes login success cookie", () => {
			clientAuth.removeLoginSuccess();

			expect(mockCookies.remove).toHaveBeenCalledWith("login-success");
		});
	});

	describe("getAccessToken", () => {
		it("retrieves access token from cookie", () => {
			const token = "test-access-token";
			mockCookies.get.mockReturnValue(token);

			const result = clientAuth.getAccessToken();

			expect(mockCookies.get).toHaveBeenCalledWith("accessToken");
			expect(result).toBe(token);
		});

		it("returns undefined when no access token cookie exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.getAccessToken();

			expect(result).toBeUndefined();
		});
	});

	describe("getRefreshToken", () => {
		it("retrieves refresh token from cookie", () => {
			const token = "test-refresh-token";
			mockCookies.get.mockReturnValue(token);

			const result = clientAuth.getRefreshToken();

			expect(mockCookies.get).toHaveBeenCalledWith("refreshToken");
			expect(result).toBe(token);
		});

		it("returns undefined when no refresh token cookie exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.getRefreshToken();

			expect(result).toBeUndefined();
		});
	});

	describe("clearTokens", () => {
		it("removes both access and refresh token cookies", () => {
			clientAuth.clearTokens();

			expect(mockCookies.remove).toHaveBeenCalledTimes(2);
			expect(mockCookies.remove).toHaveBeenCalledWith("accessToken");
			expect(mockCookies.remove).toHaveBeenCalledWith("refreshToken");
		});
	});

	describe("clearAll", () => {
		it("removes all authentication-related cookies", () => {
			clientAuth.clearAll();

			expect(mockCookies.remove).toHaveBeenCalledTimes(4);
			expect(mockCookies.remove).toHaveBeenCalledWith("accessToken");
			expect(mockCookies.remove).toHaveBeenCalledWith("refreshToken");
			expect(mockCookies.remove).toHaveBeenCalledWith("userData");
			expect(mockCookies.remove).toHaveBeenCalledWith("login-success");
		});
	});

	describe("isAuthenticated", () => {
		it("returns true when access token exists", () => {
			mockCookies.get.mockReturnValue("test-access-token");

			const result = clientAuth.isAuthenticated();

			expect(result).toBe(true);
			expect(mockCookies.get).toHaveBeenCalledWith("accessToken");
		});

		it("returns false when no access token exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.isAuthenticated();

			expect(result).toBe(false);
		});

		it("returns false when access token is empty string", () => {
			mockCookies.get.mockReturnValue("");

			const result = clientAuth.isAuthenticated();

			expect(result).toBe(false);
		});
	});

	describe("getUserRole", () => {
		it("returns user role when user data exists", () => {
			const userData = {
				id: "123",
				email: "test@example.com",
				firstName: "John",
				lastName: "Doe",
				role: "admin",
				status: "active",
				avatar: "avatar.jpg",
			};

			mockCookies.get.mockReturnValue(`encoded_${JSON.stringify(userData)}`);

			const result = clientAuth.getUserRole();

			expect(result).toBe("admin");
		});

		it("returns null when no user data exists", () => {
			mockCookies.get.mockReturnValue(undefined);

			const result = clientAuth.getUserRole();

			expect(result).toBeNull();
		});
	});
});
