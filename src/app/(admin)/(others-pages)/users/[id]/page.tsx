"use client";

import { useParams } from "next/navigation";
import UserContactCard from "@/components/user-profile/UserContactCard";
import UserVehicleCard from "@/components/user-profile/UserVehicleCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import users from "@/app-api/users";
import React, { useEffect } from "react";

import {
	useCurrentUser,
	useIsLoadingUser,
	useUserError,
	useSetCurrentUser,
	useSetLoadingUser,
	useSetError,
} from "@/stores/userStore";
import UserDocumentsCard from "@/components/user-profile/UserDocumentsCard";
import UserStatisticsCard from "@/components/user-profile/UserStatistics";
import UserCurrentLocationCard from "@/components/user-profile/UserCurrentLocation";

export default function SingleUserProfile() {
	// Get data from Zustand store
	const currentUser = useCurrentUser();
	const isLoading = useIsLoadingUser();
	const error = useUserError();
	const setCurrentUser = useSetCurrentUser();
	const setLoadingUser = useSetLoadingUser();
	const setError = useSetError();

	const params = useParams();
	const userID = params.id as string;

	useEffect(() => {
		if (!userID) return;

		const fetchUser = async () => {
			setLoadingUser(true);
			setError(null);

			try {
				const result = await users.getUserByID(userID);

				// TODO: Need to add redirect for non allowed users to visit the page
				if (result.success && result.data) {
					setCurrentUser(result.data);
				} else {
					setCurrentUser(null);
					setError(result.error || "Failed to load user data");
				}
			} catch (error) {
				console.log("error", error);
				setCurrentUser(null);
				setError("Network error occurred");
			} finally {
				setLoadingUser(false);
			}
		};

		fetchUser();
	}, [userID, setCurrentUser, setLoadingUser, setError]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-400">Loading user profile...</p>
				</div>
			</div>
		);
	}

	if (!currentUser && !isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<p className="text-red-600 dark:text-red-400">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
				{/*<h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">*/}
				{/*	Profile - {currentUser?.firstName} {currentUser?.lastName}*/}
				{/*</h3>*/}

				<div className="space-y-6">
					<UserMetaCard />
					<UserContactCard />
					<UserCurrentLocationCard />
					<UserVehicleCard />
					<UserDocumentsCard />
					<UserStatisticsCard />
				</div>
			</div>
		</div>
	);
}
