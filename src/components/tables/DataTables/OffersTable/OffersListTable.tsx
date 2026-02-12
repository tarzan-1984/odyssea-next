import { useState } from "react";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import CreateOfferModal from "@/components/tables/DataTables/DriversTable/CreateOfferModal";
import MultiSelect from "@/components/form/MultiSelect";
import {
	AngleDownIcon,
	AngleUpIcon,
	Any,
	BackgroundCheck,
	Canada,
	CdlIcon, Change9Icon,
	DockHigh, Dolly, Dot,
	Etrack, Hazmat2Icon,
	HazmatIcon, Liftgate, LoadBars, Local, Mc, Mexico, Military, Otr,
	PalletJack,
	Ppe, Printer,
	Ramp, RealId, Regional, Sleeper,
	TankerEndorsement, TeamIcon,
	TsaIcon,
	TwicIcon
} from "@/icons";
import AlaskaIcon from "@/icons/additional/usa-alaska.svg";
import Image from "next/image";
import macroPointIcon from "@/icons/additional/macropoint.png";
import tuckerTools from "@/icons/additional/tucker-tools.png";
import SideDoorIcon from "@/icons/additional/side_door.svg";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";

const OffersListTable = () => {
	// State for pagination
	const [currentPage, setCurrentPage]  = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const isPlaceholderData = false;

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
						{/* Table header with sortable columns */}
						<TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
							<TableRow>
								{[
									{ key: "update_time", label: "Date & Time", sortable: false },
									{ key: "pick_up", label: "Pick Up", sortable: false },
									{ key: "delivery", label: "Delivery", sortable: false },
									{ key: "loaded_miles", label: "Loaded Miles", sortable: false },
									{ key: "empty_miles", label: "Empty Miles", sortable: false },
									{ key: "total_miles", label: "Total Miles", sortable: false },
									{ key: "commodity", label: "Commodity", sortable: false },
									{ key: "special_requirements", label: "Special Requirements", sortable: false },
									{ key: "drivers", label: "Drivers", sortable: false },
								].map(({ key, label, sortable }) => (
									<TableCell
										key={key}
										isHeader
										className="px-4 py-3 border border-gray-100 dark:border-white/[0.05]"
									>
										<div
											className={`flex items-center justify-between ${sortable ? "cursor-pointer" : ""}`}
										>
											<p className="font-medium text-gray-700 text-theme-xs dark:text-gray-400">
												{label}
											</p>
										</div>
									</TableCell>
								))}
							</TableRow>
						</TableHeader>
					</Table>
				</div>
			</div>

			{/* Footer section with pagination info and controls */}
			{/*<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
					Pagination info
					<div className="pb-3 xl:pb-0">
						<p className="pb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
							{(isQueryEnabled ? totalItems : 0) === 0
							 ? "Showing 0 entries"
							 : `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
									currentPage * itemsPerPage,
									totalItems
								)} of ${totalItems} entries`}
						</p>
					</div>

					Pagination controls
					{isQueryEnabled && totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => {
								setCurrentPage(page);
							}}
						/>
					)}
				</div>
			</div>*/}
		</div>
	)
}

export default OffersListTable;
