"use client";

import React, { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useQuery } from "@tanstack/react-query";
import users from "@/app-api/users";
import { renderAvatar } from "@/helpers";
import type { UserListItem } from "@/app-api/api-types";

const OFFERS_USER_ROLES = [
	"ADMINISTRATOR",
	"DISPATCHER",
	"DISPATCHER_TL",
	"EXPEDITE_MANAGER",
	"MORNING_TRACKING",
	"NIGHTSHIFT_TRACKING",
] as const;

const ROLE_LABELS: Record<string, string> = {
	ADMINISTRATOR: "Administrator",
	DISPATCHER: "Dispatcher",
	DISPATCHER_TL: "Dispatcher TL",
	EXPEDITE_MANAGER: "Expedite Manager",
	MORNING_TRACKING: "Morning Tracking",
	NIGHTSHIFT_TRACKING: "Nightshift Tracking",
};

const STALE_TIME_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface UserFilterSelectProps {
	value: string;
	onChangeAction: (val: string) => void;
}

function getUserDisplayName(item: UserListItem): string {
	const name = [item.firstName, item.lastName].filter(Boolean).join(" ").trim();
	return name || "-";
}

function getRoleLabel(role: string): string {
	return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export default function UserFilterSelect({ value, onChangeAction }: UserFilterSelectProps) {
	const [open, setOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	useClickOutside(dropdownRef, () => setOpen(false));

	const { data } = useQuery({
		queryKey: ["offers-user-filter", OFFERS_USER_ROLES],
		queryFn: () =>
			users.getAllUsers({
				page: 1,
				limit: 500,
				roles: [...OFFERS_USER_ROLES],
			}),
		staleTime: STALE_TIME_MS,
	});

	const userList: UserListItem[] = data?.data?.data?.users ?? [];
	const selectedUser = userList.find((u) => (u.externalId ?? u.id) === value);

	const handleSelect = (val: string) => {
		onChangeAction(val);
		setOpen(false);
	};

	return (
		<div className="relative min-w-[180px]" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={`w-full py-2 px-3 text-sm text-gray-800 bg-transparent border border-gray-300 rounded-lg appearance-none dark:bg-dark-900 h-9 bg-none shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 flex items-center justify-between gap-2 ${open ? "rounded-b-none" : ""}`}
			>
				{value ? (
					selectedUser ? (
						<span className="flex items-center gap-2 min-w-0">
							{renderAvatar(selectedUser, "w-6 h-6 flex-shrink-0")}
							<span className="truncate">{getUserDisplayName(selectedUser)}</span>
						</span>
					) : (
						<span className="truncate">Loading...</span>
					)
				) : (
					<span>All</span>
				)}
				<ChevronDown className="w-4 h-4 flex-shrink-0" />
			</button>

			{open && (
				<div className="absolute z-[100] w-full min-w-[200px] max-h-[280px] overflow-y-auto bg-white border border-gray-300 border-t-0 rounded-b-md shadow-lg dark:bg-gray-800 dark:border-gray-700">
					<div
						onClick={() => handleSelect("")}
						className={`px-2 py-1.5 w-full text-left cursor-pointer flex items-center gap-2
							${!value ? "bg-brand-500 text-white" : "text-gray-900 dark:text-white hover:bg-brand-500 hover:text-white"}
						`}
					>
						<span className="text-xs">All</span>
					</div>
					{userList.map((user) => {
						const externalId = user.externalId ?? user.id;
						const isSelected = externalId === value;
						return (
							<div
								key={user.id}
								onClick={() => handleSelect(externalId)}
								className={`group px-2 py-1.5 w-full text-left cursor-pointer flex items-center gap-2
									${isSelected ? "bg-brand-500 text-white" : "text-gray-900 dark:text-white hover:bg-brand-500 hover:text-white"}
								`}
							>
								{renderAvatar(user, `w-6 h-6 flex-shrink-0 ${isSelected ? "!bg-white !text-brand-600" : "group-hover:!bg-white group-hover:!text-brand-600"}`)}
								<div className="min-w-0 flex-1">
									<div className="text-xs truncate">{getUserDisplayName(user)}</div>
									{user.role && (
										<div className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400 group-hover:text-white/80"}`}>
											{getRoleLabel(user.role)}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
