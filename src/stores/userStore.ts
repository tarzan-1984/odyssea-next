import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { UserData } from "@/app-api/api-types";

// Interface for user store state
interface UserState {
	// Current user data
	currentUser: UserData | null;

	// Loading states
	isLoading: boolean;
	isLoadingUser: boolean;

	// Error states
	error: string | null;

	// Actions for managing user data
	setCurrentUser: (user: UserData | null) => void;
	setLoading: (loading: boolean) => void;
	setLoadingUser: (loading: boolean) => void;
	setError: (error: string | null) => void;

	// Action to clear all user data (for logout)
	clearUser: () => void;

	// Action to update specific user fields
	updateUserField: <K extends keyof UserData>(field: K, value: UserData[K]) => void;
}

// Create the user store with Zustand
export const useUserStore = create<UserState>()(
	devtools(
		(set, get) => ({
			// Initial state
			currentUser: null,
			isLoading: false,
			isLoadingUser: false,
			error: null,

			// Actions
			setCurrentUser: user => {
				set({ currentUser: user, error: null }, false, "setCurrentUser");
			},

			setLoading: loading => {
				set({ isLoading: loading }, false, "setLoading");
			},

			setLoadingUser: loading => {
				set({ isLoadingUser: loading }, false, "setLoadingUser");
			},

			setError: error => {
				set({ error }, false, "setError");
			},

			clearUser: () => {
				set(
					{
						currentUser: null,
						error: null,
						isLoading: false,
						isLoadingUser: false,
					},
					false,
					"clearUser"
				);
			},

			updateUserField: (field, value) => {
				const currentUser = get().currentUser;
				if (currentUser) {
					set(
						{
							currentUser: { ...currentUser, [field]: value },
							error: null,
						},
						false,
						`updateUserField:${field}`
					);
				}
			},
		}),
		{
			name: "user-store", // Name for Redux DevTools
		}
	)
);

// Selectors for specific parts of the state
export const useCurrentUser = () => useUserStore(state => state.currentUser);
export const useIsLoadingUser = () => useUserStore(state => state.isLoadingUser);
export const useUserError = () => useUserStore(state => state.error);

// Action selectors - using individual selectors to avoid object recreation
export const useSetCurrentUser = () => useUserStore(state => state.setCurrentUser);
export const useSetLoading = () => useUserStore(state => state.setLoading);
export const useSetLoadingUser = () => useUserStore(state => state.setLoadingUser);
export const useSetError = () => useUserStore(state => state.setError);
export const useClearUser = () => useUserStore(state => state.clearUser);
export const useUpdateUserField = () => useUserStore(state => state.updateUserField);

// Note: For multiple actions, use individual selectors above to avoid object recreation
// which can cause infinite loops in React components
