"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import {
	CANCELED_LOAD_VALUE,
	computeUpdatedAverageRating,
	extractLoadsForRating,
	extractRatingsFromResponse,
	extractRatingsMeta,
	formatLoadOptionLabel,
	formatRatingDateTime,
	getAvailableLoadsMessage,
	getDriverRatings,
	getRatingValue,
	getRatingsPagination,
	postDriverRating,
	type DriverRating,
	type LoadForRating,
} from "@/app-api/driverRatings";
import type { DriversPage } from "./Types";
import { useCurrentUser } from "@/stores/userStore";
import StarRatingInput from "./StarRatingInput";
import StarRatingDisplay from "./StarRatingDisplay";

export interface DriverRatingModalProps {
	isOpen: boolean;
	onClose: () => void;
	driverId: string;
	driverName: string;
	ratingsCount: number;
	avgRating?: number | null;
}

const PER_PAGE = 10;
/** Approximate height of one rating card + gap; fits up to 2 cards before scrolling. */
const RATING_CARD_HEIGHT_REM = 7;
const RATING_LIST_GAP_REM = 0.75;
const RATING_LIST_MAX_VISIBLE = 2;
const RATING_LIST_MAX_HEIGHT = `calc(${RATING_LIST_MAX_VISIBLE} * ${RATING_CARD_HEIGHT_REM}rem + ${RATING_LIST_MAX_VISIBLE - 1} * ${RATING_LIST_GAP_REM}rem)`;

function RatingListItem({ rating }: { rating: DriverRating }) {
	const value = getRatingValue(rating);
	const text =
		rating.message ??
		rating.comments ??
		(typeof rating.comment === "string" ? rating.comment : "");
	const orderNumber = rating.order_number ?? rating.load_number;
	const dateTime = formatRatingDateTime(
		rating.time ?? rating.date ?? null
	);

	return (
		<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-800/50">
			<div className="flex items-start justify-between gap-3">
				<p className="min-w-0 text-sm font-medium text-gray-900 dark:text-white">
					{rating.name ?? "—"}
					{orderNumber ? (
						<span className="font-normal text-gray-600 dark:text-gray-300">
							{" "}
							Order: {orderNumber}
						</span>
					) : null}
				</p>
				{value != null && (
					<div className="shrink-0 text-right">
						<StarRatingDisplay value={value} />
						{dateTime ? (
							<p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
								{dateTime}
							</p>
						) : null}
					</div>
				)}
			</div>
			{text ? (
				<p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{text}</p>
			) : null}
		</div>
	);
}

