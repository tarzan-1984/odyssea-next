"use client";

import { useUserInit } from "@/hooks/useUserInit";

// Component to initialize user data from cookies
export default function UserInitializer() {
	useUserInit();
	return null; // This component doesn't render anything
}
