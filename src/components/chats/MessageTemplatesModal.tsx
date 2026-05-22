"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Search, Trash2, X } from "lucide-react";
import {
	fetchMessageTemplatesPage,
	upsertMessageTemplate,
	deleteMessageTemplate,
	type MessageTemplateDto,
	type MessageTemplateKind,
	type MessageTemplateGroupDto,
	type MessageTemplateScope,
	type AdminCompanyGroupFilter,
} from "@/app-api/messageTemplatesApi";
import type { UserData } from "@/app-api/api-types";
import { useCurrentUser } from "@/stores/userStore";

const PER_PAGE = 10;

function normRole(user: UserData | null): string {
	return (user?.role ?? "").trim().toUpperCase();
}

/** Roles that may open the Company tab. */
function canSeeCompanyTab(user: UserData | null): boolean {
	const r = normRole(user);
	return (
		r === "ADMINISTRATOR" ||
		r === "EXPEDITE_MANAGER" ||
		r === "TRACKING_TL" ||
		r === "RECRUITER_TL" ||
		r === "RECRUITER" ||
		r === "DISPATCHER" ||
		r === "DISPATCHER_TL" ||
		r === "NIGHTSHIFT_TRACKING" ||
		r === "MORNING_TRACKING" ||
		r === "TRACKING"
	);
}

function isAdminUser(user: UserData | null): boolean {
	return normRole(user) === "ADMINISTRATOR";
}

function isCompanyCreatorUser(user: UserData | null): boolean {
	const r = normRole(user);
	return (
		r === "EXPEDITE_MANAGER" ||
		r === "TRACKING_TL" ||
		r === "RECRUITER_TL" ||
		r === "ADMINISTRATOR"
	);
}

/** Shown only on Company tab (+). */
function canCreateCompanyTemplate(user: UserData | null): boolean {
	const r = normRole(user);
	return (
		r === "ADMINISTRATOR" ||
		r === "EXPEDITE_MANAGER" ||
		r === "TRACKING_TL" ||
		r === "RECRUITER_TL"
	);
}

function isOwnerTemplate(tpl: MessageTemplateDto, user: UserData | null): boolean {
	const ext = user?.externalId?.trim();
	if (!ext) return false;
	return tpl.externalId === ext;
}

function canEditTemplate(tpl: MessageTemplateDto, user: UserData | null): boolean {
	if (!user) return false;
	const r = normRole(user);
	if (tpl.type === "personal") {
		return isOwnerTemplate(tpl, user) || r === "ADMINISTRATOR";
	}
	if (r === "ADMINISTRATOR") return true;
	if (
		r !== "EXPEDITE_MANAGER" &&
		r !== "TRACKING_TL" &&
		r !== "RECRUITER_TL"
	) {
		return false;
	}
	return isOwnerTemplate(tpl, user);
}

function canDeleteTemplate(tpl: MessageTemplateDto, user: UserData | null): boolean {
	return canEditTemplate(tpl, user);
}

function managerDefaultGroup(user: UserData | null): MessageTemplateGroupDto {
	const r = normRole(user);
	if (r === "EXPEDITE_MANAGER") return "Expedite";
	if (r === "TRACKING_TL") return "Tracking";
	if (r === "RECRUITER_TL") return "HR";
	return "Expedite";
}

const ADMIN_GROUP_TABS: Array<{ id: AdminCompanyGroupFilter; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "Tracking", label: "Tracking" },
	{ id: "HR", label: "HR" },
	{ id: "Expedite", label: "Expedite" },
];

/** Uniform hit area for insert / edit / delete on template rows */
const templateRowActionBtnClass =
	"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-white/10 dark:hover:text-white";

const templateRowDeleteBtnClass =
	"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-400 bg-white text-red-600 transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-red-500 dark:bg-gray-900 dark:text-red-400 dark:hover:border-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300";

