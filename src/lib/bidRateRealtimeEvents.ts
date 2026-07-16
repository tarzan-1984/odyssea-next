/** Dispatched on window when WebSocket receives bidRateUpdated. */
export const ODYSSEA_BID_RATE_UPDATED_EVENT = "odyssea:bid-rate-updated";

export type BidRateUpdatedEventDetail = {
	bidRateId?: number;
	chatRoomId?: string | null;
	reason?: string;
	refreshedAt?: string;
};
