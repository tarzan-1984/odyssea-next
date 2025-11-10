import { useEffect, useState } from "react";
import { useCurrentUser, useSetCurrentUser } from "@/stores/userStore";
import { clientAuth } from "@/utils/auth";
import { useChatStore } from "@/stores/chatStore";
import { chatApi } from "@/app-api/chatApi";

// Hook to initialize user data from cookies into Zustand store
export const useUserInit = () => {
	const currentUser = useCurrentUser();
	const setCurrentUser = useSetCurrentUser();
	const { setChatRooms, setCurrentChatRoom } = useChatStore();
	const [isInitializing, setIsInitializing] = useState(!currentUser);
	const userData = clientAuth.getUserData();

	useEffect(() => {
		// Only initialize if user is not already loaded
		if (!currentUser) {
			const userData = clientAuth.getUserData();

			if (userData) {
				// Convert the user data from cookies to the format expected by the store
				const userDataForStore = {
					id: userData.id,
					avatar: userData.avatar,
					role: userData.role,
					status: userData.status,
					firstName: userData.firstName,
					lastName: userData.lastName,
					email: userData.email,
					externalId: userData.externalId,
					phone: userData.phone,
					location: userData.location,
				};

				setCurrentUser(userDataForStore);

				// Reset current chat room to ensure no stale state from previous session
				setCurrentChatRoom(null);

				// Chat rooms are loaded globally via ChatSyncInitializer/useChatSync.
				// Intentionally do not trigger here to avoid overwriting fresh counters.

				setIsInitializing(false);
			} else {
				// No user data found, finish initialization
				setIsInitializing(false);
			}
		} else {
			// User already loaded
			setIsInitializing(false);
		}
	}, [currentUser, setCurrentUser, setChatRooms, setCurrentChatRoom]);

	return { currentUser, isInitializing };
};
