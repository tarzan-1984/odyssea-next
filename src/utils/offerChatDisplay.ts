import type { ChatRoom } from "@/app-api/chatApi";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import { formatOfferChatDriverDisplayName } from "@/utils/chatPeerDisplayName";
import { getOtherChatParticipant } from "@/utils/chatOtherParticipant";

const ROUTE_SEPARATORS = [" — ", " - ", " → ", "–"] as const;

/** Chat name format: "firstName lastName (id: offerId)\\npickUp - delivery" */
export function parseOfferChatRouteLine(chatName: string | null | undefined): string {
	if (!chatName?.trim()) return "";

	const lines = chatName.trim().split("\n");
	if (lines.length > 1) {
		return lines.slice(1).join("\n").trim();
	}

	return "";
}

function splitRouteHalves(route: string): [string, string] | null {
	for (const sep of ROUTE_SEPARATORS) {
		const idx = route.indexOf(sep);
		if (idx === -1) continue;

		const left = route.slice(0, idx).trim();
		const right = route.slice(idx + sep.length).trim();
		if (left && right) return [left, right];
	}

	return null;
}

export function formatOfferRouteForDisplay(route: string): string {
	const trimmed = route.trim();
	if (!trimmed) return trimmed;

	const halves = splitRouteHalves(trimmed);
	if (halves) {
		const [pickUp, delivery] = halves;
		return `${abbreviateStateInLocationString(pickUp)} - ${abbreviateStateInLocationString(delivery)}`;
	}

	return abbreviateStateInLocationString(trimmed);
}

/** Staff-facing OFFER chat header: "unit firstName lastName\\nroute" (no offer id). */
export function getOfferChatStaffHeaderTitle(
	chatRoom: ChatRoom,
	currentUserId?: string | null
): string {
	const otherParticipant = getOtherChatParticipant(chatRoom, currentUserId ?? undefined);
	if (!otherParticipant) {
		const fallbackLine =
			chatRoom.name?.split("\n")[0]?.replace(/\(id:\s*[^)]+\)/, "").trim() || "Unknown Chat";
		return fallbackLine;
	}

	const driverName = formatOfferChatDriverDisplayName(otherParticipant.user);
	const route = parseOfferChatRouteLine(chatRoom.name);
	if (route) {
		return `${driverName}\n${formatOfferRouteForDisplay(route)}`;
	}

	return driverName;
}
