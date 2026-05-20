import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** Proxies POST /v1/message-templates → Nest (JWT). Create or update template. */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/message-templates`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body ?? {}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to save message template" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error saving message template:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/** Proxies GET /v1/message-templates → Nest (JWT). */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const scope = searchParams.get("scope");
		const page = searchParams.get("page") ?? "1";
		const limit = searchParams.get("limit") ?? "10";
		const search = searchParams.get("search");

		const qs = new URLSearchParams();
		if (scope) qs.set("scope", scope);
		qs.set("page", page);
		qs.set("limit", limit);
		if (search && search.trim()) qs.set("search", search.trim());

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/message-templates?${qs.toString()}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to fetch message templates" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching message templates:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
