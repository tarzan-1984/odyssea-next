"use client";

import { useParams } from "next/navigation";
import UserContactCard from "@/components/user-profile/UserContactCard";
import UserVehicleCard from "@/components/user-profile/UserVehicleCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import users from "@/app-api/users";
import React, { useEffect, useState } from "react";

import UserDocumentsCard from "@/components/user-profile/UserDocumentsCard";
import UserStatisticsCard from "@/components/user-profile/UserStatistics";
import {UserData, UserOrganizedData} from "@/app-api/api-types";
import UserCurrentLocationCard from "@/components/user-profile/UserCurrentLocation";

export default function SingleUserProfile() {
	const params = useParams();
	const userID = params.id as string;
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<UserData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!userID) return;

		const fetchUser = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const result = await users.getUserByID(userID);

				if (result.success && result.data) {

					const fetchUser = {...result.data.data};

					// If user is a driver, fetch additional data from TMS
					if (result.data.data.role === 'DRIVER' && result.data.data.externalId) {
						const driverResult = await users.getDriverById(result.data.data.externalId);

						if(driverResult.success && driverResult?.data) {
							fetchUser['organized_data'] = driverResult?.data.organized_data as UserOrganizedData;
						}
					}

					setUser(fetchUser);

				} else {
					setUser(null);
					setError(result.error || "Failed to load user data");
				}
			} catch (error) {
				console.log("error", error);
				setUser(null);
				setError("Network error occurred");
			} finally {
				setIsLoading(false);
			}
		};

		fetchUser();
	}, [userID]);

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

	if (!user && !isLoading) {
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

				<div className="space-y-6">
					<UserMetaCard user={user} />

					{user?.organized_data?.contact && user.role === 'DRIVER' &&
						<UserContactCard user={user} />
					}

					{user?.organized_data?.contact && user.role === 'DRIVER' &&
						<UserVehicleCard user={user} />
					}


					{user?.organized_data?.contact && user.role === 'DRIVER' &&
						<UserDocumentsCard user={user} />
					}

					{user?.organized_data?.contact && user.role === 'DRIVER' &&
						<UserStatisticsCard user={user} />
					}

					{user?.organized_data?.contact && user.role === 'DRIVER' &&
						<UserCurrentLocationCard user={user} />
					}
				</div>
			</div>
		</div>
	);
}
