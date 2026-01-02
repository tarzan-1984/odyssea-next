import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "This is Next.js SignUp Page TailAdmin Dashboard Template",
	// other metadata
};

export default function SignUp() {
	return <SignUpForm />;
}
