"use client";

import { useNotificationsInit } from "@/hooks/useNotificationsInit";

// Component to initialize notifications data on app start
export default function NotificationsInitializer() {
  useNotificationsInit();
  return null; // This component doesn't render anything
}
