"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
	deleteNewsArticleMediaInBackground,
	isDeletableNewsArticleMediaUrl,
} from "@/app-api/deleteNewsArticleMediaInBackground";
import NewsTextFilePreview from "./NewsTextFilePreview";

export default function NewsTextFileNodeView({ node, deleteNode }: NodeViewProps) {
	const fileUrl = node.attrs.fileUrl as string;
	const fileName = node.attrs.fileName as string;
	const fileSize = node.attrs.fileSize as number | null | undefined;

	const handleDelete = () => {
		if (isDeletableNewsArticleMediaUrl(fileUrl)) {
			deleteNewsArticleMediaInBackground(fileUrl);
		}
		deleteNode();
	};

	return (
		<NodeViewWrapper
			className="news-text-file-node"
			contentEditable={false}
			data-drag-handle
		>
			<NewsTextFilePreview
				fileUrl={fileUrl}
				fileName={fileName}
				fileSize={fileSize ?? undefined}
				onDelete={handleDelete}
			/>
		</NodeViewWrapper>
	);
}
