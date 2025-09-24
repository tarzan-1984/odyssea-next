"use client";

import { default as DynamicOtpForm } from "next/dynamic";

// Disable prerendering for this page
export const dynamic = "force-dynamic";

const OtpForm = DynamicOtpForm(() => import("@/components/auth/OtpForm"), {
	ssr: false,
	loading: () => (
		<div className="lg:w-1/2 w-full h-full flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
				<h2 className="text-xl font-semibold text-gray-700 dark:text-white mb-2">
					Processing...
				</h2>
				<p className="text-gray-500 dark:text-gray-400">
					Please wait while we complete your sign-in
				</p>
			</div>
		</div>
	),
});

export default function OtpVerification() {
	return <OtpForm />;
}
