import {
	LoginData,
	LoginResponse,
	OtpVerificationResponse,
	LogoutResponse,
	ForgotPasswordResponse,
	ResetPasswordResponse,
	ChangePasswordData,
	RefreshTokenResponse,
	OtpVerificationData,
	LogoutData,
	ForgotPasswordData,
	ResetPasswordData,
	RefreshTokenData,
} from "./api-types";

/**
 * Authentication API functions for user authentication and authorization
 * Handles login, logout, OTP verification, password reset, and social login
 */
const authentication = {
	/**
	 * Sends a request to decrypt a user payload using a cookie string.
	 * @param cookieFormattedUserData - Encrypted cookie payload.
	 * @returns A promise that resolves with the decrypted data.
	 */
	async authDecrypt(cookieFormattedUserData: string) {
		// GET request to decrypt cookie payload
		const res = await fetch(
			`/api/authentication/decrypt?payload=${encodeURIComponent(cookieFormattedUserData)}`
		);
		return await res.json();
	},

	/**
	 * Authenticates user with email and password
	 * @param loginData - User credentials (email and password)
	 * @returns Promise with login result including access and refresh tokens
	 */
	async login_password(loginData: LoginData): Promise<LoginResponse> {
		try {
			const response = await fetch("/api/authentication/login/password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(loginData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to login",
				};
			}

			return {
				success: true,
				message: data.message || "OTP code sent to your email",
				data: data,
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Authenticates user with email only - checks user status and sends temporary password if inactive
	 * @param email - User email address
	 * @returns Promise with login result including redirect URL
	 */
	async login_email(
		email: string
	): Promise<{ success: boolean; message?: string; redirectUrl?: string; error?: string }> {
		try {
			const response = await fetch("/api/authentication/login/email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to verify email",
				};
			}

			return {
				success: true,
				message: data.message,
				redirectUrl: data.redirectUrl,
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Verifies OTP code sent to user's email
	 * @param otpData - OTP verification data (email and OTP code)
	 * @returns Promise with verification result including access and refresh tokens
	 */
	async verifyOTP(otpData: OtpVerificationData): Promise<OtpVerificationResponse> {
		try {
			const response = await fetch("/api/authentication/otp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(otpData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to verify OTP",
				};
			}

			return {
				success: true,
				message: "OTP verification successful",
				data: data,
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Logs out user by invalidating refresh token
	 * @param logoutData - Object containing refresh token and optional access token
	 * @returns Promise with logout result
	 */
	async logout(logoutData: LogoutData): Promise<LogoutResponse> {
		try {
			const response = await fetch("/api/authentication/logout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(logoutData.accessToken && {
						Authorization: `Bearer ${logoutData.accessToken}`,
					}),
				},
				body: JSON.stringify(logoutData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to logout",
				};
			}

			return {
				success: true,
				message: data.message || "Logout successful",
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Initiates password reset process by sending email
	 * @param forgotPasswordData - Object containing user's email address for password reset
	 * @returns Promise with password reset initiation result
	 */
	async forgotPassword(forgotPasswordData: ForgotPasswordData): Promise<ForgotPasswordResponse> {
		try {
			const response = await fetch("/api/authentication/forgot-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(forgotPasswordData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to process forgot password request",
				};
			}

			return {
				success: true,
				message: data.message || "Password reset email sent",
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Resets user password using reset token
	 * @param resetPasswordData - Object containing reset token and new password
	 * @returns Promise with password reset result
	 */
	async resetPassword(resetPasswordData: ResetPasswordData): Promise<ResetPasswordResponse> {
		try {
			const response = await fetch("/api/authentication/reset-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(resetPasswordData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to reset password",
				};
			}

			return {
				success: true,
				message: data.message || "Password successfully reset",
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Changes password for an authenticated user
	 * @param changePasswordData - Object containing new password
	 * @returns Promise with change password result
	 */
	async changePassword(
		changePasswordData: ChangePasswordData
	): Promise<ResetPasswordResponse> {
		try {
			const response = await fetch("/api/authentication/change-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(changePasswordData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to change password",
				};
			}

			return {
				success: true,
				message: data.message || "Password successfully changed",
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Refreshes access token using refresh token
	 * @param refreshTokenData - Object containing user's refresh token
	 * @returns Promise with new access token
	 */
	async refreshToken(refreshTokenData: RefreshTokenData): Promise<RefreshTokenResponse> {
		try {
			const response = await fetch("/api/authentication/refresh", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(refreshTokenData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to refresh token",
				};
			}

			return {
				success: true,
				accessToken: data.accessToken,
			};
		} catch {
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},
};

export default authentication;
