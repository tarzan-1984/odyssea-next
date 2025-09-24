import {
	CreateUserData,
	CreateUserResponse,
	GetAllUsersParams,
	GetAllUsersResponse,
	GetUserProfileResponse,
	GetUserByIdResponse,
	UpdateUserProfileResponse,
	UpdateUserResponse,
	DeleteUserResponse,
	ChangeUserStatusResponse,
	CreateUserInput,
	DeleteUserInput,
	ChangeUserStatusInput,
	UserUpdateFormData,
} from "./api-types";

/**
 * Users API functions for user management operations
 * Handles CRUD operations, profile management, and user status changes
 * All functions require JWT authentication
 */
const users = {
	/**
	 * Creates a new user in the system (Admin only)
	 * @param input - Object containing user data and role for permission check
	 * @returns Promise with user creation result
	 */
	async createUser(input: CreateUserInput): Promise<CreateUserResponse> {
		try {
			const response = await fetch("/api/users/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify({ ...input.userData, role: input.role }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to create user",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in createUser:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Retrieves paginated list of users with optional filtering and sorting
	 * @param params - Optional parameters for pagination, filtering, and sorting (page, limit, role, status, search, sort)
	 * @returns Promise with paginated users list
	 */
	async getAllUsers(params?: GetAllUsersParams): Promise<GetAllUsersResponse> {
		try {
			const response = await fetch("/api/users/list", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify(params || {}),
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
				data: data,
			};
		} catch (error) {
			console.error("Error in getAllUsers:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Retrieves current authenticated user's profile
	 * @returns Promise with current user profile data
	 */
	async getCurrentUserProfile(): Promise<GetUserProfileResponse> {
		try {
			const response = await fetch("/api/users/profile", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to fetch user profile",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in getCurrentUserProfile:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Retrieves user profile by user ID
	 * @param id - User ID
	 * @returns Promise with user profile data
	 */
	async getUserByID(id: string): Promise<GetUserByIdResponse> {
		try {
			const response = await fetch(`/api/users/${id}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
			});

			const data = await response.json();

			console.log("getUserById response = ", response);
			console.log("getUserById data = ", data);

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to fetch user",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in getUserById:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Updates current authenticated user's profile
	 * @param userData - Partial user data to update (only fields that need to be changed)
	 * @returns Promise with profile update result
	 */
	async updateUserProfile(userData: Partial<CreateUserData>): Promise<UpdateUserProfileResponse> {
		try {
			const response = await fetch("/api/users/profile", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify(userData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to update user profile",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in updateUserProfile:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Updates a user's profile by user ID (Admin only)
	 *
	 * @param {string} userId - The ID of the user to update
	 * @param {Partial<UserData>} userData - An object containing the fields to update
	 * @returns {Promise<UpdateUserResponse>} A promise that resolves to an object containing:
	 *   - success: boolean indicating whether the update was successful
	 *   - data?: any containing the updated user data if successful
	 *   - error?: string containing the error message if the update failed
	 */
	async updateUser(
		userId: string,
		userData: Partial<UserUpdateFormData>
	): Promise<UpdateUserResponse> {
		try {
			const response = await fetch(`/api/users/${userId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				// body: JSON.stringify({ ...input.userData, role: input.role }),
				body: JSON.stringify(userData),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to update user",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in updateUser:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Deletes user by user ID (Admin only)
	 * @param input - Object containing user ID and role for permission check
	 * @returns Promise with user deletion result
	 */
	async deleteUser(input: DeleteUserInput): Promise<DeleteUserResponse> {
		try {
			const response = await fetch(`/api/users/${input.id}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify({ role: input.role }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to delete user",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in deleteUser:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},

	/**
	 * Changes user status by user ID (Admin only)
	 * @param input - Object containing user ID, new status, and role for permission check
	 * @returns Promise with status change result
	 */
	async changeUserStatus(input: ChangeUserStatusInput): Promise<ChangeUserStatusResponse> {
		try {
			const response = await fetch(`/api/users/${input.id}/status`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies for authentication
				body: JSON.stringify({ status: input.status, role: input.role }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to change user status",
				};
			}

			return {
				success: true,
				data: data,
			};
		} catch (error) {
			console.error("Error in changeUserStatus:", error);
			return {
				success: false,
				error: "Network error occurred",
			};
		}
	},
};

export default users;
