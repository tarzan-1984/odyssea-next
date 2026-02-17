import axios from "axios";

export interface OfferDriver {
	externalId: string | null;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	status: string;
	rate: number | null;
	action_time?: string | null;
}

export interface OfferRow {
	id: string;
	external_user_id: string | null;
	create_time: string;
	update_time: string;
	pick_up_location: string;
	pick_up_time: string;
	delivery_location: string;
	delivery_time: string;
	loaded_miles: number | null;
	empty_miles: number | null;
	weight: number | null;
	commodity: string | null;
	special_requirements: unknown;
	total_miles: number | null;
	action_time: string | null;
	drivers: OfferDriver[];
}

export interface GetOffersParams {
	page?: number;
	limit?: number;
	is_expired?: boolean;
	user_id?: string;
	sort_order?: "action_time_asc" | "action_time_desc";
}

export interface GetOffersResponse {
	data: {
		results: OfferRow[];
		pagination: {
			current_page: number;
			per_page: number;
			total_count: number;
			total_pages: number;
			has_next_page: boolean;
			has_prev_page: boolean;
		};
	};
}

export interface CreateOfferPayload {
	externalId: string;
	driverIds: string[];
	pickUpLocation: string;
	pickUpTime: string;
	deliveryLocation: string;
	deliveryTime: string;
	loadedMiles?: number;
	emptyMiles?: number;
	totalMiles?: number;
	weight?: number;
	commodity?: string;
	specialRequirements?: string[];
}

export interface CreateOfferResponse {
	success: boolean;
	data?: { id: string; [key: string]: unknown };
	error?: string;
}

/**
 * Offers API – create offer and rate_offers via backend.
 * Uses axios with credentials (cookies) for auth.
 */
const offers = {
	/**
	 * Get paginated offers. Pass user_id for non-ADMINISTRATOR users (filter by current user).
	 */
	async getOffers(params: GetOffersParams): Promise<GetOffersResponse> {
		const searchParams = new URLSearchParams();
		if (params.page != null) searchParams.set("page", String(params.page));
		if (params.limit != null) searchParams.set("limit", String(params.limit));
		if (params.is_expired != null) searchParams.set("is_expired", String(params.is_expired));
		if (params.user_id != null && params.user_id !== "") searchParams.set("user_id", params.user_id);
		if (params.sort_order != null) searchParams.set("sort_order", params.sort_order);
		const url = `/api/offers${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
		const response = await axios.get<GetOffersResponse>(url, { withCredentials: true });
		return response?.data;
	},

	/**
	 * Create a new offer and rate_offers for selected drivers.
	 * Sends form data to Next API route which proxies to backend.
	 */
	async createOffer(payload: CreateOfferPayload): Promise<CreateOfferResponse> {
		try {
			const response = await axios.post<{ id?: string; [key: string]: unknown }>(
				"/api/offers/create",
				payload,
				{
					headers: { "Content-Type": "application/json" },
					withCredentials: true,
					validateStatus: () => true,
				}
			);

			const data = response.data;

			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					data: data as { id: string; [key: string]: unknown },
				};
			}

			return {
				success: false,
				error: (data as { error?: string; message?: string })?.error ?? (data as { message?: string })?.message ?? "Failed to create offer",
			};
		} catch (error) {
			console.error("Error in createOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},
};

export default offers;
