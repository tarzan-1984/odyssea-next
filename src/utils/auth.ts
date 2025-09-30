import Cookies from "js-cookie";
import { NextRequest } from "next/server";
import { tokenEncoder } from "./tokenEncoder";

// Cookie names for authentication tokens
export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";
export const USER_DATA_COOKIE = "userData"; // Encrypted user data
export const LOGIN_SUCCESS_COOKIE = "login-success"; // Temporary cookie for login confirmation

// Client-side functions using js-cookie
// Note: Tokens are encoded by API routes before being sent to client
export const clientAuth = {
	// Set access token in client-side cookies (encoded from API)
	setAccessToken: (encodedToken: string) => {
		Cookies.set(ACCESS_TOKEN_COOKIE, encodedToken, {
			expires: 7, // 7 days
			sameSite: "strict",
			secure: true,
		});
	},

	// Set refresh token in client-side cookies (encoded from API)
	setRefreshToken: (encodedToken: string) => {
		Cookies.set(REFRESH_TOKEN_COOKIE, encodedToken, {
			expires: 30, // 30 days
			sameSite: "strict",
			secure: true,
		});
	},

	// Set both tokens at once (encoded from API)
	setTokens: (accessToken: string, refreshToken: string) => {
		clientAuth.setAccessToken(accessToken);
		clientAuth.setRefreshToken(refreshToken);
	},

	// Set user data in encrypted cookie
	setUserData: (userData: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
		status: string;
		avatar: string;
	}) => {
		const encryptedUserData = tokenEncoder.encode(JSON.stringify(userData));
		Cookies.set(USER_DATA_COOKIE, encryptedUserData, {
			expires: 30, // 30 days
			sameSite: "strict",
			secure: true,
		});
	},

	// Get user data from encrypted cookie
	getUserData: (): {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
		status: string;
		avatar: string;
	} | null => {
		const encryptedUserData = Cookies.get(USER_DATA_COOKIE);
		if (encryptedUserData) {
			try {
				const decryptedData = tokenEncoder.decode(encryptedUserData);
				return JSON.parse(decryptedData);
			} catch (error) {
				console.error("Failed to decrypt user data:", error);
				return null;
			}
		}
		return null;
	},

	// Remove user data cookie
	removeUserData: () => {
		Cookies.remove(USER_DATA_COOKIE);
	},

	// Set temporary login success cookie
	setLoginSuccess: (email: string) => {
		Cookies.set(LOGIN_SUCCESS_COOKIE, email, {
			expires: 1 / 24, // 1 hour (temporary)
			sameSite: "strict",
			secure: true,
		});
	},

	// Get temporary login success cookie
	getLoginSuccess: (): string | undefined => {
		return Cookies.get(LOGIN_SUCCESS_COOKIE);
	},

	// Remove temporary login success cookie
	removeLoginSuccess: () => {
		Cookies.remove(LOGIN_SUCCESS_COOKIE);
	},

	// Remove tokens and user data from client-side cookies
	removeTokens: () => {
		Cookies.remove(ACCESS_TOKEN_COOKIE);
		Cookies.remove(REFRESH_TOKEN_COOKIE);
		clientAuth.removeUserData();
	},

	// Get access token from client-side cookies (decoded)
	getAccessToken: (): string | undefined => {
		const encodedToken = Cookies.get(ACCESS_TOKEN_COOKIE);
		if (encodedToken) {
			// Decode the token before returning it
			return tokenEncoder.decode(encodedToken);
		}
		return undefined;
	},

	// Get refresh token from client-side cookies (decoded)
	getRefreshToken: (): string | undefined => {
		const encodedToken = Cookies.get(REFRESH_TOKEN_COOKIE);
		if (encodedToken) {
			// Decode the token before returning it
			return tokenEncoder.decode(encodedToken);
		}
		return undefined;
	},

	// Check if user is authenticated on client side
	isAuthenticated: (): boolean => {
		return !!clientAuth.getAccessToken();
	},

	// Legacy function for backward compatibility
	setToken: (token: string) => {
		clientAuth.setAccessToken(token);
	},

	// Legacy function for backward compatibility
	removeToken: () => {
		clientAuth.removeTokens();
	},

	// Legacy function for backward compatibility
	getToken: (): string | undefined => {
		return clientAuth.getAccessToken();
	},
};

// Server-side functions for API routes using NextRequest
// These functions work in server context and can access cookies from request headers
export const serverAuth = {
	// Get access token from server-side request cookies (decoded)
	getAccessToken: (request: NextRequest): string | undefined => {
		const encodedToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
		if (encodedToken) {
			try {
				// Decode the token before returning it
				return tokenEncoder.decode(encodedToken);
			} catch (error) {
				console.error("Failed to decode access token:", error);
				return undefined;
			}
		}
		return undefined;
	},

	// Get refresh token from server-side request cookies (decoded)
	getRefreshToken: (request: NextRequest): string | undefined => {
		const encodedToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
		if (encodedToken) {
			try {
				// Decode the token before returning it
				return tokenEncoder.decode(encodedToken);
			} catch (error) {
				console.error("Failed to decode refresh token:", error);
				return undefined;
			}
		}
		return undefined;
	},

	// Get user data from server-side request cookies (decoded)
	getUserData: (
		request: NextRequest
	): {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
		status: string;
		avatar: string;
	} | null => {
		const encryptedUserData = request.cookies.get(USER_DATA_COOKIE)?.value;
		if (encryptedUserData) {
			try {
				const decryptedData = tokenEncoder.decode(encryptedUserData);
				return JSON.parse(decryptedData);
			} catch (error) {
				console.error("Failed to decrypt user data:", error);
				return null;
			}
		}
		return null;
	},

	// Check if user is authenticated on server side
	isAuthenticated: (request: NextRequest): boolean => {
		return !!serverAuth.getAccessToken(request);
	},

	// Get both tokens at once from server-side request
	getTokens: (
		request: NextRequest
	): {
		accessToken?: string;
		refreshToken?: string;
	} => {
		return {
			accessToken: serverAuth.getAccessToken(request),
			refreshToken: serverAuth.getRefreshToken(request),
		};
	},
};
