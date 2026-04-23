import type { Metadata } from "next";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
	title: "Delete Account | Odysseia",
	description: "Account deletion information page.",
};

export default function DeleteAccountPage() {
	return <DeleteAccountClient />;
}

