"use client";

import { useState } from "react";
import users from "@/app-api/users";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import { AngleDownIcon, AngleUpIcon } from "@/icons";
import PaginationWithIcon from "./PaginationWithIcon";
import Link from "next/link";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import MultiSelect from "@/components/form/MultiSelect";
import { renderAvatar } from "@/helpers";
import { useCurrentUser } from "@/stores/userStore";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

// Define all available roles
const roleOptions = [
	{ value: "", label: "Show all" },
	{ value: "DRIVER_UPDATES", label: "Driver Updates" },
	{ value: "MODERATOR", label: "Moderator" },
	{ value: "RECRUITER", label: "Recruiter" },
	{ value: "ADMINISTRATOR", label: "Administrator" },
	{ value: "NIGHTSHIFT_TRACKING", label: "Nightshift Tracking" },
	{ value: "DISPATCHER", label: "Dispatcher" },
	{ value: "BILLING", label: "Billing" },
	{ value: "SUBSCRIBER", label: "Subscriber" },
	{ value: "ACCOUNTING", label: "Accounting" },
	{ value: "RECRUITER_TL", label: "Recruiter TL" },
	{ value: "TRACKING", label: "Tracking" },
	{ value: "DISPATCHER_TL", label: "Dispatcher TL" },
	{ value: "TRACKING_TL", label: "Tracking TL" },
	{ value: "MORNING_TRACKING", label: "Morning Tracking" },
	{ value: "EXPEDITE_MANAGER", label: "Expedite Manager" },
	{ value: "DRIVER", label: "Driver" },
	{ value: "HR_MANAGER", label: "HR Manager" },
];

// VIN column visibility is permission-based: show only for allowed viewer roles.
const vinVisibleRoles = ["MODERATOR", "ADMINISTRATOR", "RECRUITER", "RECRUITER_TL", "HR_MANAGER"];

