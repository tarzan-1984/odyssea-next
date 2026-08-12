"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
	deleteLoadBoardShipment,
	getLoadBoardShipments,
	updateLoadBoardShipmentStatus,
	type LoadBoardAgeSort,
	type LoadBoardShipment,
	type RateLoadBoard,
} from "@/app-api/loadBoardShipments";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import {
	AngleDownIcon,
	AngleUpIcon,
	LoadBoardActionsIcon,
	LoadBoardDeleteIcon,
	LoadBoardDuplicateIcon,
	LoadBoardEditIcon,
	OfferAcceptIcon,
	OfferDeleteIcon,
} from "@/icons";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CheckListTablePagination from "@/components/tables/DataTables/CheckListTable/CheckListTablePagination";
import SpecialRequirementsList from "@/components/offers/SpecialRequirementsList";
import UserFilterSelect from "@/components/OffersList/UserFilterSelect";
import { formatRoute } from "@/app-api/offers";
import { useCurrentUser } from "@/stores/userStore";
import { LOAD_BOARD_ALLOWED_ROLES } from "@/utils/roleAccess";
import {
	formatEquipment,
	formatPickupColumn,
	formatRate,
	formatShipmentAge,
	formatStatus,
	formatWeightLbs,
	getTripEndpoints,
	isLoadBoardPickupExpired,
} from "./loadBoardTableUtils";

const LOAD_BOARD_QUERY_KEY = "load-board-shipments";

type LoadBoardTableProps = {
	refreshKey?: number;
	onEditShipment?: (shipment: LoadBoardShipment) => void;
	onDuplicateShipment?: (shipment: LoadBoardShipment) => void;
};

