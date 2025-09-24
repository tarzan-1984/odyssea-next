"use client";

import SignInForm from "@/components/auth/SignInForm";
import { Suspense } from "react";

export default function SignIn() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SignInForm />
		</Suspense>
	);
}
