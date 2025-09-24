"use client";
import React from "react";
import UserContactCard from "@/components/user-profile/UserContactCard";
// import UserVehicleEquipmentCard from "@/components/user-profile/UserVehicleEquipmentCard";
import { useCurrentUser } from "@/stores/userStore";

export default function ProfileClient() {
	// Get current user data from Zustand store
	const currentUser = useCurrentUser();

	// Get user role for passing to child components
	const authorizedUserRole = currentUser?.role || "";

	return (
		<>
			<UserContactCard />
			{/*<UserVehicleEquipmentCard authorizedUserRole={authorizedUserRole} />*/}
		</>
	);
}
