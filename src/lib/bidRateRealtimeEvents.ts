/** Dispatched on window when WebSocket receives bidRateUpdated. */
export const ODYSSEA_BID_RATE_UPDATED_EVENT = "odyssea:bid-rate-updated";

export type BidRateUpdatedParticipant = {
	userId: string;
	createdAt: number;
	updatedAt: number;
};

export type BidRateUpdatedEventDetail = {
	bidRateId?: number;
	chatRoomId?: string | null;
	reason?: string;
	refreshedAt?: string;
	/** Present for +1 join / rejoin / timer extend — apply immediately. */
	participant?: BidRateUpdatedParticipant | null;
	/** Updated bid row (e.g. after offer accept — includes restarted timer). */
	bidRate?: {
		id: number;
		rate?: number;
		createdAt?: number;
		updatedAt?: number;
	} | null;
};

/** Bid row is gone — refetching voters/participants would 404. */
export function isBidRateRemovedReason(reason?: string | null): boolean {
	return reason === "deleted";
}
