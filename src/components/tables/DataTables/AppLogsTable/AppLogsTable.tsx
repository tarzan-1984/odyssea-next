"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Input from "@/components/form/input/InputField";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "../CheckListTable/CheckListTablePagination";
import AppLogDataCell from "./AppLogDataCell";
import {
	formatAppLogCreatedAt,
	getAppLogOpenChatHref,
	getAppLogTitle,
	isAppLogFailed,
	isAppLogWarning,
	type AppLogsResponse,
} from "./appLogsTypes";

async function fetchAppLogsPage(
	page: number,
	perPage: number,
	search: string,
): Promise<AppLogsResponse> {
	const q = search.trim();
	const res = await axios.get<AppLogsResponse>("/api/load-chats-logs", {
		params: {
			page,
			limit: perPage,
			...(q ? { search: q } : {}),
		},
		withCredentials: true,
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) {
		const msg =
			(res.data as { error?: string })?.error ||
			`Request failed with status ${res.status}`;
		throw new Error(msg);
	}
	return res.data;
}

export default function AppLogsTable() {
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(20);
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedSearch]);

	const query = useQuery({
		queryKey: ["app-logs", currentPage, itemsPerPage, debouncedSearch],
		queryFn: () => fetchAppLogsPage(currentPage, itemsPerPage, debouncedSearch),
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		const totalPages = query.data?.pagination?.total_pages ?? 0;
		if (totalPages > 0 && currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [query.data?.pagination?.total_pages, currentPage]);

	const logs = query.data?.logs ?? [];
	const totalItems = query.data?.pagination?.total_count ?? 0;
	const totalPages = query.data?.pagination?.total_pages ?? 0;

	return (
		<div className="relative min-w-0 bg-white dark:bg-white/[0.03] rounded-xl">
			<div className="relative z-20 flex flex-col gap-3 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl lg:flex-row lg:items-center lg:justify-between lg:gap-4">
				<div className="flex flex-wrap items-center gap-3 shrink-0">
					<span className="text-gray-500 dark:text-gray-400"> Show </span>
					<CustomStaticSelect
						options={[
							{ value: "5", label: "5" },
							{ value: "10", label: "10" },
							{ value: "20", label: "20" },
							{ value: "50", label: "50" },
						]}
						value={itemsPerPage.toString()}
						onChangeAction={val => {
							setItemsPerPage(Number(val));
							setCurrentPage(1);
						}}
					/>
					<span className="text-gray-500 dark:text-gray-400"> entries </span>
				</div>
				<div className="min-w-0 flex-1 lg:max-w-xl">
					<Input
						type="text"
						placeholder="Search in data…"
						value={searchInput}
						onChange={e => setSearchInput(e.target.value)}
						className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600"
					/>
				</div>
			</div>

			<CheckListTablePagination
				position="top"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`app-logs-top-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}`}
				onPageChange={setCurrentPage}
			/>

			<div className="overflow-x-auto border-x border-gray-100 dark:border-white/[0.05]">
				<div className="min-w-[1200px]">
					<Table>
						<TableHeader className="border-b border-gray-100 bg-gray-50 text-gray-700 dark:border-white/[0.05] dark:bg-gray-900 dark:text-gray-300">
							<TableRow>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Load id
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Title
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Action
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Source
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Data
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Created at
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap text-right"
								>
									Open chat
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody className="text-sm divide-y divide-gray-100 dark:divide-white/[0.05]">
							{query.isError && (
								<TableRow>
									<TableCell colSpan={7} className="px-5 py-8 text-center text-red-500">
										{(query.error as Error)?.message || "Failed to load app logs"}
									</TableCell>
								</TableRow>
							)}
							{!query.isError && !query.isPending && logs.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
									>
										No logs found
									</TableCell>
								</TableRow>
							)}
							{logs.map(row => {
								const openChatHref = getAppLogOpenChatHref(row);
								const title = getAppLogTitle(row.data);
								const failed = isAppLogFailed(row.data);
								const warning = isAppLogWarning(row.data);
								return (
									<TableRow
										key={row.id}
										className={
											failed
												? "bg-red-50 hover:bg-red-100/80 dark:bg-red-500/10 dark:hover:bg-red-500/15"
												: warning
													? "bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-500/10 dark:hover:bg-orange-500/15"
													: "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
										}
									>
										<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 font-mono text-xs whitespace-nowrap align-top">
											{row.loadId?.trim() || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 align-top max-w-[20rem]">
											<span className="line-clamp-2 break-words" title={title ?? undefined}>
												{title || "—"}
											</span>
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap align-top">
											{row.action || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap align-top">
											{row.source || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[28rem]">
											<AppLogDataCell data={row.data} />
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap align-top">
											{formatAppLogCreatedAt(row.createdAt)}
										</TableCell>
										<TableCell className="px-4 py-3 text-right whitespace-nowrap align-top">
											{openChatHref ? (
												<Link
													href={openChatHref}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex h-auto items-center justify-center rounded-md bg-brand-500 px-2 py-1 text-xs font-medium text-white shadow-theme-xs hover:bg-brand-600"
												>
													Open chat
												</Link>
											) : (
												<span className="text-gray-400 dark:text-gray-600">—</span>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</div>

			<CheckListTablePagination
				position="bottom"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`app-logs-bottom-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}`}
				onPageChange={setCurrentPage}
			/>

			{query.isPending && (
				<div
					className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-white/10 rounded-xl"
					aria-hidden
				>
					<SpinnerOne />
				</div>
			)}
		</div>
	);
}
