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
	status: BidRateStatus;
	ownerId: string;
	owner: BidRateOwner | null;
	chatId: string | null;
	createdAt: string;
	updatedAt: string;
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
