import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import NewPasswordForm from "@/components/auth/NewPasswordForm";
import { Metadata } from "next";

import React from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "This is Next.js Password Reset page for TailAdmin Dashboard Template",
	// other metadata
};

interface PageProps {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
	const params = await searchParams;
	const token = params.token;

	// If token exists, show new password form, otherwise show forgot password form
	if (token) {
		return <NewPasswordForm />;
	}

	return <ResetPasswordForm />;
}
