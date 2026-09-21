"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	fetchFavoriteMessageTemplates,
	MESSAGE_TEMPLATE_FAVORITES_QUERY_KEY,
} from "@/app-api/messageTemplatesApi";

type ChatFavoriteTemplatesStripProps = {
	disabled?: boolean;
	onInsert: (content: string) => void;
};

export default function ChatFavoriteTemplatesStrip({
	disabled,
	onInsert,
}: ChatFavoriteTemplatesStripProps) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const { data: items = [] } = useQuery({
		queryKey: MESSAGE_TEMPLATE_FAVORITES_QUERY_KEY,
		queryFn: fetchFavoriteMessageTemplates,
		staleTime: 30_000,
	});

	useEffect(() => {
		const el = scrollerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if (el.scrollWidth <= el.clientWidth) return;
			if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
			e.preventDefault();
			el.scrollLeft += e.deltaY;
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [items.length]);

	if (items.length === 0) return null;

	return (
		<div
			ref={scrollerRef}
			className="no-scrollbar ml-2 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
		>
			<div className="flex w-max items-center gap-1.5 pr-1">
				{items.map(tpl => {
					const label = tpl.title?.trim() || "Untitled";
					return (
						<button
							key={tpl.id}
							type="button"
							disabled={disabled}
							title={label}
							onClick={() => {
								const content = tpl.content?.trim();
								if (content) onInsert(content);
							}}
							className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-white/10 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-white/15 dark:hover:text-white"
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
