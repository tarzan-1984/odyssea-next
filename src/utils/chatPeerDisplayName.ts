import type { User } from "@/app-api/chatApi";

/** DIRECT / OFFER list title for the other participant when they are a driver. */
export function formatChatPeerDisplayName(user: Pick<User, "firstName" | "lastName" | "role" | "externalId">): string {
	const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
	const isDriver = user.role?.toUpperCase().trim() === "DRIVER";
	const externalId = String(user.externalId ?? "").trim();

	if (isDriver && externalId) {
		return `(${externalId}) ${name}`;
	}

	return name;
}
