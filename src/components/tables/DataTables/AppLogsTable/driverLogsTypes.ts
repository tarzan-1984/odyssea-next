export type DriverLogRow = {
	id: string;
	driverId: string;
	changes: string;
	source: string;
	createdAt: string;
};

export type DriverLogsResponse = {
	logs: DriverLogRow[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};
