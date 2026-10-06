import { useEffect } from "react";
import { useGetUnreadCount } from "@/stores/notificationsStore";
import { clientAuth } from "@/utils/auth";

// Initialize only the badge count. The notification list is loaded lazily
// when the user opens the header dropdown.
export const useNotificationsInit = () => {
  const getUnreadCount = useGetUnreadCount();

  useEffect(() => {
    // Check if user is authenticated before making requests
    const token = clientAuth.getAccessToken();
    if (token) {
      getUnreadCount()
        .then(() => {})
        .catch(error => {
          console.warn('⚠️ Could not initialize notification count:', error);
        });
    }
  }, [getUnreadCount]);

  return {};
};
