export type CustomerLoadTrackingLink = {
	token: string;
	path: string;
};

/** Authenticated helper. Encrypts a load id into the public /load-tracking path. */
export async function fetchCustomerLoadTrackingLink(
	loadId: string
): Promise<CustomerLoadTrackingLink> {
	const cleanLoadId = loadId.trim();
	if (!cleanLoadId) {
		throw new Error("Load ID is required");
	}

	const response = await fetch(
		`/api/loads/${encodeURIComponent(cleanLoadId)}/customer-tracking-link`,
		{ cache: "no-store" }
	);
	const body = (await response.json().catch(() => null)) as
		| { token?: string; path?: string; error?: string }
		| null;

	if (!response.ok || !body?.token || !body.path) {
		throw new Error(body?.error || "Failed to create tracking link");
	}

	return { token: body.token, path: body.path };
}
