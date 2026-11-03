import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_LOAD_FILES_URL = "https://www.endurance-tms.com/wp-json/tms/v1/load/files";
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

// GET /api/tms/load/[loadId]/files — TMS load files (project=odysseia, is_flt=false).
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const trimmedLoadId = loadId?.trim();
		if (!trimmedLoadId) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const url = new URL(TMS_LOAD_FILES_URL);
		url.searchParams.set("load_id", trimmedLoadId);
		url.searchParams.set("project", "odysseia");
		url.searchParams.set("is_flt", "false");

		const response = await axios.get(url.toString(), {
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": TMS_API_KEY,
			},
			timeout: 30000,
			validateStatus: () => true,
		});

		const body = response.data;
		if (response.status < 200 || response.status >= 300 || body?.success === false) {
			const message =
				(typeof body?.message === "string" && body.message) ||
				(typeof body?.error === "string" && body.error) ||
				"Failed to load files from TMS";
			return NextResponse.json({ error: message }, { status: response.status || 502 });
		}

		return NextResponse.json(body, { status: 200 });
	} catch (error) {
		console.error("Error getting TMS load files:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

const TMS_UPLOAD_FILE_TYPES = new Set([
	"pod",
	"freight_pictures",
	"freight_pictures_pickup",
	"other_files",
]);

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

// POST /api/tms/load/[loadId]/files — upload load files (project=odysseia, is_flt=false).
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const trimmedLoadId = loadId?.trim();
		if (!trimmedLoadId) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const userId = serverAuth.getUserData(request)?.externalId?.trim();
		if (!userId) {
			return NextResponse.json({ error: "User id is missing" }, { status: 400 });
		}

		const incoming = await request.formData();
		const fileType = String(incoming.get("file_type") ?? "").trim();
		if (!TMS_UPLOAD_FILE_TYPES.has(fileType)) {
			return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
		}

		const files = incoming.getAll("files[]").filter((entry): entry is File => entry instanceof File);
		if (files.length === 0) {
			return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
		}
		if (fileType === "pod" && files.length !== 1) {
			return NextResponse.json({ error: "Proof Of Delivery accepts one file" }, { status: 400 });
		}
		if (files.length > MAX_UPLOAD_FILES) {
			return NextResponse.json({ error: "You can upload up to 20 files" }, { status: 400 });
		}
		if (files.some(file => file.size > MAX_UPLOAD_FILE_BYTES)) {
			return NextResponse.json({ error: "Each file must be 50MB or smaller" }, { status: 400 });
		}

		const outbound = new FormData();
		outbound.append("load_id", trimmedLoadId);
		outbound.append("project", "odysseia");
		outbound.append("is_flt", "false");
		outbound.append("user_id", userId);
		outbound.append("file_type", fileType);
		for (const file of files) {
			outbound.append("files[]", file, file.name || "file");
		}

		const response = await fetch(TMS_LOAD_FILES_URL, {
			method: "POST",
			headers: {
				"X-API-Key": TMS_API_KEY,
			},
			body: outbound,
		});

		const body = (await response.json().catch(() => null)) as
			| { success?: boolean; message?: string; error?: string }
			| null;
		if (!response.ok || body?.success === false) {
			const message =
				(typeof body?.message === "string" && body.message) ||
				(typeof body?.error === "string" && body.error) ||
				"Failed to upload files to TMS";
			return NextResponse.json({ error: message }, { status: response.status || 502 });
		}

		return NextResponse.json(body ?? { success: true }, { status: 200 });
	} catch (error) {
		console.error("Error uploading TMS load files:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
