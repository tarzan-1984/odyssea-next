"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
	deleteNewsArticleMediaInBackground,
	isDeletableNewsArticleMediaUrl,
} from "@/app-api/deleteNewsArticleMediaInBackground";
import {
	newsImageAlignClass,
	newsImageWidthClass,
	NEWS_IMAGE_LINK_OVERLAY_CLASS,
	normalizeNewsImageWidth,
} from "./news-image-extension";
import NewsImageDeleteIcon from "./NewsImageDeleteIcon";
import { useNewsEditorUploadCancel } from "./NewsEditorUploadContext";
import { cn } from "@/utils";

export default function NewsImageNodeView({
	node,
	selected,
	deleteNode,
}: NodeViewProps) {
	const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
	const textAlign =
		typeof node.attrs.textAlign === "string" ? node.attrs.textAlign : null;
	const widthPercent = normalizeNewsImageWidth(node.attrs.widthPercent);
	const href = typeof node.attrs.href === "string" ? node.attrs.href.trim() : "";
	const hasLink = /^https?:\/\//i.test(href);
	const alignClass = newsImageAlignClass(textAlign);
	const widthClass = newsImageWidthClass(widthPercent);
	const cancelUploadByPreviewUrl = useNewsEditorUploadCancel();

	const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();

		if (src.startsWith("blob:")) {
			cancelUploadByPreviewUrl?.(src);
		} else if (isDeletableNewsArticleMediaUrl(src)) {
			deleteNewsArticleMediaInBackground(src);
		}

		deleteNode();
	};

	return (
		<NodeViewWrapper
			as="div"
			className={cn("news-image-node my-3", alignClass)}
			contentEditable={false}
			data-drag-handle
		>
			<div
				className={cn(
					"news-image-frame group relative",
					widthClass,
					selected &&
						"rounded-lg border-2 border-brand-500 shadow-[0_0_0_1px_rgba(70,95,255,0.35)]",
				)}
			>
				<img src={src} alt="" className="news-image-el" draggable={false} />

				{hasLink ? (
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer nofollow"
						className={NEWS_IMAGE_LINK_OVERLAY_CLASS}
						aria-label="Open image link"
						onClick={event => event.preventDefault()}
					/>
				) : null}

				<button
					type="button"
					className={cn(
						"absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md transition-opacity hover:bg-black/75",
						selected
							? "opacity-100"
							: "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
					)}
					onClick={handleDelete}
					aria-label="Remove image"
				>
					<NewsImageDeleteIcon className="h-4 w-4" />
				</button>
			</div>
		</NodeViewWrapper>
	);
}
