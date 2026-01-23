import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import React from "react";

export default function ChangePasswordPage() {
	return (
		<div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
			<ChangePasswordForm />
		</div>
	);
}

