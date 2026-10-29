export type OfferLogRow = {
	id: string;
	createDate: string;
	title: string;
	offerId: number;
	creator: string;
	driversIds: string[];
	openedDriversIds: string[];
	/** Driver external id → last bid, or the counter-offer the driver accepted. */
	rates: Record<string, number>;
	/** Driver external id chosen for the load. */
	selectedDriverId: string | null;
};

export type OfferLogsResponse = {
	logs: OfferLogRow[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};
