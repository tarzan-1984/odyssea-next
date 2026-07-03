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

export const DRIVER_UNIT_LABEL = "U";

export function formatDriverUnitLine(externalId: string | null | undefined): string {
	const id = externalId?.trim();
	return id ? `${DRIVER_UNIT_LABEL}: ${id}` : "—";
}

export function formatDriverShortLabel(
	driver: Pick<CheckListDriver, "firstName" | "lastName" | "externalId">,
): string {
	const name = `${driver.firstName} ${driver.lastName}`.trim() || "—";
	const id = driver.externalId?.trim();
	return id ? `${name} (${DRIVER_UNIT_LABEL}: ${id})` : name;
}

export type CheckListVersionDevice = {
	id: string;
	platform: string;
	appVersion: string | null;
	deviceName: string | null;
	model: string | null;
	blocked?: boolean;
	lastActiveAt?: string | null;
};

export type CheckListVersionDriver = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	externalId: string | null;
	phone: string;
	devices: CheckListVersionDevice[];
};

export type CheckListVersionResponse = {
	drivers: CheckListVersionDriver[];
	minimumAppVersion?: string;
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};

export type CheckListSeveralDevicesResponse = {
	drivers: CheckListVersionDriver[];
	pagination: CheckListVersionResponse["pagination"];
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
