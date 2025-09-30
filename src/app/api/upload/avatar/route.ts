import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const data = await request.formData();
		const file: File | null = data.get("file") as unknown as File;
		const userId: string | null = data.get("userId") as string;

		if (!file) {
			return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
		}

		if (!userId) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		// Validate file type
		const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
		if (!allowedTypes.includes(file.type)) {
			return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: "File too large. Max size is 5MB" }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Create uploads directory if it doesn't exist
		const uploadsDir = join(process.cwd(), "public", "uploads", "avatars");
		await mkdir(uploadsDir, { recursive: true });

		// Generate filename with userId and timestamp
		const fileExtension = file.name.split(".").pop();
		const timestamp = Math.floor(Date.now() / 1000); // Current time in seconds
		const filename = `avatar-${userId}-${timestamp}.${fileExtension}`;
		const filepath = join(uploadsDir, filename);

		// Check if old avatar exists and delete it (find by userId pattern)
		const existingFiles = await readdir(uploadsDir).catch(() => []);
		const userIdPattern = new RegExp(`^avatar-${userId}-\\d+\\.${fileExtension}$`);

		for (const existingFile of existingFiles) {
			if (userIdPattern.test(existingFile)) {
				const oldFilepath = join(uploadsDir, existingFile);
				await unlink(oldFilepath);
			}
		}

		// Save new file
		await writeFile(filepath, buffer);

		// Return the public URL
		const avatarUrl = `/uploads/avatars/${filename}`;

		return NextResponse.json({
			success: true,
			avatarUrl,
			message: "Avatar uploaded successfully",
		});
	} catch (error) {
		console.error("Error uploading avatar:", error);
		return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
	}
}
