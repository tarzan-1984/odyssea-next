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
