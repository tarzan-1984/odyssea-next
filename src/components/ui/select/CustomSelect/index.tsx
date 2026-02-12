"use client";

import React, { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface ICustomStaticSelectProps {
	options: { value: string; label: string }[];
	value: string;
	onChangeAction: (val: string) => void;
}

export default function CustomStaticSelect({
	options,
	value,
	onChangeAction,
}: ICustomStaticSelectProps) {
	const [open, setOpen] = useState(false);

	const dropdownRef = useRef<HTMLDivElement>(null);

	useClickOutside(dropdownRef, () => setOpen(false));

	const handleSelect = (val: string) => {
		onChangeAction(val);
		setOpen(false);
	};

	return (
		<div className="relative min-w-15" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={`w-full py-2 px-3 text-sm text-gray-800 bg-transparent border border-gray-300 rounded-lg appearance-none dark:bg-dark-900 h-9 bg-none shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 flex items-center justify-between gap-2 ${open ? "rounded-b-none" : ""}`}
			>
				<span>{options.find(o => o.value === value)?.label || "Select"}</span>
				<ChevronDown className="w-4 h-4" />
			</button>

			{open && (
				<div className="absolute z-[100] w-full bg-white border border-gray-300 border-t-0 rounded-b-md shadow-lg dark:bg-gray-800 dark:border-gray-700">
					{options.map(option => {
						const isSelected = option.value === value;

						return (
							<div
								key={option.value}
								onClick={() => handleSelect(option.value)}
								className={`px-2 py-1 w-full text-left cursor-pointer text-gray-900 dark:text-white
									${isSelected ? "bg-brand-500 text-white" : "hover:bg-brand-500 hover:text-white"}
								`}
							>
								<p className="text-xs">{option.label}</p>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
