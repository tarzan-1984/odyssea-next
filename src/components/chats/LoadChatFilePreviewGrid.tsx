"use client";

import FilePreview from "@/components/chats/FilePreview";

export type LoadChatFilePreviewItem = {
	key: string;
	name: string;
	previewUrl?: string | null;
	/** Remote or blob URL used for PDF, DOC, and TXT previews. */
	fileUrl?: string | null;
	onRemove?: () => void;
};

function fileExtension(name: string): string {
	return name.toLowerCase().split(".").pop() || "";
}

function fileExtensionLabel(name: string): string {
	return (fileExtension(name) || "file").slice(0, 4).toUpperCase();
}

function canPreviewDocument(name: string, fileUrl?: string | null): boolean {
	if (!fileUrl) return false;
	const extension = fileExtension(name);
	if (extension === "pdf" || extension === "txt") return true;
	return (extension === "doc" || extension === "docx") && /^https?:\/\//i.test(fileUrl);
}

export default function LoadChatFilePreviewGrid({ items }: { items: LoadChatFilePreviewItem[] }) {
	if (items.length === 0) return null;

	return (
		<ul className="mt-4 grid max-h-52 grid-cols-4 gap-2 overflow-y-auto">
			{items.map(item => (
				<li
					key={item.key}
					title={item.name}
					className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
				>
					{item.previewUrl ? (
						<img
							src={item.previewUrl}
							alt={item.name}
							className="h-full w-full object-cover"
						/>
					) : canPreviewDocument(item.name, item.fileUrl) ? (
						<div className="pointer-events-none absolute inset-0 bg-white">
							<FilePreview
								compact
								square
								allowEdit={false}
								fileUrl={item.fileUrl!}
								fileName={item.name}
							/>
						</div>
					) : (
						<div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400">
							{fileExtensionLabel(item.name)}
						</div>
					)}
					{item.onRemove ? (
						<button
							type="button"
							aria-label={`Remove ${item.name}`}
							onClick={item.onRemove}
							className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-lg leading-none text-white hover:bg-black/85"
						>
							×
						</button>
					) : null}
				</li>
			))}
		</ul>
	);
}
