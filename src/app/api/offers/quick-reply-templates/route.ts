import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

function backendUrl(path: string): string {
	return `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${path}`;
}

function errorMessage(data: { message?: unknown; error?: unknown }, fallback: string): string {
	if (typeof data.error === "string" && data.error) return data.error;
	if (typeof data.message === "string" && data.message) return data.message;
	if (Array.isArray(data.message) && typeof data.message[0] === "string") return data.message[0];
	return fallback;
}

export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const response = await fetch(backendUrl("quick-reply-templates"), {
			method: "GET",
			headers: { Authorization: `Bearer ${accessToken}` },
			cache: "no-store",
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: errorMessage(data, "Failed to load templates") },
				{ status: response.status }
			);
		}
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error loading offer quick reply templates:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json().catch(() => null);
		const response = await fetch(backendUrl("quick-reply-templates"), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body ?? {}),
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: errorMessage(data, "Failed to save template") },
				{ status: response.status }
			);
		}
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error creating offer quick reply template:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
