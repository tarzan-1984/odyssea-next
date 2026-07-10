"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Input from "@/components/form/input/InputField";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "./CheckListTablePagination";
import Button from "@/components/ui/button/Button";
import { AngleDownIcon, AngleUpIcon } from "@/icons";
import CheckListPushModal from "./CheckListPushModal";
import CheckListEmailModal from "./CheckListEmailModal";
import CheckListChatModal from "./CheckListChatModal";
import CheckListPhoneLink from "./CheckListPhoneLink";
import CheckListDriverNameLink from "./CheckListDriverNameLink";
import { copyDriverPhoneNumbers } from "./copyCheckListPhoneNumbers";
import { formatCheckListNyDate } from "./formatCheckListNyDate";
import type {
	CheckListDriver,
	CheckListVersionDevice,
	CheckListVersionDriver,
	CheckListVersionResponse,
} from "./checkListTypes";
import { formatDriverUnitLine } from "./checkListTypes";
import { useCurrentUser } from "@/stores/userStore";
import { canManageCheckListDevices } from "@/utils/roleAccess";

export type CheckListAppVersionSort = "asc" | "desc";

function toCheckListDriver(driver: CheckListVersionDriver): CheckListDriver {
	return {
		id: driver.id,
		firstName: driver.firstName,
		lastName: driver.lastName,
		email: driver.email,
		externalId: driver.externalId,
		phone: driver.phone,
		driverStatus: null,
		lastActiveApp: null,
		lastLocationUpdateAt: null,
		trackingLoadId: null,
	};
}

