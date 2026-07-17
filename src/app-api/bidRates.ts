import axios from "axios";
import type { CreateOfferRoutePoint } from "./offers";

export type BidRateStatus = "blocked" | "in-process" | "completed" | "in_process";

/** Same JSON shape as offers.route */
export type BidRateRoutePoint = CreateOfferRoutePoint;

export type BidRateOwner = {
	id: string;
	firstName: string | null;
	lastName: string | null;
};

export interface BidRate {
	id: number;
	route: BidRateRoutePoint[] | null;
	broker: string;
	rate: number;
	distance: number | null;
	status: BidRateStatus;
	ownerId: string;
	owner: BidRateOwner | null;
	chatId: string | null;
	/** Unix timestamp in seconds. */
	createdAt: number;
	/** Unix timestamp in seconds. */
	updatedAt: number;
}

export interface BidRatesPagination {
	current_page: number;
	per_page: number;
	total_count: number;
	total_pages: number;
	has_next_page: boolean;
	has_prev_page: boolean;
}

export interface GetBidRatesParams {
	page?: number;
	limit?: number;
}

export interface GetBidRatesResponse {
	data: {
		results: BidRate[];
		pagination: BidRatesPagination;
	};
}

export interface CreateBidRatePayload {
	route: BidRateRoutePoint[];
	broker: string;
	rate: number;
	distance: number;
}

export async function getBidRates(
	params: GetBidRatesParams = {},
): Promise<GetBidRatesResponse> {
	const res = await axios.get<GetBidRatesResponse>("/api/bid-rates", {
		params: {
			page: params.page ?? 1,
			limit: params.limit ?? 10,
		},
		withCredentials: true,
	});
	return res.data;
}

export async function createBidRate(payload: CreateBidRatePayload): Promise<BidRate> {
	const res = await axios.post<{ data: BidRate } | BidRate>("/api/bid-rates", payload, {
		withCredentials: true,
	});
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidRate;
}

export async function deleteBidRate(id: number): Promise<void> {
	await axios.delete(`/api/bid-rates/${id}`, {
		withCredentials: true,
	});
}

export async function extendBidRateTime(id: number): Promise<BidRate> {
	const res = await axios.post<{ data: BidRate } | BidRate>(
		`/api/bid-rates/${id}/extend-time`,
		{},
		{ withCredentials: true },
	);
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidRate;
}

export async function updateBidRateNewPrice(
	id: number,
	newPrice: number,
): Promise<BidRate> {
	const res = await axios.patch<{ data: BidRate } | BidRate>(
		`/api/bid-rates/${id}/new-price`,
		{ newPrice },
		{ withCredentials: true },
	);
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidRate;
}

export type BidParticipation = {
	bidRateId: number;
	hasJoined: boolean;
	/** True while the user's +1 timer is still running. */
	timerActive?: boolean;
	createdAt?: number | null;
	updatedAt?: number | null;
};

export type BidJoinResult = BidParticipation & {
	alreadyJoined: boolean;
};

export type BidAuctionParticipant = {
	userId: string;
	firstName?: string | null;
	lastName?: string | null;
	profilePhoto?: string | null;
	userColor?: string | null;
	role?: string | null;
	/** Unix timestamp in seconds. */
	createdAt: number;
	/** Unix timestamp in seconds. */
	updatedAt: number;
};

export type BidRateVoter = {
	userId: string;
	firstName?: string | null;
	lastName?: string | null;
	profilePhoto?: string | null;
	userColor?: string | null;
	role?: string | null;
	rate: number | null;
	/** Unix timestamp in seconds when rate was last written. */
	createdRateAt: number | null;
};

export type BidAuctionParticipantsResponse = {
	bidRateId: number;
	ownerId: string;
	participants: BidAuctionParticipant[];
};

export type BidRateVotersResponse = {
	bidRateId: number;
	ownerId: string;
	participants: BidRateVoter[];
};

export async function getBidParticipationByChat(
	chatRoomId: string,
): Promise<BidParticipation> {
	const res = await axios.get<BidParticipation | { data: BidParticipation }>(
		`/api/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/participation`,
		{ withCredentials: true },
	);
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidParticipation;
}

export async function joinBidByChat(chatRoomId: string): Promise<BidJoinResult> {
	const res = await axios.post<BidJoinResult | { data: BidJoinResult }>(
		`/api/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/join`,
		{},
		{ withCredentials: true },
	);
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidJoinResult;
}

export async function getBidParticipantsByChat(
	chatRoomId: string,
): Promise<BidAuctionParticipantsResponse> {
	const res = await axios.get<
		BidAuctionParticipantsResponse | { data: BidAuctionParticipantsResponse }
	>(`/api/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/participants`, {
		withCredentials: true,
	});
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidAuctionParticipantsResponse;
}

export async function getBidParticipants(
	bidRateId: number,
): Promise<BidAuctionParticipantsResponse> {
	const res = await axios.get<
		BidAuctionParticipantsResponse | { data: BidAuctionParticipantsResponse }
	>(`/api/bid-rates/${bidRateId}/participants`, {
		withCredentials: true,
	});
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidAuctionParticipantsResponse;
}

export async function getBidRateVoters(
	bidRateId: number,
): Promise<BidRateVotersResponse> {
	const res = await axios.get<
		BidRateVotersResponse | { data: BidRateVotersResponse }
	>(`/api/bid-rates/${bidRateId}/rate-voters`, {
		withCredentials: true,
	});
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as BidRateVotersResponse;
}

export async function extendBidParticipantTimeByChat(
	chatRoomId: string,
	userId?: string,
): Promise<{
	bidRateId: number;
	participant: BidAuctionParticipant;
}> {
	const res = await axios.post<
		| { bidRateId: number; participant: BidAuctionParticipant }
		| { data: { bidRateId: number; participant: BidAuctionParticipant } }
	>(
		`/api/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/extend-participant-time`,
		userId ? { userId } : {},
		{ withCredentials: true },
	);
	const body = res.data;
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as { bidRateId: number; participant: BidAuctionParticipant };
}