function IconAddTemplate({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 107.07 122.88"
			width={20}
			height={20}
			aria-hidden
		>
			<path
				fill="currentColor"
				d="M31.54,86.95c-1.74,0-3.16-1.43-3.16-3.19c0-1.76,1.41-3.19,3.16-3.19h20.5c1.74,0,3.16,1.43,3.16,3.19 c0,1.76-1.41,3.19-3.16,3.19H31.54L31.54,86.95z M31.54,42.27c-1.74,0-3.15-1.41-3.15-3.15c0-1.74,1.41-3.15,3.15-3.15h41.61 c1.74,0,3.15,1.41,3.15,3.15c0,1.74-1.41,3.15-3.15,3.15H31.54L31.54,42.27z M56.85,116.58c1.74,0,3.15,1.41,3.15,3.15 c0,1.74-1.41,3.15-3.15,3.15H7.33c-2.02,0-3.85-0.82-5.18-2.15C0.82,119.4,0,117.57,0,115.55V7.33c0-2.02,0.82-3.85,2.15-5.18 C3.48,0.82,5.31,0,7.33,0h90.02c2.02,0,3.85,0.82,5.18,2.15c1.33,1.33,2.15,3.16,2.15,5.18V72.6c0,1.74-1.41,3.15-3.15,3.15 s-3.15-1.41-3.15-3.15V7.33c0-0.28-0.12-0.54-0.3-0.73c-0.19-0.19-0.45-0.3-0.73-0.3H7.33c-0.28,0-0.54,0.12-0.73,0.3 C6.42,6.8,6.3,7.05,6.3,7.33v108.21c0,0.28,0.12,0.54,0.3,0.73c0.19,0.19,0.45,0.3,0.73,0.3H56.85L56.85,116.58z M83.35,83.7 c0-1.73,1.41-3.14,3.14-3.14c1.73,0,3.14,1.41,3.14,3.14l-0.04,14.36l14.34,0.04c1.73,0,3.14,1.41,3.14,3.14s-1.41,3.14-3.14,3.14 l-14.35-0.04l-0.04,14.34c0,1.73-1.41,3.14-3.14,3.14c-1.73,0-3.14-1.41-3.14-3.14l0.04-14.35l-14.34-0.04 c-1.73,0-3.14-1.41-3.14-3.14c0-1.73,1.41-3.14,3.14-3.14l14.36,0.04L83.35,83.7L83.35,83.7z M31.54,64.59 c-1.74,0-3.15-1.41-3.15-3.15c0-1.74,1.41-3.15,3.15-3.15h41.61c1.74,0,3.15,1.41,3.15,3.15c0,1.74-1.41,3.15-3.15,3.15H31.54 L31.54,64.59z"
			/>
		</svg>
	);
}