export default function LoadBoardTable({
	refreshKey = 0,
	onEditShipment,
	onDuplicateShipment,
}: LoadBoardTableProps) {
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMINISTRATOR";
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage] = useState(10);
	const [ageSort, setAgeSort] = useState<LoadBoardAgeSort>("desc");
	const [userFilterId, setUserFilterId] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [now, setNow] = useState(() => new Date());
	const selectAllPageRef = useRef<HTMLInputElement>(null);
	/** Align Age "now" with the server clock that wrote created_at (NY wall). */
	const serverSkewMsRef = useRef(0);

	const ownAuthorId =
		String(currentUser?.externalId ?? "").trim() ||
		String(currentUser?.id ?? "").trim();

	const queryParams = {
		page: currentPage,
		limit: itemsPerPage,
		ageSort,
		...(isAdmin
			? userFilterId
				? { user_id: userFilterId }
				: {}
			: { user_id: ownAuthorId }),
	};

	const query = useQuery({
		queryKey: [LOAD_BOARD_QUERY_KEY, queryParams],
		queryFn: () => getLoadBoardShipments(queryParams),
		placeholderData: keepPreviousData,
		enabled: isAdmin || Boolean(ownAuthorId),
	});

	useEffect(() => {
		const serverTime = query.data?.serverTime;
		if (!serverTime) return;
		const serverMs = Date.parse(serverTime);
		if (!Number.isFinite(serverMs)) return;
		serverSkewMsRef.current = serverMs - Date.now();
		setNow(new Date(Date.now() + serverSkewMsRef.current));
	}, [query.data?.serverTime, query.dataUpdatedAt]);

	useEffect(() => {
		const id = window.setInterval(() => {
			setNow(new Date(Date.now() + serverSkewMsRef.current));
		}, 1000);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		setSelectedIds(new Set());
		setExpandedId(null);
	}, [currentPage, itemsPerPage, ageSort, userFilterId]);

	const refreshLoadBoard = () => {
		queryClient
			.invalidateQueries({ queryKey: [LOAD_BOARD_QUERY_KEY] })
			.catch(() => undefined);
		queryClient
			.refetchQueries({
				queryKey: [LOAD_BOARD_QUERY_KEY],
				type: "active",
			})
			.catch(() => undefined);
	};

	useEffect(() => {
		if (refreshKey > 0) {
			refreshLoadBoard();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react to refreshKey bumps
	}, [refreshKey]);

	useEffect(() => {
		const totalPages = query.data?.pagination?.total_pages ?? 0;
		if (totalPages > 0 && currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [query.data?.pagination?.total_pages, currentPage]);

	const shipments = query.data?.shipments ?? [];
	const totalItems = query.data?.pagination?.total_count ?? 0;
	const totalPages = query.data?.pagination?.total_pages ?? 0;

	useEffect(() => {
		const allowed = new Set(shipments.map(s => s.id));
		setSelectedIds(prev => {
			if (prev.size === 0) return prev;
			const next = new Set([...prev].filter(id => allowed.has(id)));
			return next.size === prev.size ? prev : next;
		});
	}, [shipments]);

	const allPageSelected =
		shipments.length > 0 && shipments.every(s => selectedIds.has(s.id));
	const somePageSelected = shipments.some(s => selectedIds.has(s.id));

	useEffect(() => {
		const el = selectAllPageRef.current;
		if (el) {
			el.indeterminate = somePageSelected && !allPageSelected;
		}
	}, [somePageSelected, allPageSelected, shipments]);

	const toggleSelectAllOnPage = () => {
		if (allPageSelected) {
			setSelectedIds(prev => {
				const next = new Set(prev);
				shipments.forEach(s => next.delete(s.id));
				return next;
			});
		} else {
			setSelectedIds(prev => {
				const next = new Set(prev);
				shipments.forEach(s => next.add(s.id));
				return next;
			});
		}
	};

	const toggleRowSelected = (id: number, checked: boolean) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const toggleAgeSort = () => {
		setAgeSort(prev => (prev === "desc" ? "asc" : "desc"));
		setCurrentPage(1);
	};

	const toggleExpanded = (id: number) => {
		setExpandedId(prev => (prev === id ? null : id));
	};

	const colCount = 11;

	return (
		<div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
			<CheckListTablePagination
				position="top"
				currentPage={currentPage}
				itemsPerPage={itemsPerPage}
				totalItems={totalItems}
				totalPages={totalPages}
				paginationKey={`lb-top-${currentPage}-${totalPages}-${itemsPerPage}-${ageSort}-${userFilterId}`}
				onPageChange={setCurrentPage}
				selectedCount={selectedIds.size}
				filters={
					isAdmin ? (
						<>
							<span className="text-gray-500 dark:text-gray-400">User</span>
							<UserFilterSelect
								value={userFilterId}
								roles={LOAD_BOARD_ALLOWED_ROLES}
								queryKeyPrefix="load-board-user-filter"
								onChangeAction={val => {
									setUserFilterId(val);
									setCurrentPage(1);
								}}
							/>
						</>
					) : undefined
				}
			/>

			<div className="overflow-x-auto border-x border-gray-100 dark:border-white/[0.05]">
				<div className="min-w-[1100px]">
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
										disabled={shipments.length === 0 || query.isPending}
										title="Select all on this page"
										aria-label="Select all shipments on this page"
									/>
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									<div
										role="button"
										tabIndex={0}
										className="flex cursor-pointer items-center justify-between gap-2 text-left"
										onClick={toggleAgeSort}
										onKeyDown={e => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												toggleAgeSort();
											}
										}}
									>
										<span>Age</span>
										<span className="flex flex-col gap-0.5 shrink-0" aria-hidden>
											<AngleUpIcon
												className={
													ageSort === "asc"
														? "h-3 w-3 text-brand-500"
														: "h-3 w-3 text-gray-400"
												}
											/>
											<AngleDownIcon
												className={
													ageSort === "desc"
														? "h-3 w-3 text-brand-500"
														: "h-3 w-3 text-gray-400"
												}
											/>
										</span>
									</div>
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Pick up
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Trip
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Reference
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Equipment
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Weight
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Rate
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Bids
								</TableCell>
								<TableCell
									isHeader
									className="px-4 py-3 text-xs font-medium sm:px-5 sm:text-sm whitespace-nowrap"
								>
									Status
								</TableCell>
								<TableCell
									isHeader
									className="w-14 px-3 py-3 text-xs font-medium sm:px-4"
								>
									<span className="sr-only">Edit</span>
								</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.isPending && shipments.length === 0 ? (
								<TableRow>
									<TableCell colSpan={colCount} className="px-5 py-10 text-center">
										<div className="flex justify-center">
											<SpinnerOne />
										</div>
									</TableCell>
								</TableRow>
							) : query.isError ? (
								<TableRow>
									<TableCell
										colSpan={colCount}
										className="px-5 py-8 text-center text-sm text-red-500 dark:text-red-400"
									>
										{(query.error as Error)?.message || "Failed to load shipments"}
									</TableCell>
								</TableRow>
							) : shipments.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={colCount}
										className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
									>
										No shipments yet
									</TableCell>
								</TableRow>
							) : (
								shipments.map(shipment => (
									<ShipmentRows
										key={shipment.id}
										shipment={shipment}
										selected={selectedIds.has(shipment.id)}
										expanded={expandedId === shipment.id}
										now={now}
										onToggleSelected={checked =>
											toggleRowSelected(shipment.id, checked)
										}
										onToggleExpanded={() => toggleExpanded(shipment.id)}
										onEdit={() => onEditShipment?.(shipment)}
										onDuplicate={() => onDuplicateShipment?.(shipment)}
										onStatusChanged={refreshLoadBoard}
										onDeleted={refreshLoadBoard}
									/>
								))
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
				paginationKey={`lb-bottom-${currentPage}-${totalPages}-${itemsPerPage}-${ageSort}-${userFilterId}`}
				onPageChange={setCurrentPage}
				selectedCount={selectedIds.size}
			/>
		</div>
	);
}

