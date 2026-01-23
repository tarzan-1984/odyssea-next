"use client";

import UserMetaCard from "@/components/user-profile/UserMetaCard";
import React from "react";
import { useUserInit } from "@/hooks/useUserInit";
import UserContactCard from "@/components/user-profile/UserContactCard";
import Link from "next/link";

export default function Profile() {
	// This hook loads user data from cookies into Zustand store
	const { currentUser, isInitializing } = useUserInit();

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
				<div className="mb-5 flex items-center justify-between gap-3 lg:mb-7">
					<h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
						Profile
					</h3>
					<Link
						href="/profile/change-password"
						className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
					>
						Change password
					</Link>
				</div>
				<div className="space-y-6">
					<UserMetaCard user={currentUser} />
					<UserContactCard user={currentUser} />
				</div>
			</div>
		</div>
	);
}