function IconInsertTemplate({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			shapeRendering="geometricPrecision"
			textRendering="geometricPrecision"
			imageRendering="optimizeQuality"
			fillRule="evenodd"
			clipRule="evenodd"
			viewBox="0 0 441 512.02"
			width={22}
			height={22}
			aria-hidden
		>
			<path
				fill="currentColor"
				d="M324.87 279.77c32.01 0 61.01 13.01 82.03 34.02 21.09 21 34.1 50.05 34.1 82.1 0 32.06-13.01 61.11-34.02 82.11l-1.32 1.22c-20.92 20.29-49.41 32.8-80.79 32.8-32.06 0-61.1-13.01-82.1-34.02-21.01-21-34.02-50.05-34.02-82.11s13.01-61.1 34.02-82.1c21-21.01 50.04-34.02 82.1-34.02zM243.11 38.08v54.18c.99 12.93 5.5 23.09 13.42 29.85 8.2 7.01 20.46 10.94 36.69 11.23l37.92-.04-88.03-95.22zm91.21 120.49-41.3-.04c-22.49-.35-40.21-6.4-52.9-17.24-13.23-11.31-20.68-27.35-22.19-47.23l-.11-1.74V25.29H62.87c-10.34 0-19.75 4.23-26.55 11.03-6.8 6.8-11.03 16.21-11.03 26.55v336.49c0 10.3 4.25 19.71 11.06 26.52 6.8 6.8 16.22 11.05 26.52 11.05h119.41c2.54 8.79 5.87 17.25 9.92 25.29H62.87c-17.28 0-33.02-7.08-44.41-18.46C7.08 432.37 0 416.64 0 399.36V62.87c0-17.26 7.08-32.98 18.45-44.36C29.89 7.08 45.61 0 62.87 0h173.88c4.11 0 7.76 1.96 10.07 5l109.39 118.34c2.24 2.43 3.34 5.49 3.34 8.55l.03 119.72c-8.18-1.97-16.62-3.25-25.26-3.79v-89.25zm-229.76 54.49c-6.98 0-12.64-5.66-12.64-12.64 0-6.99 5.66-12.65 12.64-12.65h150.49c6.98 0 12.65 5.66 12.65 12.65 0 6.98-5.67 12.64-12.65 12.64H104.56zm0 72.3c-6.98 0-12.64-5.66-12.64-12.65 0-6.98 5.66-12.64 12.64-12.64h142.52c3.71 0 7.05 1.6 9.37 4.15a149.03 149.03 0 0 0-30.54 21.14H104.56zm0 72.3c-6.98 0-12.64-5.66-12.64-12.65 0-6.98 5.66-12.64 12.64-12.64h86.2c-3.82 8.05-6.95 16.51-9.29 25.29h-76.91zm264.81 31.11c3.56.15 6.09 1.33 7.54 3.55 3.98 5.94-1.44 11.81-5.19 15.94l-40.04 40.71c-4.32 4.26-9.32 4.31-13.64 0l-41.01-41.82c-3.51-3.95-7.86-9.36-4.19-14.83 1.49-2.22 4-3.4 7.56-3.55h19.74v-32.45c0-5.82 4.81-10.69 10.7-10.69h28.06c5.9 0 10.71 4.8 10.71 10.69v32.45h19.76z"
			/>
		</svg>
	);
}

function IconEditTemplate({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 117.74 122.88"
			width={13}
			height={13}
			aria-hidden
		>
			<g>
				<path
					fill="currentColor"
					fillRule="evenodd"
					clipRule="evenodd"
					d="M94.62,2c-1.46-1.36-3.14-2.09-5.02-1.99c-1.88,0-3.56,0.73-4.92,2.2L73.59,13.72l31.07,30.03l11.19-11.72 c1.36-1.36,1.88-3.14,1.88-5.02s-0.73-3.66-2.09-4.92L94.62,2L94.62,2L94.62,2z M41.44,109.58c-4.08,1.36-8.26,2.62-12.35,3.98 c-4.08,1.36-8.16,2.72-12.35,4.08c-9.73,3.14-15.07,4.92-16.22,5.23c-1.15,0.31-0.42-4.18,1.99-13.6l7.74-29.61l0.64-0.66 l30.56,30.56L41.44,109.58L41.44,109.58L41.44,109.58z M22.2,67.25l42.99-44.82l31.07,29.92L52.75,97.8L22.2,67.25L22.2,67.25z"
				/>
			</g>
		</svg>
	);
}

export interface MessageTemplatesModalProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertContent: (content: string) => void;
}

