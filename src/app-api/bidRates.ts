import axios from "axios";
import type { CreateOfferRoutePoint } from "./offers";

export type BidRateStatus = "blocked" | "in-process" | "completed";

/** Same JSON shape as offers.route */
export type BidRateRoutePoint = CreateOfferRoutePoint;

export interface BidRate {
	id: number;
	route: BidRateRoutePoint[] | null;
	broker: string;
	rate: number;
	status: BidRateStatus;
	ownerId: string;
	chatId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateBidRatePayload {
	route: BidRateRoutePoint[];
	broker: string;
	rate: number;
}

export async function createBidRate(payload: CreateBidRatePayload): Promise<BidRate> {
	const res = await axios.post<BidRate>("/api/bid-rates", payload, {
		withCredentials: true,
	});
	return res.data;
}
