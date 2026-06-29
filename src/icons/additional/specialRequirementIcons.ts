export const SPECIAL_REQUIREMENT_LABELS: Record<string, string> = {
	ace: "ACE",
	aci: "ACI",
	airport: "Airport",
	alcohol: "Alcohol",
	"blind-shipment": "Blind shipment",
	"direct-delivery": "Direct Delivery",
	"dock-high": "Dock High",
	"driver-assist": "Driver assist",
	"fake-team": "Fake team",
	fragile: "Fragile",
	"hemp-product": "Hemp product",
	"high-value-freight": "High value freight",
	hazmat: "Hazmat",
	liftgate: "Liftgate",
	mexico: "Mexico",
	"military-base": "Military base",
	"pallet-jack": "Pallet Jack",
	partial: "Partial",
	"round-trip": "Round trip",
	tsa: "TSA",
	twic: "TWIC",
	"temperature-control": "Temperature control",
	"true-team": "True team",
	"tanker-end": "Tanker End",
	"white-glove-service": "White glove service",
};

/** Static assets in /public/icons/special-requirements */
export const SPECIAL_REQ_ICON_URL_MAP: Record<string, string> = {
	ace: "/icons/special-requirements/ACE.svg",
	aci: "/icons/special-requirements/ACI.svg",
	airport: "/icons/special-requirements/airport.svg",
	alcohol: "/icons/special-requirements/alcohol.svg",
	"blind-shipment": "/icons/special-requirements/blind_shipment.svg",
	"direct-delivery": "/icons/special-requirements/direct-delivery.svg",
	"dock-high": "/icons/special-requirements/dock-high.svg",
	"driver-assist": "/icons/special-requirements/driver_assist.svg",
	"fake-team": "/icons/special-requirements/fake _team.svg",
	fragile: "/icons/special-requirements/fragile.svg",
	"hemp-product": "/icons/special-requirements/hemp_product.svg",
	"high-value-freight": "/icons/special-requirements/high_value _reight.svg",
	hazmat: "/icons/special-requirements/hazmat.svg",
	liftgate: "/icons/special-requirements/liftgate.svg",
	mexico: "/icons/special-requirements/mexico.svg",
	"military-base": "/icons/special-requirements/military.svg",
	"pallet-jack": "/icons/special-requirements/pallet-jack.svg",
	partial: "/icons/special-requirements/partial.svg",
	"round-trip": "/icons/special-requirements/round_trip.svg",
	tsa: "/icons/special-requirements/tsa.svg",
	twic: "/icons/special-requirements/twic.svg",
	"temperature-control": "/icons/special-requirements/temperature_control.svg",
	"true-team": "/icons/special-requirements/team.svg",
	"tanker-end": "/icons/special-requirements/tanker-endorsement.svg",
	"white-glove-service": "/icons/special-requirements/glove.svg",
};

export function normalizeSpecialRequirementValue(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
}

export function getSpecialRequirementIconUrl(value: string): string | null {
	const key = normalizeSpecialRequirementValue(value);
	if (SPECIAL_REQ_ICON_URL_MAP[key]) {
		return SPECIAL_REQ_ICON_URL_MAP[key];
	}

	const byLabel = Object.entries(SPECIAL_REQUIREMENT_LABELS).find(
		([, label]) => label.toLowerCase() === value.trim().toLowerCase(),
	);
	if (byLabel) {
		return SPECIAL_REQ_ICON_URL_MAP[byLabel[0]] ?? null;
	}

	return null;
}

export function getSpecialRequirementLabel(value: string): string {
	const normalized = normalizeSpecialRequirementValue(value);
	if (SPECIAL_REQUIREMENT_LABELS[normalized]) {
		return SPECIAL_REQUIREMENT_LABELS[normalized];
	}

	const byLabel = Object.entries(SPECIAL_REQUIREMENT_LABELS).find(
		([, label]) => label.toLowerCase() === value.trim().toLowerCase(),
	);
	if (byLabel) return byLabel[1];

	return value
		.trim()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\b\w/g, char => char.toUpperCase());
}

export function parseSpecialRequirements(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value.map(v => String(v).trim()).filter(Boolean);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return [];
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.map(v => String(v).trim()).filter(Boolean);
			}
		} catch {
			// fall through to comma-separated
		}
		return trimmed
			.split(",")
			.map(v => v.trim())
			.filter(Boolean);
	}
	return [];
}
