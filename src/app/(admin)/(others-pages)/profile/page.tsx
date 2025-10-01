"use client";

import UserVehicleCard from "@/components/user-profile/UserVehicleCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import React, {useEffect} from "react";
import ProfileClient from "@/app/(admin)/(others-pages)/profile/ProfileClient";
import { useUserInit } from "@/hooks/useUserInit";
import UserContactCard from "@/components/user-profile/UserContactCard";

export default function Profile() {
	// This hook loads user data from cookies into Zustand store
	const { currentUser, isInitializing } = useUserInit();

	useEffect(() => {
		if(!isInitializing && currentUser?.id) {
			console.log('currentUser++++', currentUser);
		}
	}, [isInitializing])

	if (isInitializing) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
				<h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
					Profile
				</h3>
				<div className="space-y-6">
					<UserMetaCard user={currentUser} />
					<UserContactCard user={currentUser} />
				</div>
			</div>
		</div>
	);
}
