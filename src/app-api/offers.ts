import axios from "axios";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import { formatOfferDateTimeFieldForDisplay } from "@/utils/offerDateTimeRange";
import type { OfferRouteDistanceResult } from "@/utils/offerGoogleRoute";
import type { UserListItem } from "@/app-api/api-types";

export type { OfferRouteDistanceResult, OfferRouteStop } from "@/utils/offerGoogleRoute";

export interface OfferDriver {
	driver_id: string;
	externalId: string | null;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	status: string;
	active: boolean;
	is_selected: boolean;
	rate: number | null;
	counter_offer?: number | null;
	action_time?: number | null;
	action_time_display?: string | null;
	empty_miles: number | null;
	total_miles: number | null;
	driver_eta?: string | null;
	driver_rating?: number | null;
	has_offer_chat?: boolean;
	/** Unread messages in this driver's offer chat for the current user. */
	offer_chat_unread_count?: number;
	/** Manual reminders sent (0–3; create-push is separate). */
	reminder_count?: number;
	/** Unix seconds: assignment baseline or last reminder. */
	last_reminder_at?: number | null;
}

export interface OfferRoutePoint {
	type: "pick_up_location" | "delivery_location";
	location: string;
	time: string;
	latitude?: number;
	longitude?: number;
}

export interface OfferCreator {
	firstName: string;
	lastName: string;
	externalId: string | null;
	role: string;
	phone?: string | null;
}

export interface OfferRow {
	id: number;
	active?: boolean;
	is_driver_selected: boolean;
	external_user_id: string | null;
	creator?: OfferCreator | null;
	create_time: string;
	update_time: string;
	update_date?: string | null;
	pick_up_location?: string;
	pick_up_time?: string;
	delivery_location?: string;
	delivery_time?: string;
	route?: OfferRoutePoint[] | null;
	loaded_miles: number | null;
	offered_rate: number | null;
	empty_miles: number | null;
	weight: number | null;
	commodity: string | null;
	special_requirements: unknown;
	notes: string | null;
	total_miles: number | null;
	action_time: number | null;
	action_time_display?: string | null;
	drivers: OfferDriver[];
}

