"use client";

import React from "react";
import type { ChatMessageAttachment } from "@/app-api/chatApi";
import FilePreview from "@/components/chats/FilePreview";

function formatKb(size?: number | null): string {
	if (size == null || Number.isNaN(size)) return "";
	return `${Math.round(Number(size) / 1024)}KB`;
}

async function downloadFile(fileUrl: string, fileName: string) {
	try {
		const response = await fetch(fileUrl, { method: "GET", mode: "cors" });
		if (!response.ok) throw new Error("Failed to download file");
		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	} catch {
		window.open(fileUrl, "_blank");
	}
}

interface MessageAttachmentsGridProps {
	items: ChatMessageAttachment[];
	isOutgoing?: boolean;
}

/**
 * Desktop (md+): 3 columns when 4+ files. Mobile: always at most 2 columns per row.
 */
export default function MessageAttachmentsGrid({ items, isOutgoing = false }: MessageAttachmentsGridProps) {
	if (!items?.length) return null;

	const useThreeColumns = items.length > 3;

	const cellFrame = isOutgoing
		? "rounded-lg border border-white/20 bg-white/10"
		: "rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800";

	const nameCls = isOutgoing
		? "text-xs font-medium text-white truncate"
		: "text-xs font-medium text-gray-900 dark:text-white truncate";

	const metaCls = isOutgoing ? "text-[10px] text-white/70" : "text-[10px] text-gray-500 dark:text-gray-400";

	const downloadBtnCls =
		"flex w-full shrink-0 items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors";

	const gridClass = [
		"grid items-stretch gap-2 w-max max-w-full",
		useThreeColumns
			? "grid-cols-2 md:grid-cols-3 max-w-[min(100%,14rem)] md:max-w-[min(100%,20rem)]"
			: "grid-cols-2 max-w-[min(100%,14rem)]",
	].join(" ");

	return (
		<div className={gridClass}>
			{items.map((a, idx) => {
				const key = `${a.fileUrl}-${idx}`;
				const kb = formatKb(a.fileSize);
				const safeName = a.fileName || "File";

				return (
					<div key={key} className={`${cellFrame} flex h-full min-h-0 flex-col overflow-hidden`}>
						<div className="shrink-0">
							<FilePreview compact fileUrl={a.fileUrl} fileName={safeName} fileSize={a.fileSize} />
						</div>
						<div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1 pt-1">
							<div className="min-h-0">
								<p className={nameCls} title={a.fileName}>
									{safeName}
								</p>
								{kb ? <p className={metaCls}>{kb}</p> : null}
							</div>
							<button
								type="button"
								onClick={e => {
									e.preventDefault();
									e.stopPropagation();
									downloadFile(a.fileUrl, safeName).catch(() => {});
								}}
								className={`${downloadBtnCls} mt-auto`}
							>
								<svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								Download
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
