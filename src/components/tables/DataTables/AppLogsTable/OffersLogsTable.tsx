"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Input from "@/components/form/input/InputField";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "../CheckListTable/CheckListTablePagination";
import { formatAppLogCreatedAt } from "./appLogsTypes";
import type { OfferLogsResponse } from "./offerLogsTypes";

async function fetchOfferLogsPage(
	page: number,
	perPage: number,
	driverExternalId: string,
	dateFrom: string,
	dateTo: string,
): Promise<OfferLogsResponse> {
	const driverId = driverExternalId.trim();
	const res = await axios.get<OfferLogsResponse>("/api/offers-logs", {
		params: {
			page,
			limit: perPage,
			...(driverId ? { driver_external_id: driverId } : {}),
			...(dateFrom ? { date_from: dateFrom } : {}),
			...(dateTo ? { date_to: dateTo } : {}),
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

function OfferLogDrivers({
	driversIds,
	openedDriversIds,
}: {
	driversIds?: string[];
	openedDriversIds?: string[];
}) {
	const ids = (driversIds ?? []).map(id => id.trim()).filter(Boolean);
	if (ids.length === 0) return <>—</>;
	const opened = new Set((openedDriversIds ?? []).map(id => id.trim()).filter(Boolean));
	return (
		<>
			{ids.map((id, index) => (
				<span key={`${id}-${index}`}>
					{index > 0 ? ", " : null}
					<span className={opened.has(id) ? "text-blue-500 dark:text-blue-400" : undefined}>
						{id}
					</span>
				</span>
			))}
		</>
	);
}

export default function OffersLogsTable() {
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(20);
	const [driverInput, setDriverInput] = useState("");
	const [debouncedDriverId, setDebouncedDriverId] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedDriverId(driverInput.trim()), 400);
		return () => window.clearTimeout(t);
	}, [driverInput]);

	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedDriverId, dateFrom, dateTo, itemsPerPage]);

	const query = useQuery({
		queryKey: [
			"offer-logs",
			currentPage,
			itemsPerPage,
			debouncedDriverId,
			dateFrom,
			dateTo,
		],
		queryFn: () =>
			fetchOfferLogsPage(
				currentPage,
				itemsPerPage,
				debouncedDriverId,
				dateFrom,
				dateTo,
			),
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
	const filterKey = `${debouncedDriverId}-${dateFrom}-${dateTo}`;

	return (
		<div className="relative min-w-0 bg-white dark:bg-white/[0.03] rounded-xl">
			<div className="relative z-20 flex flex-col gap-3 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl lg:flex-row lg:items-end lg:justify-between lg:gap-4">
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
						}}
					/>
					<span className="text-gray-500 dark:text-gray-400"> entries </span>
				</div>
				<div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
					<label className="block min-w-0">
						<span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
							Driver external id
						</span>
						<Input
							type="text"
							placeholder="External id"
							value={driverInput}
							onChange={e => setDriverInput(e.target.value)}
							className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600"
						/>
					</label>
					<label className="block min-w-0">
						<span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
							Created from
						</span>
						<Input
							type="date"
							value={dateFrom}
							max={dateTo || undefined}
							onChange={e => setDateFrom(e.target.value)}
							className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:[color-scheme:dark] dark:border-gray-600"
						/>
					</label>
					<label className="block min-w-0">
						<span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
							Created to
						</span>
						<Input
							type="date"
							value={dateTo}
							min={dateFrom || undefined}
							onChange={e => setDateTo(e.target.value)}
							className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:[color-scheme:dark] dark:border-gray-600"
						/>
					</label>
				</div>
			</div>

			<CheckListTablePagination
				position="top"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`offer-logs-top-${currentPage}-${totalPages}-${itemsPerPage}-${filterKey}`}
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
									Created at
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
									Offer id
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Creator
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Drivers
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody className="text-sm divide-y divide-gray-100 dark:divide-white/[0.05]">
							{query.isError && (
								<TableRow>
									<TableCell colSpan={5} className="px-5 py-8 text-center text-red-500">
										{(query.error as Error)?.message || "Failed to load offer logs"}
									</TableCell>
								</TableRow>
							)}
							{!query.isError && !query.isPending && logs.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={5}
										className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
									>
										No logs found
									</TableCell>
								</TableRow>
							)}
							{logs.map(row => (
								<TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap align-top">
										{formatAppLogCreatedAt(row.createDate)}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 align-top max-w-[24rem]">
										{row.title?.trim() || "—"}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 font-mono text-xs whitespace-nowrap align-top">
										{row.offerId}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap align-top">
										{row.creator?.trim() || "—"}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs align-top max-w-[20rem]">
										<OfferLogDrivers
											driversIds={row.driversIds}
											openedDriversIds={row.openedDriversIds}
										/>
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
				paginationKey={`offer-logs-bottom-${currentPage}-${totalPages}-${itemsPerPage}-${filterKey}`}
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
