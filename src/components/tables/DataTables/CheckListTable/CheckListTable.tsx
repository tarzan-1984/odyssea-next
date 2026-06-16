"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { AngleDownIcon, AngleUpIcon, LoadTrackingChatIcon } from "@/icons";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "./CheckListTablePagination";
import type { CheckListDriver, CheckListResponse } from "./checkListTypes";
import CheckListPushModal, { CHECK_LIST_PUSH_DEFAULT_MESSAGE } from "./CheckListPushModal";
import CheckListEmailModal from "./CheckListEmailModal";
import CheckListChatModal from "./CheckListChatModal";
import CheckListPhoneLink from "./CheckListPhoneLink";
import CheckListDriverNameLink from "./CheckListDriverNameLink";
import { copyDriverPhoneNumbers } from "./copyCheckListPhoneNumbers";

const NY_TZ = "America/New_York";

function formatInNy(isoOrNyWall: string | null | undefined): string {
	if (!isoOrNyWall) return "—";
	try {
		const raw = isoOrNyWall.trim();
		const hasT = raw.includes("T");
		const d = hasT ? new Date(raw) : new Date(raw.replace(" ", "T"));
		if (Number.isNaN(d.getTime())) return raw;
		return new Intl.DateTimeFormat("en-US", {
			timeZone: NY_TZ,
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		}).format(d);
	} catch {
		return isoOrNyWall;
	}
}

export const CHECK_LIST_DRIVER_STATUS_VALUES = ["all", "available", "loaded_enroute"] as const;
export type CheckListDriverStatusFilter = (typeof CHECK_LIST_DRIVER_STATUS_VALUES)[number];
export type CheckListLastLocationSort = "asc" | "desc";

