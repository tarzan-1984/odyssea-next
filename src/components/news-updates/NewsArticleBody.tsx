"use client";

import { useMemo } from "react";
import NewsTextFilePreview from "./NewsTextFilePreview";
import { parseNewsArticleHtml } from "./parseNewsArticleHtml";

type NewsArticleBodyProps = {
	html: string;
};

export default function NewsArticleBody({ html }: NewsArticleBodyProps) {
	const parts = useMemo(() => parseNewsArticleHtml(html), [html]);

	return (
		<div className="news-article-body">
			{parts.map((part, index) => {
				if (part.type === "textFile") {
					return (
						<NewsTextFilePreview
							key={`${part.fileUrl}-${index}`}
							fileUrl={part.fileUrl}
							fileName={part.fileName}
							fileSize={part.fileSize}
						/>
					);
				}

				if (!part.content.trim()) {
					return null;
				}

				return (
					<div
						key={`html-${index}`}
						dangerouslySetInnerHTML={{ __html: part.content }}
					/>
				);
			})}
		</div>
	);
}