export default function DriverRatingModal({
	isOpen,
	onClose,
	driverId,
	driverName,
	ratingsCount,
	avgRating,
}: DriverRatingModalProps) {
	const [selectedLoad, setSelectedLoad] = useState("");
	const [ratingValue, setRatingValue] = useState(0);
	const [comments, setComments] = useState("");
	const [addError, setAddError] = useState<string | null>(null);
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();
	const userId = currentUser?.externalId ?? "";

	useEffect(() => {
		if (!isOpen) {
			setSelectedLoad("");
			setRatingValue(0);
			setComments("");
			setAddError(null);
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
		queryKey: ["driver-ratings", driverId, userId],
		queryFn: ({ pageParam }) =>
			getDriverRatings({
				driverId,
				userId,
				perPage: PER_PAGE,
				page: pageParam,
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage, _pages, lastPageParam) => {
			const { totalPages, currentPage, hasMore } = getRatingsPagination(lastPage);
			if (hasMore) return currentPage + 1;
			if (totalPages > 0 && currentPage < totalPages) return currentPage + 1;
			const count = extractRatingsFromResponse(lastPage).length;
			if (count >= PER_PAGE) return lastPageParam + 1;
			return undefined;
		},
		enabled: isOpen && !!driverId && !!userId,
	});

	const firstPage = data?.pages[0];
	const availableLoads: LoadForRating[] = firstPage
		? extractLoadsForRating(firstPage)
		: [];
	const ratingsMeta = firstPage ? extractRatingsMeta(firstPage) : null;

	const ratings: DriverRating[] =
		data?.pages.flatMap(page => extractRatingsFromResponse(page)) ?? [];

	const displayedRatingsCount = ratingsMeta?.totalRatings ?? ratingsCount;
	const displayedAvgRating = ratingsMeta?.averageRating ?? avgRating ?? null;

	const addRatingMutation = useMutation({
		mutationFn: () =>
			postDriverRating({
				driverId,
				userId,
				rating: ratingValue,
				loadNumber: selectedLoad,
				comments,
			}),
		onSuccess: async response => {
			const addedRating = ratingValue;
			const responseMeta = extractRatingsMeta(response);

			setComments("");
			setRatingValue(0);
			setSelectedLoad("");
			setAddError(null);

			await queryClient.resetQueries({
				queryKey: ["driver-ratings", driverId, userId],
			});

			queryClient.setQueriesData(
				{ queryKey: ["drivers-list"] },
				(old: DriversPage | undefined) => {
					if (!old?.data?.results) return old;
					const results = old.data.results.map(item => {
						const id = String(item?.meta_data?.driver_id ?? item?.id ?? "");
						if (id !== String(driverId)) return item;

						const prevCount = item.rating?.count ?? 0;
						const prevAvg = item.rating?.avg_rating ?? 0;
						const newCount =
							responseMeta.totalRatings > 0
								? responseMeta.totalRatings
								: prevCount + 1;
						const newAvg =
							responseMeta.averageRating ??
							computeUpdatedAverageRating(prevAvg, prevCount, addedRating);

						return {
							...item,
							rating: {
								...item.rating,
								count: newCount,
								avg_rating: newAvg,
							},
						};
					});
					return { ...old, data: { ...old.data, results } };
				}
			);

			await queryClient.invalidateQueries({ queryKey: ["drivers-list"] });
			await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
		},
		onError: (err: Error) => {
			setAddError(err.message || "Failed to add rating");
		},
	});

	const scrollRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen || !hasNextPage || isFetchingNextPage || ratings.length === 0) return;
		const el = sentinelRef.current;
		const root = scrollRef.current;
		if (!el || !root) return;
		const obs = new IntersectionObserver(
			entries => {
				if (entries[0]?.isIntersecting) fetchNextPage();
			},
			{ root, rootMargin: "100px", threshold: 0 }
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [isOpen, hasNextPage, isFetchingNextPage, ratings.length, fetchNextPage]);

	const handleAddRating = () => {
		setAddError(null);
		if (!selectedLoad) {
			setAddError("Please select a load");
			return;
		}
		if (ratingValue < 1 || ratingValue > 5) {
			setAddError("Please select a rating from 1 to 5 stars");
			return;
		}
		if (!userId) {
			setAddError("Current user externalId is missing");
			return;
		}
		addRatingMutation.mutate();
	};

	const loadsMessage = getAvailableLoadsMessage(availableLoads.length);
	const loadsMessageClass =
		availableLoads.length > 0
			? "text-green-600 dark:text-green-400"
			: "text-red-600 dark:text-red-400";

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<div className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Driver Ratings
				</h2>

				<div className="mt-6 space-y-4">
					<div>
						<Label htmlFor="driver-rating-load">Load number</Label>
						<div className="mt-1.5">
							<select
								id="driver-rating-load"
								value={selectedLoad}
								onChange={e => setSelectedLoad(e.target.value)}
								disabled={isPending}
								className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
							>
								<option value="" disabled>
									Select a load...
								</option>
								{availableLoads.map(load => (
									<option key={load.load_number} value={load.load_number}>
										{formatLoadOptionLabel(load)}
									</option>
								))}
								<option value={CANCELED_LOAD_VALUE}>{CANCELED_LOAD_VALUE}</option>
							</select>
						</div>
						{!isPending && (
							<p className={`mt-1.5 text-sm ${loadsMessageClass}`}>
								{loadsMessage}
							</p>
						)}
					</div>

					<div>
						<Label>Select Rating</Label>
						<div className="mt-2">
							<StarRatingInput
								value={ratingValue}
								onChange={setRatingValue}
								disabled={addRatingMutation.isPending}
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="driver-rating-comments">Comments</Label>
						<div className="mt-1.5">
							<TextArea
								id="driver-rating-comments"
								rows={4}
								placeholder="Enter comment..."
								value={comments}
								onChange={setComments}
								className="min-h-[100px] resize-y"
							/>
						</div>
					</div>

					{addError && (
						<div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
							{addError}
						</div>
					)}

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleAddRating}
						disabled={
							!selectedLoad ||
							ratingValue < 1 ||
							addRatingMutation.isPending ||
							!userId
						}
						className="w-full border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 sm:w-auto"
					>
						{addRatingMutation.isPending ? (
							<span className="inline-flex items-center gap-2">
								<SpinnerOne className="h-4 w-4 shrink-0" />
								Adding...
							</span>
						) : (
							"Add Rating"
						)}
					</Button>

					<div className="flex items-center gap-3 pt-2">
						<span className="font-medium text-gray-900 dark:text-white">
							{driverName}
						</span>
						<span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-brand-500">
							{displayedRatingsCount}
						</span>
						{displayedAvgRating != null && displayedAvgRating > 0 && (
							<span className="text-sm text-gray-500 dark:text-gray-400">
								Avg: {Number(displayedAvgRating).toFixed(2)} / 5
							</span>
						)}
					</div>

					<div className="pt-2">
						{isPending ? (
							<div className="flex justify-center py-6">
								<SpinnerOne />
							</div>
						) : isError ? (
							<div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
								Failed to load ratings.
							</div>
						) : ratings.length > 0 ? (
							<div
								ref={scrollRef}
								className="space-y-3 overflow-y-auto"
								style={{ maxHeight: RATING_LIST_MAX_HEIGHT }}
							>
								{ratings.map((rating, idx) => (
									<RatingListItem
										key={String(rating.id ?? `${rating.time}-${idx}`)}
										rating={rating}
									/>
								))}
								<div ref={sentinelRef} className="h-2 shrink-0" aria-hidden />
								{hasNextPage && isFetchingNextPage && (
									<div className="flex justify-center py-2">
										<SpinnerOne className="h-5 w-5" />
									</div>
								)}
							</div>
						) : (
							<div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
								No ratings found for this driver.
							</div>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}
