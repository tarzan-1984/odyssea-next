"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { renderAvatar } from "@/helpers";
import { getNewsReaders, type NewsArticle } from "@/app-api/news";

const PAGE_SIZE = 50;

type NewsReadersModalProps = {
	article: NewsArticle | null;
	isOpen: boolean;
	onClose: () => void;
};

function readerName(firstName: string | null, lastName: string | null): string {
	const name = `${firstName?.trim() ?? ""} ${lastName?.trim() ?? ""}`.trim();
	return name || "Unknown";
}

export default function NewsReadersModal({
	article,
	isOpen,
	onClose,
}: NewsReadersModalProps) {
	const articleId = article?.id ?? null;
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const scrollRootRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
		return () => window.clearTimeout(timer);
	}, [searchInput]);

	useEffect(() => {
		if (!isOpen) {
			setSearchInput("");
			setDebouncedSearch("");
		}
	}, [isOpen]);

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isPending,
		isError,
	} = useInfiniteQuery({
		queryKey: ["news-readers", articleId, debouncedSearch],
		queryFn: ({ pageParam }) =>
			getNewsReaders(articleId as number, {
				page: pageParam,
				limit: PAGE_SIZE,
				search: debouncedSearch,
			}),
		initialPageParam: 1,
		getNextPageParam: lastPage => {
			const pagination = lastPage?.pagination;
			if (pagination?.has_next_page) {
				return pagination.current_page + 1;
			}
			return undefined;
		},
		enabled: isOpen && articleId != null,
	});

	const readers = useMemo(
		() => data?.pages.flatMap(page => page.readers) ?? [],
		[data],
	);
	const totalCount = data?.pages[0]?.pagination?.total_count ?? 0;

	useEffect(() => {
		const root = scrollRootRef.current;
		const sentinel = sentinelRef.current;
		if (!isOpen || !root || !sentinel) return undefined;

		const observer = new IntersectionObserver(
			entries => {
				if (entries.some(entry => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
					fetchNextPage().catch(() => undefined);
				}
			},
			{ root, rootMargin: "120px", threshold: 0 },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, isOpen, readers.length]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			closeOnBackdropClick
			containScroll
			className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
		>
			<div className="pr-10">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Who read this post
					{totalCount > 0 ? (
						<span className="ml-1 font-normal text-gray-500 dark:text-gray-400">
							({totalCount})
						</span>
					) : null}
				</h2>
				{article?.title ? (
					<p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
						{article.title}
					</p>
				) : null}
			</div>

			<div className="mt-4">
				<input
					type="search"
					value={searchInput}
					onChange={event => setSearchInput(event.target.value)}
					placeholder="Search by name, ID, or phone"
					className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
				/>
			</div>

			<div ref={scrollRootRef} className="mt-4 max-h-[min(60vh,28rem)] overflow-y-auto">
				{isPending ? (
					<div className="py-8">
						<SpinnerOne />
					</div>
				) : isError ? (
					<p className="py-6 text-center text-sm text-error-500">
						Failed to load readers.
					</p>
				) : readers.length === 0 ? (
					<p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
						{debouncedSearch
							? "No readers match your search."
							: "No one has read this post yet."}
					</p>
				) : (
					<ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
						{readers.map(reader => {
							const name = readerName(reader.firstName, reader.lastName);
							const externalId = reader.externalId?.trim();
							const email = reader.email?.trim();

							return (
								<li key={reader.userId} className="flex items-start gap-3 py-3">
									{renderAvatar(
										{
											firstName: reader.firstName,
											lastName: reader.lastName,
											profilePhoto: reader.profilePhoto,
											userColor: reader.userColor,
											role: reader.role,
										},
										"h-10 w-10 shrink-0",
									)}
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-gray-900 dark:text-white">
											{name}
											{externalId ? (
												<span className="font-normal text-gray-500 dark:text-gray-400">
													{" "}
													({externalId})
												</span>
											) : null}
										</p>
										{email ? (
											<a
												href={`mailto:${email}`}
												className="mt-0.5 block truncate text-sm text-brand-500 hover:underline"
												onClick={e => e.stopPropagation()}
											>
												{email}
											</a>
										) : (
											<p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
												No email
											</p>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
				<div ref={sentinelRef} className="h-1" />
				{isFetchingNextPage ? (
					<div className="py-3">
						<SpinnerOne />
					</div>
				) : null}
			</div>
		</Modal>
	);
}
