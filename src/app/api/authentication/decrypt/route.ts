import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

export function GET(req: NextRequest) {
	const payload = req.nextUrl.searchParams.get("payload");
	const secret = process.env.ENCRYPTION_SECRET;

	if (!payload || !secret) {
		return NextResponse.json({ error: "Missing payload or secret" }, { status: 400 });
	}

	try {
		const [ivHex, encryptedHex] = payload.split(":");
		const iv = Buffer.from(ivHex, "hex");
		const encrypted = Buffer.from(encryptedHex, "hex");

		const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(secret, "hex"), iv);

		// Fixed the type issue
		let decrypted = decipher.update(encrypted).toString("utf8");
		decrypted += decipher.final("utf8");

		const decryptedData = JSON.parse(decrypted);

		return NextResponse.json(decryptedData);
	} catch (err) {
		return NextResponse.json({ error: `Invalid payload: ${err}` }, { status: 400 });
	}
}
