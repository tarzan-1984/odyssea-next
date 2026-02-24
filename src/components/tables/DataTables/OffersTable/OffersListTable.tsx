"use client";

import { useState } from "react";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useCurrentUser } from "@/stores/userStore";
import offersApi from "@/app-api/offers";
import type { OfferRow } from "@/app-api/offers";

function formatSpecialRequirements(value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) return value.map(String).join(", ");
	if (typeof value === "string") return value;
	return String(value);
}

function formatDrivers(drivers: OfferRow["drivers"]): string {
	if (!drivers?.length) return "";
	return drivers
		.map((d) => {
			const name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || "—";
			const rate = d.rate != null ? String(d.rate) : "—";
			return `${name} - ${rate}`;
		})
		.join("\n");
}

/** Format date string (e.g. "02/16/2026, 05:26:26" or ISO) to mm/dd/YY */
function formatDateMmDdYy(dateStr: string | null | undefined): string {
	if (!dateStr || typeof dateStr !== "string") return "";
	const trimmed = dateStr.trim();
	// Backend NY format: "MM/DD/YYYY, HH:mm:ss"
	const comma = trimmed.indexOf(", ");
	if (comma !== -1) {
		const datePart = trimmed.slice(0, comma);
		const [m, d, y] = datePart.split("/");
		if (m && d && y) {
			const yy = y.length >= 4 ? y.slice(-2) : y;
			return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${yy}`;
		}
	}
	// ISO or other: try Date parse
	const date = new Date(trimmed.replace(/\s+/, "T"));
	if (Number.isNaN(date.getTime())) return dateStr;
	const mm = (date.getMonth() + 1).toString().padStart(2, "0");
	const dd = date.getDate().toString().padStart(2, "0");
	const yy = date.getFullYear().toString().slice(-2);
	return `${mm}/${dd}/${yy}`;
}

const OffersListTable = () => {
	const currentUser = useCurrentUser();
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);

	const isAdmin = currentUser?.role === "ADMINISTRATOR";
	const queryParams = {
		page: currentPage,
		limit: itemsPerPage,
		sort_order: "action_time_asc" as const,
		...(isAdmin ? {} : { user_id: currentUser?.externalId ?? "" }),
	};

	const {
		data,
		isPending,
		isPlaceholderData,
	} = useQuery({
		queryKey: ["offers-list", queryParams],
		queryFn: () => offersApi.getOffers(queryParams),
		//placeholderData: keepPreviousData,
	});

	const results: OfferRow[] = data?.data?.results ?? [];
	const pagination = data?.data?.pagination;
	const totalItems = pagination?.total_count ?? 0;
	const totalPages = pagination?.total_pages ?? 1;

	return (
		<div className="bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header section with pagination controls and search */}
			<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
				{/* Items per page selector */}
				<div className="flex items-center gap-3">
					<span className="text-gray-500 dark:text-gray-400"> Show </span>

					<CustomStaticSelect
						options={[
							{ value: "5", label: "5" },
							{ value: "8", label: "8" },
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
			</div>

			{/* Table section */}
			<div className="overflow-x-auto custom-scrollbar border-l border-gray-100 dark:border-white/[0.05]">
				<div
					className={`min-w-max transition-opacity ${
						isPlaceholderData ? "opacity-60" : "opacity-100"
					}`}
				>
					<Table>
						<TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
							<TableRow>
								{[
									{ key: "date_time", label: "Date & Time" },
									{ key: "pick_up", label: "Pick Up" },
									{ key: "delivery", label: "Delivery" },
									{ key: "loaded_miles", label: "Loaded Miles" },
									{ key: "empty_miles", label: "Empty Miles" },
									{ key: "total_miles", label: "Total Miles" },
									{ key: "commodity", label: "Commodity" },
									{ key: "special_requirements", label: "Special Requirements" },
									{ key: "drivers", label: "Drivers" },
									{ key: "actions", label: "Actions" },
								].map(({ key, label }) => (
									<TableCell
										key={key}
										isHeader
										className="px-4 py-3 border border-gray-100 dark:border-white/[0.05]"
									>
										<p className="font-medium text-gray-700 text-theme-xs dark:text-gray-400">
											{label}
										</p>
									</TableCell>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{isPending ? (
								<tr>
									<td colSpan={10} className="p-2">
										<div className="flex justify-center py-4">
											<SpinnerOne />
										</div>
									</td>
								</tr>
							) : (
								results.map((row) => (
									<TableRow key={row.id}>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											<p>Create: {formatDateMmDdYy(row.create_time)}</p>
											<p>Update: {formatDateMmDdYy(row.update_time)}</p>
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											<p>{row.pick_up_location}</p>
											<p>{row.pick_up_time}</p>
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											<p>{row.delivery_location}</p>
											<p>{row.delivery_time}</p>
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{row.loaded_miles != null ? row.loaded_miles : "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{row.empty_miles != null ? row.empty_miles : "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{row.total_miles != null ? row.total_miles : "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{row.commodity ?? "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{formatSpecialRequirements(row.special_requirements) || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-pre-line">
											{formatDrivers(row.drivers) || "—"}
										</TableCell>
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm">
											{/* Actions — empty for now */}
											{null}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Footer: pagination */}
			<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
					<div className="pb-3 xl:pb-0">
						<p className="pb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
							{totalItems === 0
								? "Showing 0 entries"
								: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
										currentPage * itemsPerPage,
										totalItems
									)} of ${totalItems} entries`}
						</p>
					</div>
					{totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => setCurrentPage(page)}
						/>
					)}
				</div>
			</div>
		</div>
	)
}

export default OffersListTable;
