import { chatApi, ChatRoom } from "@/app-api/chatApi";

let inFlightRequest: Promise<ChatRoom[]> | null = null;

/** Coalesce identical full-list refreshes triggered by mounts and reconnects. */
export function getChatRoomsListShared(): Promise<ChatRoom[]> {
	if (inFlightRequest) return inFlightRequest;

	const request = chatApi.getChatRooms();
	inFlightRequest = request;

	return request.finally(() => {
		if (inFlightRequest === request) inFlightRequest = null;
	});
}