export interface GetOffersParams {
	page?: number;
	limit?: number;
	is_expired?: boolean;
	user_id?: string;
	sort_order?: "action_time_asc" | "action_time_desc";
	status?: "active" | "inactive" | "assigned";
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

export interface GetOfferResponse {
	data: OfferRow;
}

/** Format route array as "Pick up - location - time" / "Delivery - location - time" per line */
export function formatRoute(
	route: Array<{ type?: string; location?: string; time?: string }> | null | undefined,
): string {
	if (!Array.isArray(route) || route.length === 0) return "";
	return route
		.map((p) => {
			const label = p.type === "pick_up_location" ? "Pick up" : "Delivery";
			const loc = abbreviateStateInLocationString(p.location ?? "");
			const t = formatOfferDateTimeFieldForDisplay(p.time ?? "");
			return `${label} - ${loc} - ${t}`;
		})
		.join("\n");
}

/** First and last locations from route for short display (e.g. header) */
export function routeSummary(
	route: Array<{ location?: string }> | null | undefined,
): string {
	if (!Array.isArray(route) || route.length === 0) return "";
	const first = abbreviateStateInLocationString(route[0]?.location ?? "");
	const last =
		route.length > 1
			? abbreviateStateInLocationString(route[route.length - 1]?.location ?? "")
			: first;
	return last ? `${first} → ${last}` : first;
}

export interface CreateOfferRoutePoint {
	type: "pick_up_location" | "delivery_location";
	location: string;
	time: string;
	latitude?: number;
	longitude?: number;
}

export interface CreateOfferPayload {
	externalId: string;
	driverIds: string[];
	route: CreateOfferRoutePoint[];
	loadedMiles?: number;
	offeredRate?: number;
	/** Map driverId -> empty_miles. Used for rate_offers: empty_miles per driver, total_miles = loaded_miles + empty_miles */
	driverEmptyMiles?: Record<string, number>;
	weight?: number;
	commodity: string;
	specialRequirements?: string[];
	notes?: string;
}

export interface CreateOfferResponse {
	success: boolean;
	data?: { id: number; [key: string]: unknown };
	error?: string;
	errors?: string[];
}

export interface UpdateOfferResponse {
	success: boolean;
	data?: { id: number; [key: string]: unknown };
	error?: string;
	errors?: string[];
}

export interface AddDriversToOfferResponse {
	success: boolean;
	addedCount?: number;
	message?: string;
	error?: string;
}

export interface RemoveDriverFromOfferResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface ReturnDriverToOfferResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface SendDriverReminderResponse {
	success: boolean;
	message?: string;
	reminder_count?: number;
	last_reminder_at?: number;
	error?: string;
}

export interface SendDriversRemindersResponse {
	success: boolean;
	message?: string;
	accepted_count?: number;
	skipped_count?: number;
	accepted_driver_ids?: string[];
	last_reminder_at?: number;
	error?: string;
}

export interface ExtendDriverTimeResponse {
	success: boolean;
	action_time?: number | null;
	action_time_display?: string | null;
	message?: string;
	error?: string;
}

export interface SelectDriverForOfferResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface SetDriverCounterOfferResponse {
	success: boolean;
	counter_offer?: number | null;
	rate?: number | null;
	counter_offer_sent_count?: number;
	message?: string;
	error?: string;
	code?: string;
}

export interface DeactivateOfferResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface DeactivateOffersResponse {
	success: boolean;
	message?: string;
	error?: string;
	deactivatedIds?: number[];
}

export interface ReturnOfferResponse {
	success: boolean;
	message?: string;
	error?: string;
}

export interface ReturnOffersResponse {
	success: boolean;
	message?: string;
	error?: string;
	returnedIds?: number[];
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
		if (params.user_id != null && params.user_id !== "")
			searchParams.set("user_id", params.user_id);
		if (params.sort_order != null) searchParams.set("sort_order", params.sort_order);
		if (params.status != null) searchParams.set("status", params.status);
		const url = `/api/offers${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
		const response = await axios.get<GetOffersResponse>(url, { withCredentials: true });
		return response?.data;
	},

	/**
	 * Distinct users who created at least one offer (for admin User filter).
	 */
	async getOfferCreators(): Promise<{
		success: boolean;
		users?: UserListItem[];
		error?: string;
	}> {
		try {
			const response = await axios.get<{
				data?: {
					users?: Array<{
						id: string;
						externalId?: string | null;
						firstName?: string;
						lastName?: string;
						role?: string;
						profilePhoto?: string | null;
						avatar?: string | null;
						userColor?: string | null;
					}>;
				};
				users?: Array<{
					id: string;
					externalId?: string | null;
					firstName?: string;
					lastName?: string;
					role?: string;
					profilePhoto?: string | null;
					avatar?: string | null;
					userColor?: string | null;
				}>;
			}>("/api/offers/creators", { withCredentials: true });

			const payload = response.data;
			const rawUsers = payload?.data?.users ?? payload?.users ?? [];
			const users: UserListItem[] = rawUsers.map((u) => ({
				id: u.id,
				externalId: u.externalId ?? undefined,
				firstName: u.firstName ?? "",
				lastName: u.lastName ?? "",
				role: u.role ?? "",
				email: "",
				phone: "",
				location: "",
				type: "",
				vin: "",
				status: "ACTIVE",
				avatar: u.avatar ?? u.profilePhoto ?? undefined,
				profilePhoto: u.profilePhoto ?? undefined,
				userColor: u.userColor ?? null,
			}));

			return { success: true, users };
		} catch (error) {
			console.error("Error in getOfferCreators:", error);
			return { success: false, error: "Failed to fetch offer creators" };
		}
	},

	async getOffer(offerId: number): Promise<GetOfferResponse> {
		const response = await axios.get<GetOfferResponse>(`/api/offers/${offerId}`, {
			withCredentials: true,
		});
		return response.data;
	},

	/**
	 * Geocode an address to latitude/longitude via Nominatim.
	 * Returns null if geocoding fails.
	 */
	async geocodeCoordinates(
		address: string
	): Promise<{ latitude: number; longitude: number } | null> {
		const response = await axios.post<{
			latitude?: number;
			longitude?: number;
			error?: string;
		}>(
			"/api/offers/geocode-coordinates",
			{ address: address.trim() },
			{
				headers: { "Content-Type": "application/json" },
				withCredentials: true,
				validateStatus: () => true,
			}
		);

		if (response.status >= 200 && response.status < 300) {
			const { latitude, longitude } = response.data ?? {};
			if (typeof latitude === "number" && typeof longitude === "number") {
				return { latitude, longitude };
			}
		}

		return null;
	},

	/**
	 * Geocode a ZIP code to "City, State (ZIP)" format.
	 * Returns the input unchanged if not a ZIP or if geocoding fails.
	 */
	async geocodeToFormattedAddress(address: string): Promise<string> {
		const response = await axios.post<{ formattedAddress?: string; error?: string }>(
			"/api/offers/geocode-to-formatted",
			{ address: address.trim() },
			{
				headers: { "Content-Type": "application/json" },
				withCredentials: true,
				validateStatus: () => true,
			}
		);
		if (response.status >= 200 && response.status < 300) {
			return response.data?.formattedAddress ?? address.trim();
		}
		return address.trim();
	},

	/**
	 * One Google Maps request: road miles + resolved city/state/ZIP and coordinates.
	 * Requires at least 2 locations. Throws when Google cannot build a route.
	 */
	async calculateRouteDistance(locations: string[]): Promise<OfferRouteDistanceResult> {
		const response = await axios.post<OfferRouteDistanceResult & { error?: string }>(
			"/api/offers/calculate-route-distance",
			{ locations },
			{
				headers: { "Content-Type": "application/json" },
				withCredentials: true,
				validateStatus: () => true,
				timeout: 180000,
			}
		);

		const data = response.data;

		if (
			response.status >= 200 &&
			response.status < 300 &&
			typeof data.loadedMiles === "number" &&
			Array.isArray(data.stops)
		) {
			return { loadedMiles: data.loadedMiles, stops: data.stops };
		}

		throw new Error(
			(typeof data === "object" && data?.error) || "Failed to calculate route distance"
		);
	},

	/**
	 * Create a new offer and rate_offers for selected drivers.
	 * Sends form data to Next API route which proxies to backend.
	 */
	async createOffer(payload: CreateOfferPayload): Promise<CreateOfferResponse> {
		try {
			const response = await axios.post<{ id?: number; [key: string]: unknown }>(
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
				data: data as { id: number; [key: string]: unknown },
			};
			}

			const errData = data as {
				error?: string;
				message?: string;
				errors?: string[];
			};
			const errorDetails =
				Array.isArray(errData?.errors) && errData.errors.length > 0
					? errData.errors.filter(Boolean).join(". ")
					: "";
			const errorMsg =
				errorDetails ||
				errData?.error ||
				errData?.message ||
				"Failed to create offer";
			return {
				success: false,
				error: errorMsg,
				errors: errData?.errors,
			};
		} catch (error) {
			console.error("Error in createOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Update an existing offer.
	 */
	async updateOffer(
		offerId: number,
		payload: CreateOfferPayload
	): Promise<UpdateOfferResponse> {
		try {
			const response = await axios.patch<{ id?: number; [key: string]: unknown }>(
				`/api/offers/${offerId}`,
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
					data: data as { id: number; [key: string]: unknown },
				};
			}

			const errData = data as {
				error?: string;
				message?: string;
				errors?: string[];
			};
			const errorDetails =
				Array.isArray(errData?.errors) && errData.errors.length > 0
					? errData.errors.filter(Boolean).join(". ")
					: "";
			const errorMsg =
				errorDetails ||
				errData?.error ||
				errData?.message ||
				"Failed to update offer";
			return {
				success: false,
				error: errorMsg,
				errors: errData?.errors,
			};
		} catch (error) {
			console.error("Error in updateOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Add drivers to an existing offer. Calls PATCH /api/offers/:offerId/drivers.
	 */
	async addDriversToOffer(
		offerId: number,
		driverIds: string[],
		driverEmptyMiles?: Record<string, number>
	): Promise<AddDriversToOfferResponse> {
		try {
			const response = await axios.patch<AddDriversToOfferResponse>(
				`/api/offers/${offerId}/drivers`,
				{
					driverIds,
					...(driverEmptyMiles &&
					Object.keys(driverEmptyMiles).length > 0
						? { driverEmptyMiles }
						: {}),
				},
				{
					headers: { "Content-Type": "application/json" },
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, addedCount: data.addedCount, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to add drivers",
			};
		} catch (error) {
			console.error("Error in addDriversToOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Remove driver from offer (sets active=false in rate_offers).
	 * Refreshes offers list after success.
	 */
	async removeDriverFromOffer(
		offerId: number,
		driverExternalId: string
	): Promise<RemoveDriverFromOfferResponse> {
		try {
			const response = await axios.patch<RemoveDriverFromOfferResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}`,
				{},
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to remove driver",
			};
		} catch (error) {
			console.error("Error in removeDriverFromOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async returnDriverToOffer(
		offerId: number,
		driverExternalId: string
	): Promise<ReturnDriverToOfferResponse> {
		try {
			const response = await axios.patch<ReturnDriverToOfferResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/return`,
				{},
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to return driver",
			};
		} catch (error) {
			console.error("Error in returnDriverToOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async sendDriverReminder(
		offerId: number,
		driverExternalId: string
	): Promise<SendDriverReminderResponse> {
		try {
			const response = await axios.post<SendDriverReminderResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/send-reminder`,
				{},
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					message: data.message,
					reminder_count: data.reminder_count,
					last_reminder_at: data.last_reminder_at,
				};
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to send reminder",
			};
		} catch (error) {
			console.error("Error in sendDriverReminder:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async sendDriversReminders(
		offerId: number,
		driverExternalIds: string[]
	): Promise<SendDriversRemindersResponse> {
		try {
			const response = await axios.post<SendDriversRemindersResponse>(
				`/api/offers/${offerId}/drivers/send-reminders`,
				{ driverExternalIds },
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					message: data.message,
					accepted_count: data.accepted_count,
					skipped_count: data.skipped_count,
					accepted_driver_ids: data.accepted_driver_ids,
					last_reminder_at: data.last_reminder_at,
				};
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to send reminders",
			};
		} catch (error) {
			console.error("Error in sendDriversReminders:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async selectDriverForOffer(
		offerId: number,
		driverExternalId: string
	): Promise<SelectDriverForOfferResponse> {
		try {
			const response = await axios.patch<SelectDriverForOfferResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/select`,
				{},
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to select driver",
			};
		} catch (error) {
			console.error("Error in selectDriverForOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Create (or reopen) an OFFER chat with a driver on this offer.
	 */
	async createOfferDriverChat(
		offerId: number,
		driverExternalId: string
	): Promise<{ success: true; chatRoom: unknown } | { success: false; error: string }> {
		try {
			const response = await axios.post(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/chat`,
				{},
				{
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, chatRoom: data };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to create offer chat",
			};
		} catch (error) {
			console.error("Error in createOfferDriverChat:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async setDriverCounterOffer(
		offerId: number,
		driverExternalId: string,
		counterOffer: number
	): Promise<SetDriverCounterOfferResponse> {
		try {
			const response = await axios.patch<SetDriverCounterOfferResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/counter-offer`,
				{ counterOffer },
				{
					headers: { "Content-Type": "application/json" },
					withCredentials: true,
					validateStatus: () => true,
				}
			);
			const data = response.data as SetDriverCounterOfferResponse & {
				errors?: string[];
			};
			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					counter_offer: data.counter_offer,
					rate: data.rate,
					counter_offer_sent_count: data.counter_offer_sent_count,
					message: data.message,
				};
			}
			const errors = Array.isArray(data.errors) ? data.errors : [];
			return {
				success: false,
				code: data.code,
				error:
					(typeof errors[0] === "string" ? errors[0] : null) ??
					data.error ??
					data.message ??
					"Failed to save counter offer",
			};
		} catch (error) {
			console.error("Error in setDriverCounterOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	async extendDriverTime(
		offerId: number,
		driverExternalId: string,
		payload: { extendTimeMinutes: number }
	): Promise<ExtendDriverTimeResponse> {
		try {
			const response = await axios.patch<ExtendDriverTimeResponse>(
				`/api/offers/${offerId}/drivers/${encodeURIComponent(driverExternalId)}/extend-time`,
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
					action_time: data.action_time,
					action_time_display: data.action_time_display,
					message: data.message,
				};
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to extend driver time",
			};
		} catch (error) {
			console.error("Error in extendDriverTime:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Deactivate an offer (sets active=false in offers table).
	 */
	async deactivateOffer(offerId: number): Promise<DeactivateOfferResponse> {
		try {
			const response = await axios.patch<DeactivateOfferResponse>(
				`/api/offers/${offerId}/deactivate-offer`,
				{},
				{ withCredentials: true, validateStatus: () => true }
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to deactivate offer",
			};
		} catch (error) {
			console.error("Error in deactivateOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Deactivate multiple offers in one request (sets active=false).
	 */
	async deactivateOffers(offerIds: number[]): Promise<DeactivateOffersResponse> {
		try {
			const response = await axios.patch<DeactivateOffersResponse>(
				`/api/offers/deactivate-offers`,
				{ offerIds },
				{ withCredentials: true, validateStatus: () => true }
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					message: data.message,
					deactivatedIds: data.deactivatedIds ?? [],
				};
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to deactivate offers",
			};
		} catch (error) {
			console.error("Error in deactivateOffers:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Return an inactive offer: reactivate it and reset driver bids.
	 */
	async returnOffer(offerId: number): Promise<ReturnOfferResponse> {
		try {
			const response = await axios.patch<ReturnOfferResponse>(
				`/api/offers/${offerId}/return-offer`,
				{},
				{ withCredentials: true, validateStatus: () => true }
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return { success: true, message: data.message };
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to return offer",
			};
		} catch (error) {
			console.error("Error in returnOffer:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},

	/**
	 * Return multiple inactive offers in one request.
	 */
	async returnOffers(offerIds: number[]): Promise<ReturnOffersResponse> {
		try {
			const response = await axios.patch<ReturnOffersResponse>(
				`/api/offers/return-offers`,
				{ offerIds },
				{ withCredentials: true, validateStatus: () => true }
			);
			const data = response.data;
			if (response.status >= 200 && response.status < 300) {
				return {
					success: true,
					message: data.message,
					returnedIds: data.returnedIds ?? [],
				};
			}
			return {
				success: false,
				error:
					(data as { error?: string; message?: string })?.error ??
					(data as { message?: string })?.message ??
					"Failed to return offers",
			};
		} catch (error) {
			console.error("Error in returnOffers:", error);
			return {
				success: false,
				error: axios.isAxiosError(error) ? error.message : "Network error",
			};
		}
	},
};

export default offers;
