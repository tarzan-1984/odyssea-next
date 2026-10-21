import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canCreateLoadChat } from "@/utils/roleAccess";

const LOAD_CHAT_COMPANIES = new Set(["Odysseia", "Martlet", "Endurance"]);

function backendErrorMessage(data: unknown, fallback: string): string {
	if (!data || typeof data !== "object") return fallback;
	const record = data as { message?: unknown; error?: unknown };
	if (Array.isArray(record.message)) {
		const parts = record.message.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
		if (parts.length > 0) return parts.join("; ");
	}
	if (typeof record.message === "string" && record.message.trim()) return record.message;
	if (typeof record.error === "string" && record.error.trim() && record.error !== "Bad Request") {
		return record.error;
	}
	return fallback;
}

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		const user = serverAuth.getUserData(request);
		if (!accessToken || !user) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}
		if (!canCreateLoadChat(user.role)) {
			return NextResponse.json({ error: "Access denied" }, { status: 403 });
		}

		const body = await request.json();
		const loadId = typeof body.load_id === "string" ? body.load_id.trim() : "";
		const title = typeof body.title === "string" ? body.title.trim() : "";
		const company = typeof body.company === "string" ? body.company.trim() : "";
		const dispatchMessage = typeof body.dispatch_message === "string" ? body.dispatch_message : "";
		const rawParticipants = Array.isArray(body.participants) ? body.participants : null;

		if (!loadId || !title || !LOAD_CHAT_COMPANIES.has(company) || !rawParticipants) {
			return NextResponse.json(
				{ error: "load_id, title, company and participants are required" },
				{ status: 400 }
			);
		}

		const participants: Array<{ id: string; role: string }> = rawParticipants
			.map((participant: { id?: unknown; role?: unknown }) => ({
				id: typeof participant?.id === "string" ? participant.id.trim() : "",
				role: typeof participant?.role === "string" ? participant.role.trim() : "",
			}))
			.filter((participant: { id: string; role: string }) => Boolean(participant.id && participant.role));

		if (participants.length === 0) {
			return NextResponse.json({ error: "At least one participant is required" }, { status: 400 });
		}
		if (!participants.some(participant => participant.role.toUpperCase() === "DRIVER")) {
			return NextResponse.json({ error: "At least one driver is required" }, { status: 400 });
		}

		const payload: Record<string, unknown> = {
			load_id: loadId,
			title,
			company,
			participants,
		};
		if (dispatchMessage.trim()) {
			payload.dispatch_message = dispatchMessage;
		}

		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/create_load_chat`;
		const response = await fetch(backendUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const raw = await response.text();
		let data: unknown = null;
		if (raw) {
			try {
				data = JSON.parse(raw);
			} catch {
				data = { error: raw };
			}
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: backendErrorMessage(data, "Failed to create load chat") },
				{ status: response.status }
			);
		}

		return NextResponse.json(data ?? {});
	} catch (error) {
		console.error("Error creating load chat:", error);
		return NextResponse.json({ error: "Failed to create load chat" }, { status: 500 });
	}
}
