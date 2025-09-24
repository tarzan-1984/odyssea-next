import { tokenEncoder } from "./tokenEncoder";
import Cookies from "js-cookie";

/**
 * Utility for managing authentication tokens in cookies
 * Tokens are encoded before storage and decoded when retrieved
 * Supports both native cookies and js-cookie library
 */

export const tokenStorage = {
	/**
	 * Save access token to cookies (encoded)
	 * @param token - The access token to save
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 */
	saveAccessToken(token: string, useJsCookie: boolean = false): void {
		try {
			const encodedToken = tokenEncoder.encode(token);

			if (useJsCookie) {
				// Use js-cookie library
				Cookies.set("accessToken", encodedToken, {
					expires: 7,
					sameSite: "strict",
					secure: true,
				});
			} else {
				// Use native cookies
				document.cookie = `accessToken=${encodedToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict; Secure`;
			}
		} catch {
			// Silent error handling
		}
	},

	/**
	 * Save refresh token to cookies (encoded)
	 * @param token - The refresh token to save
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 */
	saveRefreshToken(token: string, useJsCookie: boolean = false): void {
		try {
			const encodedToken = tokenEncoder.encode(token);

			if (useJsCookie) {
				// Use js-cookie library
				Cookies.set("refreshToken", encodedToken, {
					expires: 30,
					sameSite: "strict",
					secure: true,
				});
			} else {
				// Use native cookies
				document.cookie = `refreshToken=${encodedToken}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict; Secure`;
			}
		} catch {
			// Silent error handling
		}
	},

	/**
	 * Get access token from cookies (decoded)
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 * @returns The decoded access token or null if not found
	 */
	getAccessToken(useJsCookie: boolean = false): string | null {
		try {
			let encodedToken: string | undefined;

			if (useJsCookie) {
				// Use js-cookie library
				encodedToken = Cookies.get("accessToken");
			} else {
				// Use native cookies
				const cookies = document.cookie.split(";");
				const accessTokenCookie = cookies.find(cookie =>
					cookie.trim().startsWith("accessToken=")
				);

				if (accessTokenCookie) {
					encodedToken = accessTokenCookie.split("=")[1];
				}
			}

			if (encodedToken) {
				return tokenEncoder.decode(encodedToken);
			}

			return null;
		} catch {
			return null;
		}
	},

	/**
	 * Get refresh token from cookies (decoded)
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 * @returns The decoded refresh token or null if not found
	 */
	getRefreshToken(useJsCookie: boolean = false): string | null {
		try {
			let encodedToken: string | undefined;

			if (useJsCookie) {
				// Use js-cookie library
				encodedToken = Cookies.get("refreshToken");
			} else {
				// Use native cookies
				const cookies = document.cookie.split(";");
				const refreshTokenCookie = cookies.find(cookie =>
					cookie.trim().startsWith("refreshToken=")
				);

				if (refreshTokenCookie) {
					encodedToken = refreshTokenCookie.split("=")[1];
				}
			}

			if (encodedToken) {
				return tokenEncoder.decode(encodedToken);
			}

			return null;
		} catch {
			return null;
		}
	},

	/**
	 * Clear all tokens from cookies
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 */
	clearTokens(useJsCookie: boolean = false): void {
		try {
			if (useJsCookie) {
				// Use js-cookie library
				Cookies.remove("accessToken");
				Cookies.remove("refreshToken");
			} else {
				// Use native cookies
				document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
				document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
			}
		} catch {
			// Silent error handling
		}
	},

	/**
	 * Check if user is authenticated
	 * @param useJsCookie - Whether to use js-cookie library (default: false)
	 * @returns True if access token exists
	 */
	isAuthenticated(useJsCookie: boolean = false): boolean {
		return !!this.getAccessToken(useJsCookie);
	},
};
