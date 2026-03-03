/**
 * Constants for Drivers Map - extracted to avoid importing Leaflet during SSR.
 */

export const DRIVER_STATUS_LABELS: Record<string, string> = {
	all: "All statuses",
	available: "Available",
	available_on: "Available On",
	loaded_enroute: "Loaded En Route",
	available_off: "Available Off",
	on_vocation: "On Vocation",
	on_hold: "On Hold",
	need_update: "Need Update",
	no_updates: "No Updates",
	no_interview: "No Interview",
	banned: "Banned",
	expired_documents: "Expired Documents",
	blocked: "Blocked",
	unknown: "Unknown",
};

/** Fixed status options for filter dropdown - same as drivers-list. */
export const DRIVER_STATUS_FILTER_OPTIONS = [
	"Available",
	"Available on",
	"Not available",
	"Loaded & Enroute",
	"Out of service",
	"On vacation",
	"No updates",
	"Blocked",
] as const;

/** Maps raw driver_status (e.g. available_off) to filter label - same logic as drivers-list. */
export function getStatusLabelForFilter(status: string | null | undefined): string {
	if (!status) return "Unknown";
	const key = status.toString().toLowerCase();
	const labels: Record<string, string> = {
		available: "Available",
		available_on: "Available on",
		available_off: "Not available",
		loaded_enroute: "Loaded & Enroute",
		banned: "Out of service",
		on_vocation: "On vacation",
		no_updates: "No updates",
		blocked: "Blocked",
		expired_documents: "Expired documents",
		no_interview: "No Interview",
		on_hold: "On hold",
		need_update: "Need update",
	};
	return labels[key] ?? status;
}
