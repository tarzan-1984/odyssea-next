"use client";

import { useMemo } from "react";
import NewsTextFilePreview from "./NewsTextFilePreview";
import { parseNewsArticleHtml } from "./parseNewsArticleHtml";
import { unwrapNewsArticleShell } from "./newsArticleBackground";

type NewsArticleBodyProps = {
	html: string;
};

export default function NewsArticleBody({ html }: NewsArticleBodyProps) {
	const { backgroundColor, innerHtml } = useMemo(
		() => unwrapNewsArticleShell(html),
		[html],
	);
	const parts = useMemo(() => parseNewsArticleHtml(innerHtml), [innerHtml]);

	return (
		<div
			className="news-article-body"
			style={backgroundColor ? { backgroundColor } : undefined}
		>
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
