"use client";
import React, { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "@/icons";
import { useChatModal } from "@/context/ChatModalContext";

export default function ChatHeaderTitle() {
	const [isOpen, setIsOpen] = useState(false);
	const { openAddRoomModal, openContactsModal } = useChatModal();

	function toggleDropdown() {
		setIsOpen(!isOpen);
	}

	function closeDropdown() {
		setIsOpen(false);
	}

	return (
		<div className="flex items-start justify-between">
			<div className="flex items-center gap-4">
				<h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
					Chats
				</h3>
			</div>
			<div className="relative">
				<button onClick={toggleDropdown} className="dropdown-toggle">
					<MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
				</button>
				<Dropdown isOpen={isOpen} onClose={closeDropdown} className="w-48 p-2">
					<DropdownItem
						onItemClick={() => {
							openAddRoomModal();
							closeDropdown();
						}}
						className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
					>
						Add New Room
					</DropdownItem>
					<DropdownItem
						onItemClick={closeDropdown}
						className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
					>
						View More
					</DropdownItem>
					<DropdownItem
						onItemClick={() => {
							openContactsModal();
							closeDropdown();
						}}
						className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
					>
						Contacts
					</DropdownItem>
				</Dropdown>
			</div>
		</div>
	);
}
