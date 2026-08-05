/** Same options as CreateOfferModal special requirements. */
export const SPECIAL_INSTRUCTION_OPTIONS = [
	{ value: "hazmat", text: "Hazmat", selected: false },
	{ value: "tanker-end", text: "Tanker End", selected: false },
	{ value: "direct-delivery", text: "Direct Delivery", selected: false },
	{ value: "driver-assist", text: "Driver assist", selected: false },
	{ value: "liftgate", text: "Liftgate", selected: false },
	{ value: "pallet-jack", text: "Pallet Jack", selected: false },
	{ value: "dock-high", text: "Dock High", selected: false },
	{ value: "true-team", text: "True team", selected: false },
	{ value: "fake-team", text: "Fake team", selected: false },
	{ value: "tsa", text: "TSA", selected: false },
	{ value: "twic", text: "TWIC", selected: false },
	{ value: "airport", text: "Airport", selected: false },
	{ value: "round-trip", text: "Round trip", selected: false },
	{ value: "alcohol", text: "Alcohol", selected: false },
	{ value: "temperature-control", text: "Temperature control", selected: false },
	{ value: "ace", text: "ACE", selected: false },
	{ value: "aci", text: "ACI", selected: false },
	{ value: "mexico", text: "Mexico", selected: false },
	{ value: "military-base", text: "Military base", selected: false },
	{ value: "blind-shipment", text: "Blind shipment", selected: false },
	{ value: "partial", text: "Partial", selected: false },
	{ value: "white-glove-service", text: "White glove service", selected: false },
	{ value: "high-value-freight", text: "High value freight", selected: false },
	{ value: "fragile", text: "Fragile", selected: false },
	{ value: "hemp-product", text: "Hemp product", selected: false },
] as const;

export const EQUIPMENT_OPTIONS = [
	{ value: "cargo_van", label: "Cargo van" },
	{ value: "box_truck", label: "Box truck" },
	{ value: "dry_van", label: "Dry van" },
] as const;

export type EquipmentType = (typeof EQUIPMENT_OPTIONS)[number]["value"];
export type LoadType = "full" | "partial";
export type ShipmentStatus = "posted" | "unposted";

export function getEquipmentLabel(equipment: string): string {
	return (
		EQUIPMENT_OPTIONS.find(option => option.value === equipment)?.label ?? equipment
	);
}

export function getShipmentStatusLabel(status: string): string {
	if (status === "unposted") return "Unposted";
	return "Posted";
}

export type NewShipmentTabId =
	| "load-details"
	| "freight-details"
	| "equipment-details"
	| "additional-information";

export const NEW_SHIPMENT_TABS: { id: NewShipmentTabId; label: string }[] = [
	{ id: "load-details", label: "Load Details" },
	{ id: "freight-details", label: "Freight details" },
	{ id: "equipment-details", label: "Equipment details" },
	{ id: "additional-information", label: "Additional information" },
];