async function fetchCheckListPage(
	page: number,
	perPage: number,
	driverStatus: CheckListDriverStatusFilter,
	search: string,
	lastLocationSort: CheckListLastLocationSort,
): Promise<CheckListResponse> {
	const q = search.trim();
	const res = await axios.get<CheckListResponse>("/api/users/drivers/check-list", {
		params: {
			page,
			limit: perPage,
			lastLocationSort,
			...(driverStatus !== "all" ? { driverStatus } : {}),
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

export type { CheckListDriver } from "./checkListTypes";

export default function CheckListTable() {
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [statusFilter, setStatusFilter] = useState<CheckListDriverStatusFilter>("all");
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [lastLocationSort, setLastLocationSort] =
		useState<CheckListLastLocationSort>("asc");
	const [pushModalDrivers, setPushModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [emailModalDrivers, setEmailModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [chatModalDrivers, setChatModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
	const selectAllPageRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedSearch]);

	useEffect(() => {
		setSelectedDriverIds(new Set());
	}, [currentPage, itemsPerPage, statusFilter, debouncedSearch, lastLocationSort]);

	const query = useQuery({
		queryKey: [
			"drivers-check-list",
			currentPage,
			itemsPerPage,
			statusFilter,
			debouncedSearch,
			lastLocationSort,
		],
		queryFn: () =>
			fetchCheckListPage(
				currentPage,
				itemsPerPage,
				statusFilter,
				debouncedSearch,
				lastLocationSort,
			),
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		const totalPages = query.data?.pagination?.total_pages ?? 0;
		if (totalPages > 0 && currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [query.data?.pagination?.total_pages, currentPage]);

	const drivers = query.data?.drivers ?? [];
	const totalItems = query.data?.pagination?.total_count ?? 0;
	const totalPages = query.data?.pagination?.total_pages ?? 0;

	useEffect(() => {
		const allowed = new Set(drivers.map(d => d.id));
		setSelectedDriverIds(prev => {
			if (prev.size === 0) return prev;
			const next = new Set([...prev].filter(id => allowed.has(id)));
			return next.size === prev.size ? prev : next;
		});
	}, [drivers]);

	const allPageSelected =
		drivers.length > 0 && drivers.every(d => selectedDriverIds.has(d.id));
	const somePageSelected = drivers.some(d => selectedDriverIds.has(d.id));

	useEffect(() => {
		const el = selectAllPageRef.current;
		if (el) {
			el.indeterminate = somePageSelected && !allPageSelected;
		}
	}, [somePageSelected, allPageSelected, drivers]);

	const toggleSelectAllOnPage = () => {
		if (allPageSelected) {
			setSelectedDriverIds(prev => {
				const next = new Set(prev);
				drivers.forEach(d => next.delete(d.id));
				return next;
			});
		} else {
			setSelectedDriverIds(prev => {
				const next = new Set(prev);
				drivers.forEach(d => next.add(d.id));
				return next;
			});
		}
	};

	const toggleRowSelected = (id: string, checked: boolean) => {
		setSelectedDriverIds(prev => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const toggleLastLocationSort = () => {
		setLastLocationSort((prev) => (prev === "asc" ? "desc" : "asc"));
		setCurrentPage(1);
	};

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
				<div className="flex w-full min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
					<div className="min-w-0 flex-1 lg:max-w-xl lg:px-2">
						<Input
							type="text"
							placeholder="Search by name, driver ID, email, load ID…"
							value={searchInput}
							onChange={e => setSearchInput(e.target.value)}
							className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600"
						/>
					</div>
					{selectedDriverIds.size > 0 && (
						<>
							<Button
								type="button"
								size="sm"
								variant="primary"
								className="h-10 shrink-0 whitespace-nowrap"
								onClick={async () => {
									const selected = drivers.filter(d => selectedDriverIds.has(d.id));
									await copyDriverPhoneNumbers(selected.map(d => d.phone));
								}}
							>
								Copy all numbers
							</Button>
							<Button
								type="button"
								size="sm"
								variant="primary"
								className="h-10 shrink-0 whitespace-nowrap"
								onClick={() => {
									const selected = drivers.filter(d => selectedDriverIds.has(d.id));
									if (selected.length > 0) {
										setChatModalDrivers(selected);
									}
								}}
							>
								Create chat
							</Button>
							<Button
								type="button"
								size="sm"
								variant="primary"
								className="h-10 shrink-0 whitespace-nowrap"
								onClick={() => {
									const selected = drivers.filter(d => selectedDriverIds.has(d.id));
									if (selected.length > 0) {
										setPushModalDrivers(selected);
									}
								}}
							>
								Send push
							</Button>
							<Button
								type="button"
								size="sm"
								variant="primary"
								className="h-10 shrink-0 whitespace-nowrap"
								onClick={() => {
									const selected = drivers.filter(d => selectedDriverIds.has(d.id));
									if (selected.length > 0) {
										setEmailModalDrivers(selected);
									}
								}}
							>
								Send Email
							</Button>
						</>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
					<span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
						Driver status
					</span>
					<div className="min-w-[10rem]">
						<CustomStaticSelect
							options={[
								{ value: "all", label: "All" },
								{ value: "available", label: "Available" },
								{ value: "loaded_enroute", label: "Load & Enroute" },
							]}
							value={statusFilter}
							onChangeAction={val => {
								setStatusFilter(val as CheckListDriverStatusFilter);
								setCurrentPage(1);
							}}
						/>
					</div>
				</div>
			</div>

			<CheckListTablePagination
				position="top"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`top-${currentPage}-${totalPages}-${itemsPerPage}-${statusFilter}-${debouncedSearch}-${lastLocationSort}`}
				onPageChange={setCurrentPage}
			/>

			<div className="overflow-x-auto border-x border-gray-100 dark:border-white/[0.05]">
				<div className="min-w-[900px]">
					<Table>
						<TableHeader className="border-b border-gray-100 bg-gray-50 text-gray-700 dark:border-white/[0.05] dark:bg-gray-900 dark:text-gray-300">
							<TableRow>
								<TableCell
									isHeader
									className="w-12 px-3 py-3 sm:px-4"
									aria-label="Select rows"
								>
									<input
										ref={selectAllPageRef}
										type="checkbox"
										className="h-4 w-4 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
										checked={allPageSelected}
										onChange={toggleSelectAllOnPage}
										disabled={drivers.length === 0 || query.isPending}
										title="Select all on this page"
										aria-label="Select all drivers on this page"
									/>
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Status
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Driver
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Last open app
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									<div
										role="button"
										tabIndex={0}
										className="flex cursor-pointer items-center justify-between gap-2 text-left"
										onClick={toggleLastLocationSort}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												toggleLastLocationSort();
											}
										}}
									>
										<span>Last location update</span>
										<span className="flex flex-col gap-0.5 shrink-0" aria-hidden>
											<AngleUpIcon
												className={
													lastLocationSort === "asc"
														? "text-brand-500"
														: "text-gray-300 dark:text-gray-700"
												}
											/>
											<AngleDownIcon
												className={
													lastLocationSort === "desc"
														? "text-brand-500"
														: "text-gray-300 dark:text-gray-700"
												}
											/>
										</span>
									</div>
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Load Id
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap text-right"
								>
									Action
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody className="text-sm divide-y divide-gray-100 dark:divide-white/[0.05]">
							{query.isError && (
								<TableRow>
									<TableCell colSpan={7} className="px-5 py-8 text-center text-red-500">
										{(query.error as Error)?.message || "Failed to load check list"}
									</TableCell>
								</TableRow>
							)}
							{!query.isError && !query.isPending && drivers.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
									>
										No drivers match the criteria
									</TableCell>
								</TableRow>
							)}
							{drivers.map(row => (
								<TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
									<TableCell className="px-3 py-3 sm:px-4 align-middle">
										<input
											type="checkbox"
											className="h-4 w-4 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
											checked={selectedDriverIds.has(row.id)}
											onChange={e => toggleRowSelected(row.id, e.target.checked)}
											aria-label={`Select ${`${row.firstName} ${row.lastName}`.trim() || "driver"}`}
										/>
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap font-mono text-xs">
										{row.driverStatus ?? "—"}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-800 dark:text-gray-200">
										<div className="flex flex-col gap-0.5">
											<span className="font-medium">
												<CheckListDriverNameLink
													firstName={row.firstName}
													lastName={row.lastName}
													externalId={row.externalId}
												/>
											</span>
											<span className="text-xs text-gray-500 dark:text-gray-400">
												ID: {row.externalId ?? "—"}
											</span>
											<span className="text-xs text-gray-500 dark:text-gray-400 break-all">
												{row.email || "—"}
											</span>
											<span className="text-xs text-gray-500 dark:text-gray-400">
												<CheckListPhoneLink phone={row.phone} />
											</span>
										</div>
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
										{formatInNy(row.lastActiveApp)}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
										{formatInNy(row.lastLocationUpdateAt)}
									</TableCell>
									<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
										{row.trackingLoadId?.trim() ? (
											<span className="inline-flex items-center gap-2">
												<a
													href={`https://www.endurance-tms.com/add-load/?post_id=${encodeURIComponent(
														row.trackingLoadId.trim()
													)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="text-brand-500 hover:underline dark:text-brand-400"
												>
													{row.trackingLoadId.trim()}
												</a>
												<Link
													href={`/tracking/load/${encodeURIComponent(row.trackingLoadId.trim())}`}
													className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400"
													aria-label="Track load on map"
													title="Track load"
												>
													<LoadTrackingChatIcon className="h-[22px] w-[22px]" />
												</Link>
											</span>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="px-4 py-3 text-right whitespace-nowrap">
										<div className="flex flex-wrap justify-end gap-1.5">
											<Button
												size="sm"
												variant="primary"
												type="button"
												className="!px-2 !py-1 !text-xs h-auto rounded-md"
												onClick={() => setPushModalDrivers([row])}
											>
												Send push
											</Button>
											<Button
												size="sm"
												variant="outline"
												type="button"
												className="!px-2 !py-1 !text-xs h-auto rounded-md"
												onClick={() => setEmailModalDrivers([row])}
												disabled={!row.email?.trim()}
											>
												Send Email
											</Button>
										</div>
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
				paginationKey={`bottom-${currentPage}-${totalPages}-${itemsPerPage}-${statusFilter}-${debouncedSearch}-${lastLocationSort}`}
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
			<CheckListChatModal
				isOpen={chatModalDrivers !== null && chatModalDrivers.length > 0}
				onClose={() => setChatModalDrivers(null)}
				drivers={chatModalDrivers}
				defaultMessage={CHECK_LIST_PUSH_DEFAULT_MESSAGE}
			/>
			<CheckListPushModal
				isOpen={pushModalDrivers !== null && pushModalDrivers.length > 0}
				onClose={() => setPushModalDrivers(null)}
				drivers={pushModalDrivers}
				defaultMessage={CHECK_LIST_PUSH_DEFAULT_MESSAGE}
			/>
			<CheckListEmailModal
				isOpen={emailModalDrivers !== null && emailModalDrivers.length > 0}
				onClose={() => setEmailModalDrivers(null)}
				drivers={emailModalDrivers}
				defaultMessage={CHECK_LIST_PUSH_DEFAULT_MESSAGE}
			/>
		</div>
	);
}
