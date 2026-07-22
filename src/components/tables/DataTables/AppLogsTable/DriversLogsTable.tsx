"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Input from "@/components/form/input/InputField";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "../CheckListTable/CheckListTablePagination";
import AppLogDataCell from "./AppLogDataCell";
import { formatAppLogCreatedAt } from "./appLogsTypes";
import type { DriverLogsResponse } from "./driverLogsTypes";

async function fetchDriverLogsPage(
	page: number,
	perPage: number,
	search: string,
): Promise<DriverLogsResponse> {
	const q = search.trim();
	const res = await axios.get<DriverLogsResponse>("/api/driver-logs", {
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

export default function DriversLogsTable() {
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
		queryKey: ["driver-logs", currentPage, itemsPerPage, debouncedSearch],
		queryFn: () => fetchDriverLogsPage(currentPage, itemsPerPage, debouncedSearch),
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
						placeholder="Search by driver id…"
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
				paginationKey={`driver-logs-top-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}`}
				onPageChange={setCurrentPage}
			/>

			<div className="overflow-x-auto border-x border-gray-100 dark:border-white/[0.05]">
				<div className="min-w-[900px]">
					<Table>
						<TableHeader className="border-b border-gray-100 bg-gray-50 text-gray-700 dark:border-white/[0.05] dark:bg-gray-900 dark:text-gray-300">
							<TableRow>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Driver id
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Changes
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
									Created at
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody className="text-sm divide-y divide-gray-100 dark:divide-white/[0.05]">
							{query.isError && (
								<TableRow>
									<TableCell colSpan={4} className="px-5 py-8 text-center text-red-500">
										{(query.error as Error)?.message || "Failed to load driver logs"}
									</TableCell>
								</TableRow>
							)}
							{!query.isError && !query.isPending && logs.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={4}
										className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
									>
										No logs found
									</TableCell>
								</TableRow>
							)}
							{logs.map(row => (
								<TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 font-mono text-xs whitespace-nowrap align-top">
										{row.driverId?.trim() || "—"}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[32rem]">
										<AppLogDataCell data={row.changes} />
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap align-top">
										{row.source || "—"}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap align-top">
										{formatAppLogCreatedAt(row.createdAt)}
									</TableCell>
								</TableRow>
							))}
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
				paginationKey={`driver-logs-bottom-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}`}
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
