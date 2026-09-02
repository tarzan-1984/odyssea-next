"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button/Button";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import { TrashBinIcon, EditOfferIcon } from "@/icons";
import { renderAvatar } from "@/helpers";
import { deleteNews, getNewsList, type NewsArticle } from "@/app-api/news";
import CreateNewsIcon from "./CreateNewsIcon";
import CreateNewsModal from "./CreateNewsModal";
import NewsArticleBody from "./NewsArticleBody";
import NewsReadersIcon from "./NewsReadersIcon";
import NewsReadersModal from "./NewsReadersModal";

const NEWS_LIST_QUERY_KEY = ["news-list"] as const;

function formatNewsCreatedAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return (
		date.toLocaleString("en-US", {
			timeZone: "UTC",
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		}) + " ET"
	);
}

function authorName(article: NewsArticle): string {
	const first = article.author?.firstName?.trim() ?? "";
	const last = article.author?.lastName?.trim() ?? "";
	const name = `${first} ${last}`.trim();
	return name || "Unknown";
}

export default function NewsUpdatesPageClient() {
	const queryClient = useQueryClient();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editArticle, setEditArticle] = useState<NewsArticle | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [expandedNewsId, setExpandedNewsId] = useState<number | null>(null);
	const [deleteConfirmArticle, setDeleteConfirmArticle] = useState<NewsArticle | null>(null);
	const [readersArticle, setReadersArticle] = useState<NewsArticle | null>(null);
	const [deletingNewsId, setDeletingNewsId] = useState<number | null>(null);

	const queryParams = {
		page: currentPage,
		limit: itemsPerPage,
	};

	const { data, isPending, isError, isPlaceholderData } = useQuery({
		queryKey: [...NEWS_LIST_QUERY_KEY, queryParams],
		queryFn: () => getNewsList(queryParams),
		placeholderData: keepPreviousData,
	});

	const articles = data?.data?.results ?? [];
	const pagination = data?.data?.pagination;
	const totalItems = pagination?.total_count ?? 0;
	const totalPages = pagination?.total_pages ?? 1;

	const toggleExpanded = (id: number) => {
		setExpandedNewsId(prev => (prev === id ? null : id));
	};

	async function handleConfirmDelete() {
		if (!deleteConfirmArticle) return;
		const article = deleteConfirmArticle;
		setDeletingNewsId(article.id);
		try {
			await deleteNews(article.id);
			setDeleteConfirmArticle(null);
			if (expandedNewsId === article.id) {
				setExpandedNewsId(null);
			}
			const remainingOnPage = articles.length - 1;
			if (remainingOnPage <= 0 && currentPage > 1) {
				setCurrentPage(page => Math.max(1, page - 1));
			}
			await queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
		} catch (err) {
			console.error("Failed to delete news:", err);
		} finally {
			setDeletingNewsId(null);
		}
	}

	return (
		<>
			<div className="mb-4">
				<Button
					type="button"
					size="sm"
					variant="primary"
					onClick={() => setIsCreateOpen(true)}
					startIcon={<CreateNewsIcon className="h-5 w-5" />}
				>
					Post
				</Button>
			</div>

			<div className="bg-white dark:bg-white/[0.03] rounded-xl">
				<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
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
								setExpandedNewsId(null);
							}}
						/>
						<span className="text-gray-500 dark:text-gray-400"> entries </span>
					</div>
				</div>

				<div className="relative border border-gray-100 dark:border-white/[0.05] px-4 py-4">
					{isPending && !isPlaceholderData ? (
						<div className="py-8">
							<SpinnerOne />
						</div>
					) : isError ? (
						<p className="text-sm text-error-500">Failed to load news.</p>
					) : articles.length === 0 ? (
						<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
							No news yet. Create the first article.
						</p>
					) : (
						<div className="space-y-3">
							{articles.map(item => {
								const isExpanded = expandedNewsId === item.id;
								return (
									<div
										key={item.id}
										className="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/[0.05] dark:bg-gray-900"
									>
										<div
											className="cursor-pointer select-none px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
											onClick={() => toggleExpanded(item.id)}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="flex min-w-0 flex-1 items-start gap-3">
													{renderAvatar(item.author, "h-10 w-10 shrink-0")}
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
															{authorName(item)}
														</p>
														<p className="mt-1 truncate text-base font-medium text-gray-900 dark:text-white">
															{item.title}
														</p>
													</div>
												</div>
												<div className="flex flex-shrink-0 flex-col items-end gap-1">
													<div className="flex items-center gap-2">
														<button
															type="button"
															title="Who read this post"
															onClick={e => {
																e.stopPropagation();
																setReadersArticle(item);
															}}
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-0 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
														>
															<NewsReadersIcon className="h-5 w-5 shrink-0" />
															Readers
														</button>
														<button
															type="button"
															title="Edit post"
															onClick={e => {
																e.stopPropagation();
																setEditArticle(item);
															}}
															className="inline-flex h-[39px] w-[39px] shrink-0 items-center justify-center border-0 bg-transparent p-0 hover:opacity-90"
														>
															<EditOfferIcon className="h-[39px] w-[39px] shrink-0" aria-hidden />
														</button>
														<button
															type="button"
															onClick={e => {
																e.stopPropagation();
																setDeleteConfirmArticle(item);
															}}
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
														>
															Delete
															<TrashBinIcon className="h-5 w-5 shrink-0" />
														</button>
													</div>
													<p className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
														{formatNewsCreatedAt(item.createdAt)}
													</p>
												</div>
											</div>
										</div>

										{isExpanded && (
											<div className="border-t border-gray-100 px-4 py-3 dark:border-white/[0.05]">
												<NewsArticleBody html={item.article} />
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}

					{isPlaceholderData && (
						<div
							className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-white/70 dark:bg-white/10"
							aria-hidden
						>
							<SpinnerOne />
						</div>
					)}
				</div>

				<div className="rounded-b-xl border border-t-0 border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
					<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
						<div className="pb-3 xl:pb-0">
							<p className="pb-3 text-center text-sm font-medium text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
								{totalItems === 0
									? "Showing 0 entries"
									: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
											currentPage * itemsPerPage,
											totalItems,
										)} of ${totalItems} entries`}
							</p>
						</div>
						{totalPages > 1 && (
							<PaginationWithIcon
								totalPages={totalPages}
								initialPage={currentPage}
								onPageChange={(page: number) => {
									setCurrentPage(page);
									setExpandedNewsId(null);
								}}
							/>
						)}
					</div>
				</div>
			</div>

			<CreateNewsModal
				isOpen={isCreateOpen}
				onClose={() => setIsCreateOpen(false)}
				onCreated={() => {
					setCurrentPage(1);
					setExpandedNewsId(null);
					queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY }).catch(() => undefined);
				}}
			/>

			<CreateNewsModal
				isOpen={editArticle != null}
				article={editArticle}
				onClose={() => setEditArticle(null)}
				onUpdated={() => {
					queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY }).catch(() => undefined);
				}}
			/>

			<NewsReadersModal
				article={readersArticle}
				isOpen={readersArticle != null}
				onClose={() => setReadersArticle(null)}
			/>

			<ConfirmModal
				isOpen={deleteConfirmArticle != null}
				onClose={() => setDeleteConfirmArticle(null)}
				onConfirm={handleConfirmDelete}
				title="Delete"
				message="Are you sure you want to delete this news article? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				isLoading={deletingNewsId === deleteConfirmArticle?.id}
				icon={<TrashBinIcon className="h-6 w-6" />}
				variant="danger"
			/>
		</>
	);
}
