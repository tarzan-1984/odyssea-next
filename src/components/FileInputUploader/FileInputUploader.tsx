"use client";

import React, { useState, useRef } from "react";
import { S3Uploader } from "@/app-api/S3Uploader";

interface FileInputUploaderProps {
	onFileUploaded?: (fileData: {
		fileUrl: string;
		key: string;
		fileName: string;
		fileSize: number;
	}) => void;
	acceptedTypes?: string;
	maxSize?: number; // in MB
	disabled?: boolean;
}

export function FileInputUploader({
	onFileUploaded,
	acceptedTypes = "image/*,application/pdf,.doc,.docx,.txt",
	maxSize = 10,
	disabled = false,
}: FileInputUploaderProps) {
	const [status, setStatus] = useState<string>("");
	const [url, setUrl] = useState<string>("");
	const [isUploading, setIsUploading] = useState<boolean>(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Use chatApi for presigned URLs
	const uploader = new S3Uploader();

	const validateFile = (file: File): string | null => {
		// Check file size
		if (file.size > maxSize * 1024 * 1024) {
			return `File size must be less than ${maxSize}MB`;
		}

		// Check file type
		const allowedTypes = acceptedTypes.split(",").map(type => type.trim());
		const fileType = file.type;
		const fileName = file.name.toLowerCase();

		const isAllowed = allowedTypes.some(type => {
			if (type.startsWith(".")) {
				return fileName.endsWith(type);
			}
			if (type.endsWith("/*")) {
				const baseType = type.slice(0, -2);
				return fileType.startsWith(baseType);
			}
			return fileType === type;
		});

		if (!isAllowed) {
			return "File type not allowed";
		}

		return null;
	};

	const onPick: React.ChangeEventHandler<HTMLInputElement> = async e => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file
		const validationError = validateFile(file);
		if (validationError) {
			setStatus(validationError);
			return;
		}

		try {
			setIsUploading(true);
			setStatus("Uploading...");

			const { fileUrl, key } = await uploader.upload(file);

			// Call the callback with file data
			if (onFileUploaded) {
				onFileUploaded({
					fileUrl,
					key,
					fileName: file.name,
					fileSize: file.size,
				});
			}

			setUrl(fileUrl);
			setStatus("Upload successful");
		} catch (err: unknown) {
			console.error("Upload error:", err);
			setStatus(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	const handleClick = () => {
		if (!disabled && fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	return (
		<div className="space-y-2">
			<input
				ref={fileInputRef}
				type="file"
				onChange={onPick}
				accept={acceptedTypes}
				disabled={disabled || isUploading}
				className="hidden"
			/>

			<button
				type="button"
				onClick={handleClick}
				disabled={disabled || isUploading}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				{isUploading ? "Uploading..." : "Choose File"}
			</button>

			{status && (
				<div
					className={`text-sm ${status.includes("successful") ? "text-green-600" : status.includes("error") || status.includes("failed") ? "text-red-600" : "text-gray-600"}`}
				>
					{status}
				</div>
			)}

			{url && (
				<div className="mt-2">
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						className="underline text-blue-600 hover:text-blue-800"
					>
						View uploaded file
					</a>
				</div>
			)}
		</div>
	);
}