export default function MessageTemplatesModal({
	isOpen,
	onClose,
	onInsertContent,
}: MessageTemplatesModalProps) {
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const [tab, setTab] = useState<MessageTemplateScope>("personal");
	const [companyGroupFilter, setCompanyGroupFilter] =
		useState<AdminCompanyGroupFilter>("all");
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [draftId, setDraftId] = useState<number | undefined>(undefined);
	const [draftType, setDraftType] = useState<MessageTemplateKind>("personal");
	const [draftGroup, setDraftGroup] = useState<MessageTemplateGroupDto>("Expedite");
	const [draftTitle, setDraftTitle] = useState("");
	const [draftMessage, setDraftMessage] = useState("");
	const [formError, setFormError] = useState<string | null>(null);

	const showCompanyTab = useMemo(() => canSeeCompanyTab(currentUser), [currentUser]);
	const adminUser = useMemo(() => isAdminUser(currentUser), [currentUser]);

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	useEffect(() => {
		if (!isOpen) {
			setSearchInput("");
			setDebouncedSearch("");
			setTab("personal");
			setCompanyGroupFilter("all");
			setEditorOpen(false);
			setDraftId(undefined);
			setDraftTitle("");
			setDraftType("personal");
			setDraftGroup("Expedite");
			setDraftMessage("");
			setFormError(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !currentUser) return;
		if (tab === "company" && !showCompanyTab) setTab("personal");
	}, [isOpen, currentUser, tab, showCompanyTab]);

	const saveMutation = useMutation({
		mutationFn: upsertMessageTemplate,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["message-templates"] });
			setEditorOpen(false);
			setFormError(null);
		},
		onError: (err: unknown) => {
			setFormError(err instanceof Error ? err.message : "Save failed");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteMessageTemplate,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["message-templates"] });
		},
	});

	const handleDeleteTemplate = useCallback(
		(tpl: MessageTemplateDto) => {
			if (
				!window.confirm(
					"Delete this template? This cannot be undone."
				)
			) {
				return;
			}
			deleteMutation.mutate(tpl.id, {
				onError: err => {
					window.alert(err instanceof Error ? err.message : "Delete failed");
				},
			});
		},
		[deleteMutation]
	);

	const openCreateEditor = useCallback(() => {
		setDraftId(undefined);
		setDraftTitle("");
		setDraftMessage("");
		setFormError(null);
		if (tab === "personal") {
			setDraftType("personal");
			setDraftGroup(managerDefaultGroup(currentUser));
		} else {
			setDraftType("company");
			if (isAdminUser(currentUser)) {
				setDraftGroup("Expedite");
			} else {
				setDraftGroup(managerDefaultGroup(currentUser));
			}
		}
		setEditorOpen(true);
	}, [tab, currentUser]);

	const openEditEditor = useCallback((tpl: MessageTemplateDto) => {
		setDraftId(tpl.id);
		setDraftTitle(tpl.title ?? "");
		setDraftMessage(tpl.content ?? "");
		setDraftType(tpl.type);
		setDraftGroup(tpl.group ?? managerDefaultGroup(currentUser));
		setFormError(null);
		setEditorOpen(true);
	}, [currentUser]);

	const handleSubmitTemplate = useCallback(() => {
		const msg = draftMessage.trim();
		if (!msg) {
			setFormError("Message is required.");
			return;
		}
		setFormError(null);

		if (draftType === "personal") {
			saveMutation.mutate({
				...(draftId != null ? { id: draftId } : {}),
				type: "personal",
				title: draftTitle.trim() || undefined,
				content: msg,
			});
			return;
		}

		// Company
		const base = {
			...(draftId != null ? { id: draftId } : {}),
			type: "company" as const,
			title: draftTitle.trim() || undefined,
			content: msg,
		};
		if (isAdminUser(currentUser)) {
			saveMutation.mutate({ ...base, group: draftGroup });
		} else {
			saveMutation.mutate(base);
		}
	}, [
		draftId,
		draftType,
		draftGroup,
		draftTitle,
		draftMessage,
		saveMutation,
		currentUser,
	]);

	const scope = tab;

	const listQueryEnabled =
		isOpen && (scope === "personal" || (scope === "company" && showCompanyTab));

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isPending,
		isError,
		error,
	} = useInfiniteQuery({
		queryKey: [
			"message-templates",
			scope,
			debouncedSearch,
			scope === "company" && adminUser ? companyGroupFilter : "na",
		],
		queryFn: ({ pageParam }) =>
			fetchMessageTemplatesPage({
				scope,
				page: pageParam as number,
				limit: PER_PAGE,
				search: debouncedSearch || undefined,
				companyGroup:
					scope === "company" && adminUser ? companyGroupFilter : undefined,
			}),
		initialPageParam: 1,
		getNextPageParam: lastPage =>
			lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
		enabled: listQueryEnabled,
	});

	const items: MessageTemplateDto[] = useMemo(
		() => data?.pages.flatMap(p => p.items) ?? [],
		[data?.pages]
	);

	const scrollRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen || !hasNextPage || isFetchingNextPage || items.length === 0) return;
		const el = sentinelRef.current;
		const root = scrollRef.current;
		if (!el || !root) return;
		const obs = new IntersectionObserver(
			entries => {
				if (entries[0]?.isIntersecting) fetchNextPage();
			},
			{ root, rootMargin: "80px", threshold: 0 }
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [isOpen, hasNextPage, isFetchingNextPage, items.length, fetchNextPage]);

	const handleInsert = useCallback((tpl: MessageTemplateDto) => {
		onInsertContent(tpl.content ?? "");
	}, [onInsertContent]);

	const searchPlaceholder =
		tab === "personal" ? "Search personal templates" : "Search company templates";

	const showHeaderAdd =
		tab === "personal" || (tab === "company" && canCreateCompanyTemplate(currentUser));

	const editorCompany = draftType === "company";
	const editorShowAdminGroupPicker =
		editorCompany && isAdminUser(currentUser);
	const editorShowManagerGroupHint =
		editorCompany &&
		isCompanyCreatorUser(currentUser) &&
		!isAdminUser(currentUser);

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				showCloseButton={false}
				closeOnBackdropClick={!editorOpen}
				closeOnEscape={!editorOpen}
				className="flex max-h-[min(85vh,560px)] w-full max-w-lg flex-col overflow-hidden p-0"
			>
				<div className="flex min-h-0 flex-1 flex-col">
					<div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<h2 className="min-w-0 text-lg font-semibold leading-tight text-gray-900 dark:text-white">
								Text message templates
							</h2>
							{showHeaderAdd ? (
								<button
									type="button"
									className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
									aria-label="Add template"
									title="Add template"
									onClick={openCreateEditor}
								>
									<IconAddTemplate className="block shrink-0" />
								</button>
							) : null}
						</div>
						<button
							type="button"
							onClick={onClose}
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
							aria-label="Close"
						>
							<X className="h-3.5 w-3.5" strokeWidth={2.25} />
						</button>
					</div>

					<div className="flex shrink-0 border-b border-gray-200 dark:border-gray-800">
						<button
							type="button"
							onClick={() => {
								setTab("personal");
								setCompanyGroupFilter("all");
							}}
							className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
								tab === "personal"
									? "text-brand-600 dark:text-brand-400"
									: "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
							}`}
						>
							Personal
							{tab === "personal" ? (
								<span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-brand-500 dark:bg-brand-400" />
							) : null}
						</button>
						{showCompanyTab ? (
							<button
								type="button"
								onClick={() => setTab("company")}
								className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
									tab === "company"
										? "text-brand-600 dark:text-brand-400"
										: "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
								}`}
							>
								Company
								{tab === "company" ? (
									<span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-brand-500 dark:bg-brand-400" />
								) : null}
							</button>
						) : null}
					</div>

					<div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							<input
								type="search"
								value={searchInput}
								onChange={e => setSearchInput(e.target.value)}
								placeholder={searchPlaceholder}
								className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white dark:placeholder:text-gray-500"
							/>
						</div>
					</div>

					{tab === "company" && adminUser ? (
						<div className="shrink-0 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
							<div className="flex flex-wrap gap-1.5">
								{ADMIN_GROUP_TABS.map(t => (
									<button
										key={t.id}
										type="button"
										onClick={() => setCompanyGroupFilter(t.id)}
										className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
											companyGroupFilter === t.id
												? "bg-brand-600 text-white dark:bg-brand-500"
												: "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-white/10"
										}`}
									>
										{t.label}
									</button>
								))}
							</div>
						</div>
					) : null}

					<div
						ref={scrollRef}
						className="min-h-[200px] flex-1 overflow-y-auto overscroll-contain px-2 pb-4 pt-2"
					>
						{!listQueryEnabled ? null : isPending ? (
							<p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
								Loading templates…
							</p>
						) : isError ? (
							<p className="px-3 py-8 text-center text-sm text-red-600 dark:text-red-400">
								{error instanceof Error ? error.message : "Failed to load templates"}
							</p>
						) : items.length === 0 ? (
							<p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
								No templates yet.
							</p>
						) : (
							<ul className="space-y-0">
								{items.map(tpl => (
									<li
										key={`${tpl.id}-${tpl.updatedAt}`}
										className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
									>
										<div className="flex items-start gap-2 px-3 py-3">
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
													{tpl.title?.trim() ? tpl.title : "Untitled"}
												</p>
												{tpl.type === "company" && tpl.group ? (
													<p className="text-[11px] font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
														{tpl.group}
													</p>
												) : null}
												<p className="truncate text-sm text-gray-500 dark:text-gray-400">
													{tpl.content?.trim()
														? tpl.content.replace(/\s+/g, " ").trim()
														: "—"}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<button
													type="button"
													className={templateRowActionBtnClass}
													aria-label="Insert template into message"
													title="Insert"
													onClick={() => handleInsert(tpl)}
												>
													<IconInsertTemplate className="block shrink-0" />
												</button>
												{canEditTemplate(tpl, currentUser) ? (
													<button
														type="button"
														className={templateRowActionBtnClass}
														aria-label="Edit template"
														title="Edit"
														onClick={() => openEditEditor(tpl)}
													>
														<IconEditTemplate className="block shrink-0" />
													</button>
												) : null}
												{canDeleteTemplate(tpl, currentUser) ? (
													<button
														type="button"
														className={templateRowDeleteBtnClass}
														aria-label="Delete template"
														title="Delete"
														disabled={deleteMutation.isPending}
														onClick={() => handleDeleteTemplate(tpl)}
													>
														<Trash2 className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
													</button>
												) : null}
											</div>
										</div>
									</li>
								))}
							</ul>
						)}
						<div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />
						{isFetchingNextPage ? (
							<p className="pb-4 text-center text-xs text-gray-500 dark:text-gray-400">
								Loading more…
							</p>
						) : null}
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={editorOpen && isOpen}
				onClose={() => {
					if (!saveMutation.isPending) setEditorOpen(false);
				}}
				showCloseButton={false}
				closeOnBackdropClick={!saveMutation.isPending}
				className="flex w-full max-w-md flex-col overflow-hidden p-0"
			>
				<div className="flex flex-col gap-4 p-5">
					<div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
							{draftId != null ? "Edit message template" : "Add message template"}
						</h2>
						<button
							type="button"
							disabled={saveMutation.isPending}
							onClick={() => setEditorOpen(false)}
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
							aria-label="Close"
						>
							<X className="h-3.5 w-3.5" strokeWidth={2.25} />
						</button>
					</div>

					{draftType === "personal" ? (
						<p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
							Personal template (only you). Not linked to a company group.
						</p>
					) : null}

					{editorShowAdminGroupPicker ? (
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Group</span>
							<select
								value={draftGroup}
								disabled={saveMutation.isPending}
								onChange={e =>
									setDraftGroup(e.target.value as MessageTemplateGroupDto)
								}
								className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white"
							>
								<option value="Expedite">Expedite</option>
								<option value="HR">HR</option>
								<option value="Tracking">Tracking</option>
							</select>
						</label>
					) : null}

					{editorShowManagerGroupHint ? (
						<p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
							Company template · Group:&nbsp;
							<strong>{draftGroup}</strong>
							{draftId == null ? " (assigned from your role)" : null}
						</p>
					) : null}

					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</span>
						<input
							type="text"
							value={draftTitle}
							onChange={e => setDraftTitle(e.target.value)}
							placeholder="Optional title"
							disabled={saveMutation.isPending}
							className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white dark:placeholder:text-gray-500"
						/>
					</label>

					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</span>
						<textarea
							value={draftMessage}
							onChange={e => setDraftMessage(e.target.value)}
							placeholder="Template text"
							rows={6}
							disabled={saveMutation.isPending}
							className="resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white dark:placeholder:text-gray-500"
						/>
					</label>

					{formError ? (
						<p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
					) : null}

					<button
						type="button"
						onClick={handleSubmitTemplate}
						disabled={saveMutation.isPending}
						className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
					>
						{saveMutation.isPending ? "Saving…" : "Save"}
					</button>
				</div>
			</Modal>
		</>
	);
}
