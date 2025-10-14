import { useEffect } from "react";
import { useLoadNotifications } from "@/stores/notificationsStore";
import { clientAuth } from "@/utils/auth";

// Hook to initialize notifications data on app start
export const useNotificationsInit = () => {
  const loadNotifications = useLoadNotifications();

  useEffect(() => {
    // Check if user is authenticated before making requests
    const token = clientAuth.getAccessToken();
    if (token) {
      // Load notifications (which now includes unread count) on app initialization
      loadNotifications(1) // Load first page (8 notifications + unread count)
        .then(() => {
          console.log('✅ Notifications initialized successfully - loaded notifications and unread count in one request');
        })
        .catch(error => {
          console.warn('⚠️ Could not initialize notifications:', error);
        });
    }
  }, [loadNotifications]);

  return {};
};
