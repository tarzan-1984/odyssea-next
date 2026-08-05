import PaginationWithIcon from "../DriversTable/PaginationWithIcon";

type CheckListTablePaginationProps = {
	currentPage: number;
	itemsPerPage: number;
	totalItems: number;
	totalPages: number;
	paginationKey: string;
	onPageChange: (page: number) => void;
	position: "top" | "bottom";
	selectedCount?: number;
};

export default function CheckListTablePagination({
	currentPage,
	itemsPerPage,
	totalItems,
	totalPages,
	paginationKey,
	onPageChange,
	position,
	selectedCount,
}: CheckListTablePaginationProps) {
	const showingText =
		totalItems === 0
			? "Showing 0 entries"
			: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} entries`;

	const wrapperClassName =
		position === "top"
			? "border-x border-b border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]"
			: "border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]";

	return (
		<div className={wrapperClassName}>
			<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
				<div className="pb-3 xl:pb-0">
					<p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-3 text-sm font-medium text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:justify-start xl:border-b-0 xl:pb-0 xl:text-left">
						<span>{showingText}</span>
						{selectedCount != null && selectedCount > 0 && (
							<span>{selectedCount} selected</span>
						)}
					</p>
				</div>
				{totalPages > 1 && (
					<PaginationWithIcon
						key={paginationKey}
						totalPages={totalPages}
						initialPage={currentPage}
						onPageChange={onPageChange}
					/>
				)}
			</div>
		</div>
	);
}
