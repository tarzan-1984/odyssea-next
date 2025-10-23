"use client";

import React, { useState, useEffect } from "react";

interface FilePreviewProps {
	fileUrl: string;
	fileName: string;
	fileSize?: number;
	messageId?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
	fileUrl,
	fileName,
	fileSize,
	messageId,
}) => {
	const [previewContent, setPreviewContent] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>("");

	const fileExtension = fileName.toLowerCase().split('.').pop();

	useEffect(() => {
		const loadPreview = async () => {
			try {
				setIsLoading(true);
				setError("");

				if (fileExtension === 'txt') {
					// Load text file content
					const response = await fetch(fileUrl);
					const text = await response.text();
					setPreviewContent(text);
				} else if (fileExtension === 'pdf') {
					// For PDF, we'll use iframe approach
					setPreviewContent(fileUrl);
				} else if (fileExtension === 'docx') {
					// For DOCX, we'll show a placeholder with download option
					setPreviewContent("DOCX preview not available - click to download");
				} else if (fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension)) {
					// For images, just set the URL
					setPreviewContent(fileUrl);
				}
			} catch (err) {
				setError("Failed to load preview");
				console.error("Preview error:", err);
			} finally {
				setIsLoading(false);
			}
		};

		loadPreview();
	}, [fileUrl, fileExtension]);

	const renderPreview = () => {
		if (isLoading) {
			return (
				<div className="flex items-center justify-center h-32">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
				</div>
			);
		}

		if (error) {
			return (
				<div className="flex items-center justify-center h-32 text-red-500">
					<p>{error}</p>
				</div>
			);
		}

		switch (fileExtension) {
			case 'txt':
				return (
					<div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
						<pre className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
							{previewContent}
						</pre>
					</div>
				);

			case 'pdf':
				return (
					<div className="h-64 border rounded overflow-hidden">
						<iframe
							src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
							className="w-full h-full"
							title="PDF Preview"
							allow="fullscreen"
							allowFullScreen={false}
						/>
					</div>
				);

			case 'docx':
				return (
					<div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-800 rounded">
						<div className="text-center">
							<svg
								className="w-12 h-12 mx-auto mb-2 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								DOCX Preview
							</p>
							<p className="text-xs text-gray-500 dark:text-gray-500">
								Click to download
							</p>
						</div>
					</div>
				);
			case 'jpg':
			case 'jpeg':
			case 'png':
			case 'gif':
			case 'webp':
			case 'svg':
				return (
					<div className="w-full max-w-[400px] overflow-hidden rounded-lg">
						<img
							src={previewContent}
							alt="File preview"
							className="object-cover w-full h-auto max-h-64"
							onError={(e) => {
								// Hide image if it fails to load
								const target = e.target as HTMLImageElement;
								target.style.display = "none";
								setError("Failed to load image preview");
							}}
						/>
					</div>
				);

			default:
				return (
					<div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-800 rounded">
						<p className="text-gray-600 dark:text-gray-400">
							Preview not available
						</p>
					</div>
				);
		}
	};

	return (
		<div className="mb-2 w-full max-w-[400px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800">
				<div className="flex items-center space-x-2">
					<svg
						className="w-4 h-4 text-gray-600 dark:text-gray-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<span className="text-sm font-medium text-gray-900 dark:text-white truncate">
						{fileName}
					</span>
					{fileSize && (
						<span className="text-xs text-gray-500 dark:text-gray-400">
							({Math.round(fileSize / 1024)}KB)
						</span>
					)}
				</div>
			</div>

			{/* Preview Content */}
			<div className="p-2">
				{renderPreview()}
			</div>

			{/* Download Button */}
			<div className="p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
				<button
					onClick={async (e) => {
						e.preventDefault();
						e.stopPropagation();
						
						try {
							// Download file directly from cloud storage
							const response = await fetch(fileUrl, {
								method: 'GET',
								mode: 'cors',
							});

							if (!response.ok) {
								throw new Error('Failed to download file');
							}

							// Get the file blob
							const blob = await response.blob();
							
							// Create download link
							const url = window.URL.createObjectURL(blob);
							const link = document.createElement('a');
							link.href = url;
							link.download = fileName;
							document.body.appendChild(link);
							link.click();
							document.body.removeChild(link);
							window.URL.revokeObjectURL(url);
						} catch (error) {
							// Fallback: try to open in new tab
							window.open(fileUrl, '_blank');
						}
					}}
					className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					<span>Download</span>
				</button>
			</div>
		</div>
	);
};

export default FilePreview;
