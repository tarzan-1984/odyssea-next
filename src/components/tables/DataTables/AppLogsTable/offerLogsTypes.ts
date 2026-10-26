export type OfferLogRow = {
	id: string;
	createDate: string;
	title: string;
	offerId: number;
	creator: string;
	driversIds: string[];
	openedDriversIds: string[];
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
