import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppHomePath } from "@/utils/roleAccess";
import { tokenEncoder } from "@/utils/tokenEncoder";

const USER_DATA_COOKIE = "userData";

export default async function AdminHomePage() {
	const cookieStore = await cookies();
	const enc = cookieStore.get(USER_DATA_COOKIE)?.value;
	let role: string | undefined;
	if (enc) {
		try {
			const userData = JSON.parse(tokenEncoder.decode(enc)) as { role?: string };
			role = userData.role;
		} catch {
			role = undefined;
		}
	}
	redirect(getAppHomePath(role));
}