export default function UserListTable() {
	const currentUser = useCurrentUser();
	// State for pagination
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);

	// State for search functionality
	const [searchTerm, setSearchTerm] = useState("");

	// State for role filtering - now supports multiple roles
	const [selectedRoles, setSelectedRoles] = useState<string[]>([]); // Empty array means "Show all"

	// State for sorting functionality
	const [sortState, setSortState] = useState<{ [key: string]: "asc" | "desc" }>({ role: "asc" });

	// Fetch users data when dependencies change
	const {
		data: userList,
		isPending,
		error,
		isPlaceholderData,
	} = useQuery({
		queryKey: [
			"users-list",
			{ currentPage, itemsPerPage, searchTerm, sortState, selectedRoles },
		],
		queryFn: () =>
			users.getAllUsers({
				page: currentPage,
				limit: itemsPerPage,
				search: searchTerm,
				sort: sortState,
				roles: selectedRoles.length > 0 ? selectedRoles : undefined,
			}),
		staleTime: 10 * 60 * 1000,
		placeholderData: keepPreviousData,
	});

	// Calculate total pages for pagination
	const totalItems = userList?.data?.data?.pagination?.total_count || 0;
	const totalPages = Math.ceil(totalItems / itemsPerPage);

	// Handle column sorting
	const handleSort = (key: "role" | "location" | "type") => {
		// Determine new sort order
		let newSortOrder: "asc" | "desc";

		if (sortState[key]) {
			// Toggle sort order if same column
			newSortOrder = sortState[key] === "asc" ? "desc" : "asc";
		} else {
			// Set new column with ascending order
			newSortOrder = "asc";
		}

		// Update sort state
		setSortState({ [key]: newSortOrder });
	};

	const viewerRole = (currentUser?.role || "").trim().toUpperCase();
	const showVinColumn = vinVisibleRoles.includes(viewerRole);

	const columnCount = showVinColumn ? 7 : 6;

	return (
		<div className="overflow-hidden bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header section with pagination controls and search */}
			<div className="flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
				{/* Items per page selector */}
				<div className="flex items-center gap-3">
					<span className="text-gray-500 dark:text-gray-400"> Show </span>

					<CustomStaticSelect
						options={[
							{ value: "5", label: "5" },
							{ value: "8", label: "8" },
							{ value: "10", label: "10" },
							{ value: "20", label: "20" },
						]}
						value={itemsPerPage.toString()}
						onChangeAction={val => {
							setItemsPerPage(Number(val));
							setCurrentPage(1);
						}}
					/>
					<span className="text-gray-500 dark:text-gray-400"> entries </span>
				</div>

				{/* Role filter - Multi-select */}
				<div className="flex items-center gap-3">
					<span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
						Filter by role:
					</span>
					<MultiSelect
						label=""
						options={roleOptions
							.filter(opt => opt.value !== "") // Remove "Show all" from multi-select
							.map(opt => ({
								value: opt.value,
								text: opt.label,
								selected: selectedRoles.includes(opt.value),
							}))}
						defaultSelected={selectedRoles}
						onChange={values => {
							setSelectedRoles(values);
							setCurrentPage(1);
						}}
					/>
				</div>

				{/* Search input */}
				<div className="relative">
					<button className="absolute text-gray-500 -translate-y-1/2 left-4 top-1/2 dark:text-gray-400">
						<svg
							className="fill-current"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M3.04199 9.37363C3.04199 5.87693 5.87735 3.04199 9.37533 3.04199C12.8733 3.04199 15.7087 5.87693 15.7087 9.37363C15.7087 12.8703 12.8733 15.7053 9.37533 15.7053C5.87735 15.7053 3.04199 12.8703 3.04199 9.37363ZM9.37533 1.54199C5.04926 1.54199 1.54199 5.04817 1.54199 9.37363C1.54199 13.6991 5.04926 17.2053 9.37533 17.2053C11.2676 17.2053 13.0032 16.5344 14.3572 15.4176L17.1773 18.238C17.4702 18.5309 17.945 18.5309 18.2379 18.238C18.5308 17.9451 18.5309 17.4703 18.238 17.1773L15.4182 14.3573C16.5367 13.0033 17.2087 11.2669 17.2087 9.37363C17.2087 5.04817 13.7014 1.54199 9.37533 1.54199Z"
								fill=""
							/>
						</svg>
					</button>

					<input
						type="text"
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						placeholder="Search..."
						className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-11 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
					/>
				</div>
			</div>

			{/* Table section */}
			<div className="overflow-x-auto custom-scrollbar">
				<div className="min-w-max">
					<Table>
						{/* Table header with sortable columns */}
						<TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
							<TableRow>
								{[
									{ key: "name", label: "User", sortable: false },
									{ key: "role", label: "Role", sortable: true },
									{ key: "email", label: "Email", sortable: false },
									{ key: "phone", label: "Phone", sortable: false },
									{ key: "location", label: "Home location", sortable: true },
									{ key: "type", label: "Vehicle", sortable: true },
									...(showVinColumn
										? [{ key: "vin", label: "VIN", sortable: false }]
										: []),
								].map(({ key, label, sortable }) => (
									<TableCell
										key={key}
										isHeader
										className="px-4 py-3 border border-gray-100 dark:border-white/[0.05]"
									>
										<div
											className={`flex items-center justify-between ${sortable ? "cursor-pointer" : ""}`}
											onClick={
												sortable
													? () =>
															handleSort(
																key as "role" | "location" | "type"
															)
													: undefined
											}
										>
											<p className="font-medium text-gray-700 text-theme-xs dark:text-gray-400">
												{label}
											</p>
											{/* Sort indicators */}
											{sortable && (
												<button className="flex flex-col gap-0.5">
													<AngleUpIcon
														className={`${
															key === "role" &&
															sortState.role === "asc"
																? "text-brand-500"
																: key === "location" &&
																	  sortState.location === "asc"
																	? "text-brand-500"
																	: key === "type" &&
																		  sortState.type === "asc"
																		? "text-brand-500"
																		: "text-gray-300 dark:text-gray-700"
														}`}
													/>
													<AngleDownIcon
														className={`${
															key === "role" &&
															sortState.role === "desc"
																? "text-brand-500"
																: key === "location" &&
																	  sortState.location === "desc"
																	? "text-brand-500"
																	: key === "type" &&
																		  sortState.type === "desc"
																		? "text-brand-500"
																		: "text-gray-300 dark:text-gray-700"
														}`}
													/>
												</button>
											)}
										</div>
									</TableCell>
								))}
							</TableRow>
						</TableHeader>

						{/* Table body with user data */}
						<TableBody>
							{isPending ? (
								// Loading spinner
								<tr>
									<td colSpan={columnCount} className="p-2">
										<SpinnerOne />
									</td>
								</tr>
							) : (
								// User rows
								userList?.data?.data?.users?.map((item, i) => (
									<TableRow key={i + 1}>
										{/* User name with avatar */}
										<TableCell className="px-4 py-3 border border-gray-100 dark:border-white/[0.05] whitespace-nowrap">
											<Link
												href={`users/${item?.id}`}
												className="flex items-center gap-3"
											>
												{item && renderAvatar(item, "w-[50px] h-[50px]")}
												<div>
													<span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
														{item?.firstName && item?.lastName
															? `${item.firstName} ${item.lastName}`
															: item?.firstName ||
																item?.lastName ||
																"-"}
													</span>
												</div>
											</Link>
										</TableCell>
										{/* User role */}
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
											{item?.role ? item.role : "-"}
										</TableCell>
										{/* User email */}
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
											{item?.email ? item.email : "-"}
										</TableCell>
										{/* User phone */}
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
											{item?.phone ? item.phone : "-"}
										</TableCell>
										{/* User location */}
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
											{item?.location ? item.location : "-"}
										</TableCell>
										{/* Vehicle type */}
										<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
											<span className="block">
												{item?.type ? item.type : "-"}
											</span>
										</TableCell>
										{/* Vehicle VIN */}
										{showVinColumn ? (
											<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
												{item?.vin ? item.vin : "-"}
											</TableCell>
										) : null}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Footer section with pagination info and controls */}
			<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
					{/* Pagination info */}
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

					{/* Pagination controls */}
					{totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => {
								setCurrentPage(page);
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
