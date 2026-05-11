export type CheckListDriver = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	externalId: string | null;
	phone: string;
	driverStatus: string | null;
	lastActiveApp: string | null;
	lastLocationUpdateAt: string | null;
	trackingLoadId: string | null;
};

export type CheckListResponse = {
	drivers: CheckListDriver[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};
