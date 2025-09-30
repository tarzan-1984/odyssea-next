"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clientAuth } from "@/utils/auth";
import authentication from "@/app-api/authentication";

function AuthSuccessContent() {
	const searchParams = useSearchParams();
	const payload = searchParams.get("payload");

	const router = useRouter();

	useEffect(() => {
		if (!payload) return;

		let isMounted = true;

		const fetchUser = async () => {
			try {
				const data = await authentication.authDecrypt(payload);

				if (!isMounted) return;

				if (data && data.accessToken && data.refreshToken && data.user) {
					// Transform UserData from API format to client format
					const clientUserData = {
						id: data.user.id,
						email: data.user.email || "",
						firstName: data.user.firstName || "",
						lastName: data.user.lastName,
						role: data.user.role,
						status: data.user.status,
						avatar: data.user.avatar || "",
					};

					// Save tokens and user data to cookies
					clientAuth.setTokens(data.accessToken, data.refreshToken);
					clientAuth.setUserData(clientUserData);

					// Also save access token to localStorage for ChatApi
					if (typeof window !== "undefined") {
						localStorage.setItem("authToken", data.accessToken);
					}

					// Force page reload to trigger middleware redirect
					window.location.href = "/";
				} else {
					console.error("Invalid data structure received");
				}
			} catch (error) {
				if (isMounted) {
					console.error("Error during authentication:", error);
				}
			}
		};

		fetchUser();

		return () => {
			isMounted = false;
		};
	}, [payload]);

	return (
		<div className="lg:w-1/2 w-full h-full flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
				<h2 className="text-xl font-semibold text-gray-700 dark:text-white mb-2">
					Processing Authentication...
				</h2>
				<p className="text-gray-500 dark:text-gray-400">
					Please wait while we complete your sign-in
				</p>
			</div>
		</div>
	);
}

export default function AuthSuccessPage() {
	return (
		<Suspense
			fallback={
				<div className="lg:w-1/2 w-full h-full flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
						<h2 className="text-xl font-semibold text-gray-700 dark:text-white mb-2">
							Loading...
						</h2>
					</div>
				</div>
			}
		>
			<AuthSuccessContent />
		</Suspense>
	);
}
