"use client";

import { useState } from "react";
import { formatAppLogData } from "./appLogsTypes";

type AppLogDataCellProps = {
	data: unknown;
};

export default function AppLogDataCell({ data }: AppLogDataCellProps) {
	const [expanded, setExpanded] = useState(false);
	const text = formatAppLogData(data);
	const isEmpty = text === "—";

	if (isEmpty) {
		return <span className="text-gray-500 dark:text-gray-400">—</span>;
	}

	return (
		<div className="w-full max-w-[28rem] rounded-md bg-gray-50 px-2 py-1 dark:bg-white/[0.04]">
			<pre
				className={`select-text whitespace-pre-wrap break-all text-xs text-gray-700 dark:text-gray-300 ${
					expanded ? "max-h-none" : "line-clamp-3 max-h-16 overflow-hidden"
				}`}
			>
				{text}
			</pre>
			<button
				type="button"
				onClick={() => setExpanded(prev => !prev)}
				aria-expanded={expanded}
				className="mt-1 text-[11px] font-medium text-brand-500 hover:underline dark:text-brand-400"
			>
				{expanded ? "Show less" : "Show more"}
			</button>
		</div>
	);
}
