import axios from "axios";

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
	actionTime?: string;
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
