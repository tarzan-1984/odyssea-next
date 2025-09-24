"use client";
import React from "react";
import { useCurrentUser } from "@/stores/userStore";

export default function UserStatisticsCard() {
	// Get user data from Zustand store
	const currentUser = useCurrentUser();

	const notificationsFields = [
		{
			label: "All notifications",
			value: currentUser?.organized_data?.statistics?.notifications?.all_notifications,
		},
		{
			label: "Total notifications",
			value: currentUser?.organized_data?.statistics?.notifications?.total_count,
		},
		{
			label: "Average rating",
			value: currentUser?.organized_data?.statistics?.rating?.average_rating,
		},
		{
			label: "Total ratings",
			value: currentUser?.organized_data?.statistics?.rating?.total_ratings,
		},
	];

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 space-y-6">
				<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
					Statistics
				</h4>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-7 2xl:gap-x-32">
					{notificationsFields.map(field => (
						<div key={field.label}>
							<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
								{field.label}
							</p>
							<p className="text-sm font-medium text-gray-800 dark:text-white/90">
								{field.value ?? "-"}
							</p>
						</div>
					))}
				</div>

				{currentUser?.organized_data?.statistics?.rating?.all_ratings?.length ? (
					<>
						<p>All ratings</p>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
							{currentUser.organized_data.statistics.rating.all_ratings.map(
								rating => (
									<div
										key={rating.id}
										className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 space-y-1"
									>
										<p className="text-xs leading-normal text-gray-500 dark:text-gray-400">
											{rating.name}
										</p>

										<p className="text-xs leading-normal text-gray-500 dark:text-gray-400">
											Order: {rating.order_number}
										</p>

										<p className="text-xs leading-normal text-gray-500 dark:text-gray-400">
											Reit: {rating.reit}
										</p>

										<p className="text-xs leading-normal text-gray-500 dark:text-gray-400">
											{rating.message}
										</p>
									</div>
								)
							)}
						</div>
					</>
				) : null}
			</div>
		</>
	);
}