function driverDisplayName(bid: RateLoadBoard): string {
	const first = bid.driver?.firstName?.trim() || "";
	const last = bid.driver?.lastName?.trim() || "";
	const name = `${first} ${last}`.trim();
	return name || bid.driverExternalId || bid.driverId || "—";
}

function ShipmentRows({
	shipment,
	selected,
	expanded,
	now,
	onToggleSelected,
	onToggleExpanded,
	onEdit,
	onDuplicate,
	onStatusChanged,
	onDeleted,
}: {
	shipment: LoadBoardShipment;
	selected: boolean;
	expanded: boolean;
	now: Date;
	onToggleSelected: (checked: boolean) => void;
	onToggleExpanded: () => void;
	onEdit?: () => void;
	onDuplicate?: () => void;
	onStatusChanged?: () => void;
	onDeleted?: () => void;
}) {
	const trip = getTripEndpoints(shipment);
	const statusLabel = formatStatus(shipment.status);
	const isPosted = shipment.status !== "unposted";
	const pickupExpired = isLoadBoardPickupExpired(shipment, now);
	const postBlocked = !isPosted && pickupExpired;
	const bids = (shipment.rateLoadBoards ?? []).filter(bid => bid.active !== false);
	const bidsCount = bids.length;
	const [menuOpen, setMenuOpen] = useState(false);
	const [actionPending, setActionPending] = useState(false);
	const menuAnchorRef = useRef<HTMLButtonElement>(null);

	const closeMenu = () => setMenuOpen(false);

	const handleToggleStatus = async () => {
		closeMenu();
		setActionPending(true);
		try {
			await updateLoadBoardShipmentStatus(
				shipment.id,
				isPosted ? "unposted" : "posted",
			);
			onStatusChanged?.();
		} catch (err) {
			window.alert(
				err instanceof Error ? err.message : "Failed to update shipment status",
			);
		} finally {
			setActionPending(false);
		}
	};

	const handleDelete = async () => {
		closeMenu();
		const confirmed = window.confirm(
			"Delete this shipment permanently? This cannot be undone.",
		);
		if (!confirmed) return;
		setActionPending(true);
		try {
			await deleteLoadBoardShipment(shipment.id);
			onDeleted?.();
		} catch (err) {
			window.alert(
				err instanceof Error ? err.message : "Failed to delete shipment",
			);
		} finally {
			setActionPending(false);
		}
	};

	const isUnposted = shipment.status === "unposted";
	const unpostedRowBg = "bg-warning-50 dark:bg-warning-500/15";
	const rowBg = isUnposted
		? unpostedRowBg
		: expanded
			? "bg-gray-50/70 dark:bg-white/[0.02]"
			: "";

	return (
		<>
			<TableRow
				className={`border-b border-gray-100 dark:border-white/[0.05] ${rowBg}`}
			>
				<TableCell className="w-12 px-3 py-3 sm:px-4" onClick={e => e.stopPropagation()}>
					<input
						type="checkbox"
						className="h-4 w-4 cursor-pointer rounded border border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
						checked={selected}
						onChange={e => onToggleSelected(e.target.checked)}
						aria-label={`Select shipment ${shipment.id}`}
					/>
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5 whitespace-nowrap"
					onClick={onToggleExpanded}
				>
					{formatShipmentAge(shipment.createdAt, now)}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5 whitespace-nowrap"
					onClick={onToggleExpanded}
				>
					{formatPickupColumn(shipment)}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5"
					onClick={onToggleExpanded}
				>
					<div className="flex flex-col gap-0.5">
						<span>{trip.origin}</span>
						<span className="text-gray-500 dark:text-gray-400">{trip.destination}</span>
					</div>
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5"
					onClick={onToggleExpanded}
				>
					{shipment.referenceId?.trim() || "—"}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5 whitespace-nowrap"
					onClick={onToggleExpanded}
				>
					{formatEquipment(shipment.equipment)}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5 whitespace-nowrap"
					onClick={onToggleExpanded}
				>
					{formatWeightLbs(shipment.weight)}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5 whitespace-nowrap"
					onClick={onToggleExpanded}
				>
					{formatRate(shipment.rate)}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm text-gray-800 dark:text-white/90 sm:px-5"
					onClick={onToggleExpanded}
				>
					{bidsCount > 0 ? bidsCount : "—"}
				</TableCell>
				<TableCell
					className="cursor-pointer px-4 py-3 text-sm sm:px-5"
					onClick={onToggleExpanded}
				>
					<span
						className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
							isPosted
								? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400"
								: "bg-warning-100 text-warning-700 dark:bg-warning-500/25 dark:text-warning-400"
						}`}
					>
						{statusLabel}
					</span>
				</TableCell>
				<TableCell className="w-14 px-3 py-3 sm:px-4" onClick={e => e.stopPropagation()}>
					<div className="relative flex justify-center">
						<button
							ref={menuAnchorRef}
							type="button"
							className="dropdown-toggle inline-flex items-center justify-center rounded-md p-1 text-brand-500 transition-opacity hover:opacity-80 disabled:opacity-50 dark:text-brand-400"
							aria-label="Shipment actions"
							aria-expanded={menuOpen}
							disabled={actionPending}
							onClick={() => setMenuOpen(open => !open)}
						>
							<LoadBoardActionsIcon className="h-5 w-5" aria-hidden />
						</button>
						<Dropdown
							isOpen={menuOpen}
							onClose={closeMenu}
							className="w-44 p-2"
							anchorRef={menuAnchorRef}
							anchorAlign="right"
						>
							<DropdownItem
								disabled={postBlocked || actionPending}
								title={
									postBlocked
										? "Edit pickup date/time before posting"
										: undefined
								}
								onItemClick={() => {
									if (postBlocked) return;
									handleToggleStatus().catch(() => undefined);
								}}
								className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal ${
									postBlocked
										? "cursor-not-allowed text-gray-400 opacity-60 dark:text-gray-500"
										: "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
								}`}
							>
								{isPosted ? (
									<OfferDeleteIcon className="h-4 w-4 shrink-0" />
								) : (
									<OfferAcceptIcon
										className={`h-4 w-4 shrink-0 ${
											postBlocked
												? "text-gray-400 dark:text-gray-500"
												: "text-green-600 dark:text-green-400"
										}`}
									/>
								)}
								{isPosted ? "Unpost" : "Post"}
							</DropdownItem>
							<DropdownItem
								onItemClick={() => {
									closeMenu();
									onEdit?.();
								}}
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
							>
								<LoadBoardEditIcon className="h-4 w-4 shrink-0" aria-hidden />
								Edit
							</DropdownItem>
							<DropdownItem
								onItemClick={() => {
									handleDelete().catch(() => undefined);
								}}
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal text-error-500 hover:bg-error-50 hover:text-error-600 dark:text-error-400 dark:hover:bg-error-500/10"
							>
								<LoadBoardDeleteIcon className="h-4 w-4 shrink-0" aria-hidden />
								Delete
							</DropdownItem>
							<DropdownItem
								onItemClick={() => {
									closeMenu();
									onDuplicate?.();
								}}
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
							>
								<LoadBoardDuplicateIcon className="h-4 w-4 shrink-0" aria-hidden />
								Duplicate
							</DropdownItem>
						</Dropdown>
					</div>
				</TableCell>
			</TableRow>
			{expanded && (
				<TableRow
					className={`border-b border-gray-100 dark:border-white/[0.05] ${
						isUnposted ? unpostedRowBg : ""
					}`}
				>
					<TableCell colSpan={11} className="px-4 py-3 sm:px-5">
						<div className="w-full max-w-[1400px]">
							<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
								Details
							</h3>
							<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
								<Table className="w-full border-collapse table-fixed">
									<TableHeader className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]">
										<TableRow className="border-gray-200 dark:border-white/[0.08]">
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Route
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Pick up
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Weight
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Rate
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Commodity
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Equipment
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Special instructions
											</TableCell>
											<TableCell
												isHeader
												className="border-b border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
											>
												Comments
											</TableCell>
										</TableRow>
									</TableHeader>
									<TableBody>
										<TableRow className="border-gray-200 dark:border-white/[0.08]">
											<TableCell className="whitespace-pre-line border-b border-r border-gray-200 px-3 py-2 text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{formatRoute(shipment.route) || "—"}
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												<div className="flex flex-col gap-0.5">
													<span>{formatPickupColumn(shipment)}</span>
													{shipment.pickupLatest?.trim() ? (
														<span className="text-gray-500 dark:text-gray-400">
															Latest: {shipment.pickupLatest.trim()}
														</span>
													) : null}
													{shipment.deliveryEarliest?.trim() ||
													shipment.deliveryLatest?.trim() ? (
														<span className="text-gray-500 dark:text-gray-400">
															Delivery:{" "}
															{[
																shipment.deliveryEarliest?.trim(),
																shipment.deliveryLatest?.trim(),
															]
																.filter(Boolean)
																.join(" – ")}
														</span>
													) : null}
													{shipment.dropOffHours?.trim() ? (
														<span className="text-gray-500 dark:text-gray-400">
															Drop off: {shipment.dropOffHours.trim()}
														</span>
													) : null}
												</div>
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{formatWeightLbs(shipment.weight)}
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{formatRate(shipment.rate)}
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{shipment.commodity || "—"}
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{formatEquipment(shipment.equipment)}
												{shipment.loadType ? ` (${shipment.loadType})` : ""}
											</TableCell>
											<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												<SpecialRequirementsList
													value={shipment.specialInstructions}
												/>
											</TableCell>
											<TableCell className="border-b border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
												{shipment.comments?.trim() || "—"}
											</TableCell>
										</TableRow>
									</TableBody>
								</Table>
							</div>

							<div className="mt-4">
								<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
									Drivers
								</h3>
								{bids.length === 0 ? (
									<p className="text-sm text-gray-500 dark:text-gray-400">
										No driver bids yet
									</p>
								) : (
									<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
										<Table className="w-full border-collapse">
											<TableHeader className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]">
												<TableRow className="border-gray-200 dark:border-white/[0.08]">
													<TableCell
														isHeader
														className="border-b border-r border-gray-200 px-3 py-2 text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
													>
														Driver
													</TableCell>
													<TableCell
														isHeader
														className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
													>
														External ID
													</TableCell>
													<TableCell
														isHeader
														className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
													>
														Rate
													</TableCell>
													<TableCell
														isHeader
														className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
													>
														ETA
													</TableCell>
													<TableCell
														isHeader
														className="border-b border-gray-200 px-3 py-2 text-center text-theme-xs font-bold text-gray-700 dark:border-white/[0.08] dark:text-gray-300"
													>
														Selected
													</TableCell>
												</TableRow>
											</TableHeader>
											<TableBody>
												{bids.map(bid => (
													<TableRow
														key={bid.id}
														className="border-gray-200 dark:border-white/[0.08]"
													>
														<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
															{driverDisplayName(bid)}
														</TableCell>
														<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
															{bid.driverExternalId || "—"}
														</TableCell>
														<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
															{formatRate(bid.rate)}
														</TableCell>
														<TableCell className="border-b border-r border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
															{bid.driverEta?.trim() || "—"}
														</TableCell>
														<TableCell className="border-b border-gray-200 px-3 py-2 text-center text-theme-sm text-gray-800 dark:border-white/[0.08] dark:text-gray-200">
															{bid.isSelected ? "Yes" : "—"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}
							</div>
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}
