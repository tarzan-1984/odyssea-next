import { createCipheriv, randomBytes } from "crypto";

const TOKEN_VERSION = 1;
const IV_BYTES = 12;

function encryptionKey(): Buffer {
	const secret = process.env.ENCRYPTION_SECRET?.trim() ?? "";
	if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
		throw new Error("ENCRYPTION_SECRET must be a 32-byte hex string");
	}
	return Buffer.from(secret, "hex");
}

/**
 * Same AES-256-GCM token as the Nest `encryptLoadTrackingId` helper.
 * base64url(version || iv || authTag || ciphertext) of `{ v: 1, id }`.
 */
export function encryptLoadTrackingId(loadId: string): string {
	const id = loadId.trim();
	if (!id) {
		throw new Error("loadId is required");
	}

	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const plaintext = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, id }), "utf8");
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([Buffer.from([TOKEN_VERSION]), iv, tag, encrypted]).toString("base64url");
}