async function fetchCheckListDriverDevicesPage(
	apiPath: string,
	page: number,
	perPage: number,
	search: string,
	appVersionSort: CheckListAppVersionSort,
): Promise<CheckListVersionResponse> {
	const q = search.trim();
	const res = await axios.get<CheckListVersionResponse>(apiPath, {
		params: {
			page,
			limit: perPage,
			appVersionSort,
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

async function blockCheckListDevice(deviceRowId: string): Promise<void> {
	const res = await axios.patch(
		`/api/users/user-devices/${encodeURIComponent(deviceRowId)}/block`,
		{},
		{ withCredentials: true, validateStatus: () => true },
	);
	if (res.status < 200 || res.status >= 300) {
		const msg =
			(res.data as { error?: string })?.error ||
			`Request failed with status ${res.status}`;
		throw new Error(msg);
	}
}

async function unblockCheckListDevice(deviceRowId: string): Promise<void> {
	const res = await axios.patch(
		`/api/users/user-devices/${encodeURIComponent(deviceRowId)}/unblock`,
		{},
		{ withCredentials: true, validateStatus: () => true },
	);
	if (res.status < 200 || res.status >= 300) {
		const msg =
			(res.data as { error?: string })?.error ||
			`Request failed with status ${res.status}`;
		throw new Error(msg);
	}
}

async function deleteCheckListDevice(deviceRowId: string): Promise<void> {
	const res = await axios.delete(`/api/users/user-devices/${encodeURIComponent(deviceRowId)}`, {
		withCredentials: true,
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) {
		const msg =
			(res.data as { error?: string })?.error ||
			`Request failed with status ${res.status}`;
		throw new Error(msg);
	}
}

type CheckListDriverDevicesTableProps = {
	apiPath: string;
	queryKey: string;
	getEmptyMessage: (minimumAppVersion?: string) => string;
	getPushDefaultMessage: (minimumAppVersion: string) => string;
	getEmailDefaultMessage?: (minimumAppVersion: string) => string;
	/** When true, shows the minimum allowed app version from App settings above the table. */
	showMinimumAppVersion?: boolean;
	/** When true, shows last_active_at per device (Several devices tab). */
	showLastOpenAppColumn?: boolean;
};

export default function CheckListDriverDevicesTable({
	apiPath,
	queryKey,
	getEmptyMessage,
	getPushDefaultMessage,
	getEmailDefaultMessage,
	showMinimumAppVersion = false,
	showLastOpenAppColumn = false,
}: CheckListDriverDevicesTableProps) {
	const currentUser = useCurrentUser();
	const canManageDevices = canManageCheckListDevices(currentUser?.role);
	const queryClient = useQueryClient();
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [appVersionSort, setAppVersionSort] = useState<CheckListAppVersionSort>("asc");
	const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
	const [pushModalDrivers, setPushModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [emailModalDrivers, setEmailModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [chatModalDrivers, setChatModalDrivers] = useState<CheckListDriver[] | null>(null);
	const [deviceActionError, setDeviceActionError] = useState<string | null>(null);
	const [deviceActionLoadingId, setDeviceActionLoadingId] = useState<string | null>(null);
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
	}, [currentPage, itemsPerPage, debouncedSearch, appVersionSort]);

	const query = useQuery({
		queryKey: [queryKey, currentPage, itemsPerPage, debouncedSearch, appVersionSort],
		queryFn: () =>
			fetchCheckListDriverDevicesPage(
				apiPath,
				currentPage,
				itemsPerPage,
				debouncedSearch,
				appVersionSort,
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
	const minimumAppVersion = query.data?.minimumAppVersion ?? "";
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

	const toggleAppVersionSort = () => {
		setAppVersionSort(prev => (prev === "asc" ? "desc" : "asc"));
		setCurrentPage(1);
	};

	const handleBlockDevice = async (device: CheckListVersionDevice) => {
		const isBlocked = Boolean(device.blocked);
		const confirmed = isBlocked
			? window.confirm("Unblock this device? The driver will be able to sign in from it again.")
			: window.confirm(
					"Block this device? The driver will be signed out and will not be able to sign in from this device.",
				);
		if (!confirmed) {
			return;
		}
		setDeviceActionError(null);
		setDeviceActionLoadingId(device.id);
		try {
			if (isBlocked) {
				await unblockCheckListDevice(device.id);
			} else {
				await blockCheckListDevice(device.id);
			}
			await queryClient.invalidateQueries({ queryKey: [queryKey] });
		} catch (err) {
			setDeviceActionError(
				(err as Error)?.message ||
					(isBlocked ? "Failed to unblock device" : "Failed to block device"),
			);
		} finally {
			setDeviceActionLoadingId(null);
		}
	};

	const handleDeleteDevice = async (device: CheckListVersionDevice) => {
		if (
			!window.confirm(
				"Remove this device from the driver's account? The driver will be signed out on that device.",
			)
		) {
			return;
		}
		setDeviceActionError(null);
		setDeviceActionLoadingId(device.id);
		try {
			await deleteCheckListDevice(device.id);
			await queryClient.invalidateQueries({ queryKey: [queryKey] });
		} catch (err) {
			setDeviceActionError((err as Error)?.message || "Failed to delete device");
		} finally {
			setDeviceActionLoadingId(null);
		}
	};

	const emptyMessage = getEmptyMessage(minimumAppVersion);
	const pushDefaultMessage = getPushDefaultMessage(minimumAppVersion);
	const emailDefaultMessage = (getEmailDefaultMessage ?? getPushDefaultMessage)(minimumAppVersion);
	const tableColumnCount = showLastOpenAppColumn ? 8 : 7;

	return (
		<div className="relative min-w-0 bg-white dark:bg-white/[0.03] rounded-xl">
			{showMinimumAppVersion && (
				<div className="rounded-t-xl border-b border-gray-100 px-4 py-3 dark:border-white/[0.05]">
					<p className="text-sm text-gray-700 dark:text-gray-300">
						Latest allowed app version:{" "}
						{query.isPending ? (
							<span className="text-gray-400 dark:text-gray-500">Loading…</span>
						) : minimumAppVersion ? (
							<span className="font-semibold text-brand-500">{minimumAppVersion}</span>
						) : (
							<>
								<span className="font-semibold text-gray-500 dark:text-gray-400">—</span>
								<span className="ml-2 text-gray-500 dark:text-gray-400">
									(not configured in App settings)
								</span>
							</>
						)}
					</p>
				</div>
			)}
			<div
				className={`relative z-20 flex flex-col gap-3 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] lg:flex-row lg:items-center lg:justify-between lg:gap-4 ${
					showMinimumAppVersion ? "" : "rounded-t-xl"
				}`}
			>
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
							placeholder="Search by name, driver U, email…"
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
									const selected = drivers
										.filter(d => selectedDriverIds.has(d.id))
										.map(toCheckListDriver);
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
									const selected = drivers
										.filter(d => selectedDriverIds.has(d.id))
										.map(toCheckListDriver);
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
									const selected = drivers
										.filter(d => selectedDriverIds.has(d.id))
										.map(toCheckListDriver);
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
			</div>

			<CheckListTablePagination
				position="top"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`top-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}-${appVersionSort}`}
				onPageChange={setCurrentPage}
			/>

			{deviceActionError && (
				<div className="border-x border-gray-100 px-4 py-2 text-sm text-red-500 dark:border-white/[0.05]">
					{deviceActionError}
				</div>
			)}

			<div className="overflow-x-auto border-x border-gray-100 dark:border-white/[0.05]">
				<div className="min-w-[800px]">
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
									Driver
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Platform
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									<div
										role="button"
										tabIndex={0}
										className="flex cursor-pointer items-center justify-between gap-2 text-left"
										onClick={toggleAppVersionSort}
										onKeyDown={e => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												toggleAppVersionSort();
											}
										}}
									>
										<span>App Version</span>
										<span className="flex flex-col gap-0.5 shrink-0" aria-hidden>
											<AngleUpIcon
												className={
													appVersionSort === "asc"
														? "text-brand-500"
														: "text-gray-300 dark:text-gray-700"
												}
											/>
											<AngleDownIcon
												className={
													appVersionSort === "desc"
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
									Device Name
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Model
								</TableCell>
								{showLastOpenAppColumn && (
									<TableCell
										isHeader
										className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
									>
										Last open app
									</TableCell>
								)}
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
									<TableCell colSpan={tableColumnCount} className="px-5 py-8 text-center text-red-500">
										{(query.error as Error)?.message || "Failed to load check list"}
									</TableCell>
								</TableRow>
							)}
							{!query.isError && !query.isPending && drivers.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={tableColumnCount}
										className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
									>
										{emptyMessage}
									</TableCell>
								</TableRow>
							)}
							{drivers.flatMap((driver: CheckListVersionDriver) =>
								driver.devices.map((device, deviceIndex) => (
									<TableRow
										key={`${driver.id}-${device.id}`}
										className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"
									>
										{deviceIndex === 0 && (
											<>
												<TableCell
													rowSpan={driver.devices.length}
													className="px-3 py-3 sm:px-4 align-middle"
												>
													<input
														type="checkbox"
														className="h-4 w-4 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
														checked={selectedDriverIds.has(driver.id)}
														onChange={e =>
															toggleRowSelected(driver.id, e.target.checked)
														}
														aria-label={`Select ${`${driver.firstName} ${driver.lastName}`.trim() || "driver"}`}
													/>
												</TableCell>
												<TableCell
													rowSpan={driver.devices.length}
													className="px-4 py-3 text-gray-800 dark:text-gray-200 align-top"
												>
													<div className="flex flex-col gap-0.5">
														<span className="font-medium">
															<CheckListDriverNameLink
																firstName={driver.firstName}
																lastName={driver.lastName}
																externalId={driver.externalId}
															/>
														</span>
														<span className="text-xs text-gray-500 dark:text-gray-400">
															{formatDriverUnitLine(driver.externalId)}
														</span>
														<span className="text-xs text-gray-500 dark:text-gray-400 break-all">
															{driver.email || "—"}
														</span>
														<span className="text-xs text-gray-500 dark:text-gray-400">
															<CheckListPhoneLink phone={driver.phone} />
														</span>
														<Button
															size="sm"
															variant="outline"
															type="button"
															className="!mt-2 !px-2 !py-1 !text-xs h-auto w-fit rounded-md"
															onClick={() =>
																setEmailModalDrivers([toCheckListDriver(driver)])
															}
															disabled={!driver.email?.trim()}
														>
															Send Email
														</Button>
													</div>
												</TableCell>
											</>
										)}
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
											{device.platform || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
											{device.appVersion || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
											{device.deviceName || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
											{device.model || "—"}
										</TableCell>
										{showLastOpenAppColumn && (
											<TableCell className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
												{formatCheckListNyDate(device.lastActiveAt)}
											</TableCell>
										)}
										<TableCell className="px-4 py-3 text-right whitespace-nowrap">
											<div className="flex flex-wrap items-center justify-end gap-2">
												{canManageDevices && (
													<Button
														size="sm"
														variant="outline"
														type="button"
														className={`!px-2 !py-1 !text-xs h-auto rounded-md ${
															device.blocked
																? "text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20"
																: ""
														}`}
														onClick={() => handleBlockDevice(device)}
														disabled={
															deviceActionLoadingId === device.id || query.isPending
														}
													>
														{deviceActionLoadingId === device.id
															? device.blocked
																? "Unblocking…"
																: "Blocking…"
															: device.blocked
																? "Blocked"
																: "Block"}
													</Button>
												)}
												{canManageDevices && (
													<Button
														size="sm"
														variant="outline"
														type="button"
														className="!px-2 !py-1 !text-xs h-auto rounded-md text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20"
														onClick={() => handleDeleteDevice(device)}
														disabled={
															deviceActionLoadingId === device.id || query.isPending
														}
													>
														{deviceActionLoadingId === device.id
															? "Deleting…"
															: "Delete"}
													</Button>
												)}
												<Button
													size="sm"
													variant="primary"
													type="button"
													className="!px-2 !py-1 !text-xs h-auto rounded-md"
													onClick={() =>
														setPushModalDrivers([toCheckListDriver(driver)])
													}
												>
													Send push
												</Button>
											</div>
										</TableCell>
									</TableRow>
								)),
							)}
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
				paginationKey={`bottom-${currentPage}-${totalPages}-${itemsPerPage}-${debouncedSearch}-${appVersionSort}`}
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
				defaultMessage={pushDefaultMessage}
			/>
			<CheckListPushModal
				isOpen={pushModalDrivers !== null && pushModalDrivers.length > 0}
				onClose={() => setPushModalDrivers(null)}
				drivers={pushModalDrivers}
				defaultMessage={pushDefaultMessage}
			/>
			<CheckListEmailModal
				isOpen={emailModalDrivers !== null && emailModalDrivers.length > 0}
				onClose={() => setEmailModalDrivers(null)}
				drivers={emailModalDrivers}
				defaultMessage={emailDefaultMessage}
			/>
		</div>
	);
}
