"use client";

import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import {
	getDriverNotes,
	postDriverNotice,
	formatNoticeDate,
	type DriverNotice,
} from "@/app-api/driverNotes";
import { useCurrentUser } from "@/stores/userStore";

export interface DriverNotesModalProps {
	isOpen: boolean;
	onClose: () => void;
	driverId: string;
	driverName: string;
	notesCount: number;
}

const PER_PAGE = 5;

export default function DriverNotesModal({
	isOpen,
	onClose,
	driverId,
	driverName,
	notesCount,
}: DriverNotesModalProps) {
	const [comment, setComment] = useState("");
	const [addError, setAddError] = useState<string | null>(null);
	const [addedCountInSession, setAddedCountInSession] = useState(0);
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!isOpen) {
			setComment("");
			setAddError(null);
			setAddedCountInSession(0);
		}
	}, [isOpen]);

	const addNoticeMutation = useMutation({
		mutationFn: () =>
			postDriverNotice({
				driverId,
				userId: currentUser?.externalId ?? "",
				message: comment,
			}),
		onSuccess: () => {
			setComment("");
			setAddError(null);
			setAddedCountInSession((c) => c + 1);
			queryClient.invalidateQueries({ queryKey: ["driver-notes", driverId] });
			queryClient.setQueriesData(
				{ queryKey: ["drivers-list"] },
				(old: { data?: { results?: Array<{ meta_data?: { driver_id?: string }; id?: string; notes?: { count?: number } }> } } | undefined) => {
					if (!old?.data?.results) return old;
					const results = old.data.results.map((item) => {
						const id = String(item?.meta_data?.driver_id ?? item?.id ?? "");
						if (id === String(driverId) && item.notes) {
							return {
								...item,
								notes: {
									...item.notes,
									count: (item.notes.count ?? 0) + 1,
								},
							};
						}
						return item;
					});
					return { ...old, data: { ...old.data, results } };
				}
			);
		},
		onError: (err: Error) => {
			setAddError(err.message || "Failed to add notice");
		},
	});

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isPending,
		isError,
	} = useInfiniteQuery({
		queryKey: ["driver-notes", driverId],
		queryFn: ({ pageParam }) =>
			getDriverNotes({ driverId, perPage: PER_PAGE, page: pageParam }),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const d = lastPage.data as { total_pages?: number; page?: number; notes?: DriverNotice[] } | undefined;
			const totalPages = lastPage.total_pages ?? d?.total_pages ?? 0;
			const currentPage = lastPage.current_page ?? lastPage.page ?? d?.page ?? 1;
			const arr = lastPage.notices ?? d?.notes ?? (lastPage.data as DriverNotice[] | undefined);
			const count = Array.isArray(arr) ? arr.length : 0;
			if (typeof totalPages === "number" && totalPages > 0 && currentPage < totalPages) return currentPage + 1;
			if (count >= PER_PAGE) return currentPage + 1;
			return undefined;
		},
		enabled: isOpen && !!driverId,
	});

	const notices: DriverNotice[] =
		data?.pages.flatMap((p) => {
			const d = p.data as { notes?: DriverNotice[] } | undefined;
			const arr = p.notices ?? d?.notes ?? (p.data as DriverNotice[] | undefined);
			return Array.isArray(arr) ? arr : [];
		}) ?? [];

	const scrollRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen || !hasNextPage || isFetchingNextPage || notices.length === 0) return;
		const el = sentinelRef.current;
		const root = scrollRef.current;
		if (!el || !root) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) fetchNextPage();
			},
			{ root, rootMargin: "100px", threshold: 0 }
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [isOpen, hasNextPage, isFetchingNextPage, notices.length, fetchNextPage]);

	const handleAddNotice = () => {
		setAddError(null);
		if (!comment.trim()) return;
		if (!currentUser?.externalId) {
			setAddError("Current user externalId is missing");
			return;
		}
		addNoticeMutation.mutate();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<div className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Driver Notes
				</h2>

				<div className="mt-6 space-y-4">
					<div>
						<Label htmlFor="driver-notes-comment">Comments</Label>
						<div className="mt-1.5">
							<TextArea
								id="driver-notes-comment"
								rows={4}
								placeholder="Enter comment..."
								value={comment}
								onChange={setComment}
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
						onClick={handleAddNotice}
						disabled={!comment.trim() || addNoticeMutation.isPending || !currentUser?.externalId}
						className="w-full border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 sm:w-auto"
					>
						{addNoticeMutation.isPending ? (
							<span className="inline-flex items-center gap-2">
								<SpinnerOne className="h-4 w-4 shrink-0" />
								Adding...
							</span>
						) : (
							"Add Notice"
						)}
					</Button>

					<div className="flex items-center gap-3 pt-2">
						<span className="font-medium text-gray-900 dark:text-white">
							{driverName}
						</span>
						<span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-brand-500">
							{notesCount + addedCountInSession}
						</span>
					</div>

					{/* Notices list - scrollable, ~3 items visible */}
					<div className="pt-2">
						{isPending ? (
							<div className="flex justify-center py-6">
								<SpinnerOne />
							</div>
						) : isError ? (
							<div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
								Failed to load notices.
							</div>
						) : notices.length > 0 ? (
							<div
								ref={scrollRef}
								className="max-h-[280px] space-y-4 overflow-y-auto"
							>
								{notices.map((notice, idx) => (
									<div
										key={notice.id ?? idx}
										className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-800/50"
									>
										<div className="flex items-center justify-between gap-2 text-sm">
											<span className="font-medium text-gray-900 dark:text-white">
												{notice.name ?? "—"}
											</span>
											<span className="text-gray-500 dark:text-gray-400">
												{formatNoticeDate(notice.date)}
											</span>
										</div>
										<p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
											{notice.message ?? ""}
										</p>
									</div>
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
								No notices found for this driver.
							</div>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}
