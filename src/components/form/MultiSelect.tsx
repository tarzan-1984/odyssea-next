import React, { useState, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

interface Option {
	value: string;
	text: string;
	selected: boolean;
	icon?: ReactNode;
}

interface MultiSelectProps {
	label: string;
	options: Option[];
	defaultSelected?: string[];
	onChange?: (selected: string[]) => void;
	disabled?: boolean;
	/** Optional class for the trigger (dropdown button) to match other form fields e.g. h-11 */
	triggerClassName?: string;
	/** When "sm", uses compact styling (h-[38px], px-3 py-2) to match native select inputs */
	size?: "default" | "sm";
	/** When true, renders dropdown via portal into document.body to avoid z-index/overflow issues (e.g. above maps) */
	dropdownInPortal?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
	label,
	options,
	defaultSelected = [],
	onChange,
	disabled = false,
	triggerClassName = "",
	size = "default",
	dropdownInPortal = false,
}) => {
	const [selectedOptions, setSelectedOptions] = useState<string[]>(defaultSelected);
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const portalDropdownRef = useRef<HTMLDivElement | null>(null);

	const toggleDropdown = () => {
		if (disabled) return;
		setIsOpen(prev => {
			if (!prev) {
				// Opening dropdown - reset search
				setSearchTerm("");
			}
			return !prev;
		});
	};

	const handleSelect = (optionValue: string) => {
		const newSelectedOptions = selectedOptions.includes(optionValue)
			? selectedOptions.filter(value => value !== optionValue)
			: [...selectedOptions, optionValue];

		setSelectedOptions(newSelectedOptions);
		if (onChange) onChange(newSelectedOptions);
	};

	const removeOption = (index: number, value: string) => {
		const newSelectedOptions = selectedOptions.filter(opt => opt !== value);
		setSelectedOptions(newSelectedOptions);
		if (onChange) onChange(newSelectedOptions);
	};

	const selectedValuesText = selectedOptions.map(
		value => options.find(option => option.value === value)?.text || ""
	);

	// Filter options based on search term
	const filteredOptions = options.filter(option =>
		option.text.toLowerCase().includes(searchTerm.toLowerCase())
	);

	// Синхронизировать локальный стейт с defaultSelected (например, при Reset фильтров)
	useEffect(() => {
		setSelectedOptions(defaultSelected);
	}, [defaultSelected]);

	// Update dropdown position when opening (for portal mode) - use fixed position (viewport coords)
	useEffect(() => {
		if (isOpen && dropdownInPortal && triggerRef.current) {
			const updateRect = () => {
				if (triggerRef.current) {
					const rect = triggerRef.current.getBoundingClientRect();
					setDropdownRect({
						top: rect.bottom,
						left: rect.left,
						width: rect.width,
					});
				}
			};
			updateRect();
			window.addEventListener("scroll", updateRect, true);
			window.addEventListener("resize", updateRect);
			return () => {
				window.removeEventListener("scroll", updateRect, true);
				window.removeEventListener("resize", updateRect);
			};
		} else if (!isOpen) {
			setDropdownRect(null);
		}
	}, [isOpen, dropdownInPortal]);

	const dropdownContent = (
		<>
			<div className="p-2 border-b border-gray-200 dark:border-gray-700">
				<input
					type="text"
					placeholder="Search participants..."
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
					onClick={e => e.stopPropagation()}
				/>
			</div>
			<div className="flex flex-col">
				{filteredOptions.length > 0 ? (
					filteredOptions.map((option, index) => {
						const isSelected = selectedOptions.includes(option.value);
						return (
							<div key={index}>
								<div
									className={`w-full cursor-pointer rounded-t border-b border-gray-200 dark:border-gray-700 p-2 pl-2 flex items-center ${
										isSelected
											? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
											: "hover:bg-gray-50 dark:hover:bg-gray-600"
									}`}
									onClick={() => handleSelect(option.value)}
								>
									<div className="mx-2 flex items-center gap-2 leading-6 text-gray-800 dark:text-white">
										{option.icon && (
											<span className="inline-flex h-5 w-5 items-center justify-center">
												{option.icon}
											</span>
										)}
										<span>{option.text}</span>
									</div>
								</div>
							</div>
						);
					})
				) : (
					<div className="p-3 text-sm text-gray-500 dark:text-white text-center">
						No participants found
					</div>
				)}
			</div>
		</>
	);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			const inContainer = containerRef.current?.contains(target);
			const inPortal = dropdownInPortal && portalDropdownRef.current?.contains(target);
			if (!inContainer && !inPortal) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen, dropdownInPortal]);

	const triggerBaseClass =
		size === "sm"
			? "relative flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-theme-xs outline-hidden transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-brand-800 h-[38px] min-h-[38px]"
			: "relative flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs outline-hidden transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 min-h-[44px]";

	return (
		<div
			className={`w-full ${size === "sm" ? "flex flex-col gap-1" : ""}`}
			ref={containerRef}
		>
			<label
				className={
					size === "sm"
						? "block text-xs font-medium text-gray-700 dark:text-gray-300"
						: "mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
				}
			>
				{label}
			</label>

			<div ref={triggerRef} className="relative z-20 inline-block w-full">
				<div className="relative flex flex-col items-center">
					<div onClick={toggleDropdown} className="w-full">
						<div className={`${triggerBaseClass} ${triggerClassName}`.trim()}>
							<div className="flex flex-wrap flex-auto gap-2">
								{selectedValuesText.length > 0 ? (
									selectedValuesText.map((text, index) => (
										<div
											key={index}
											className="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 pl-2.5 pr-2 text-sm  hover:border-gray-200 dark:bg-gray-800 dark:text-white text-gray-900 placeholder:text-gray-500"
										>
											<span className="flex-initial max-w-full">{text}</span>
											<div className="flex flex-row-reverse flex-auto">
												<div
													onClick={() =>
														removeOption(index, selectedOptions[index])
													}
													className="pl-2 text-gray-500 cursor-pointer group-hover:text-gray-400 dark:text-white"
												>
													<svg
														className="fill-current"
														role="button"
														width="14"
														height="14"
														viewBox="0 0 14 14"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path
															fillRule="evenodd"
															clipRule="evenodd"
															d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z"
														/>
													</svg>
												</div>
											</div>
										</div>
									))
								) : (
									<input
										placeholder="Select option"
										className="w-full h-full text-sm bg-transparent border-0 outline-hidden appearance-none focus:border-0 focus:outline-hidden focus:ring-0 text-gray-800 placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30"
										readOnly
										value="Select option"
									/>
								)}
							</div>
							<button
								type="button"
								onClick={e => {
									e.stopPropagation();
									toggleDropdown();
								}}
								className="absolute inset-y-0 right-[1px] flex items-center justify-center text-gray-700 outline-hidden cursor-pointer focus:outline-hidden dark:text-white"
							>
								<svg
									className={`stroke-current pointer-events-none ${isOpen ? "rotate-180" : ""}`}
									width="16"
									height="16"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M4.79175 7.39551L10.0001 12.6038L15.2084 7.39551"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
						</div>
					</div>

					{isOpen && !dropdownInPortal && (
						<div
							className="absolute left-0 z-[1100] w-full overflow-y-auto bg-white rounded-lg shadow-sm top-full max-h-60 dark:bg-gray-800"
							onClick={e => e.stopPropagation()}
						>
							{dropdownContent}
						</div>
					)}

					{isOpen &&
						dropdownInPortal &&
						dropdownRect &&
						typeof document !== "undefined" &&
						createPortal(
							<div
								ref={el => {
									portalDropdownRef.current = el;
								}}
								className="fixed z-[9999] overflow-y-auto bg-white rounded-lg shadow-lg max-h-60 dark:bg-gray-800"
								style={{
									top: dropdownRect.top,
									left: dropdownRect.left,
									width: dropdownRect.width,
								}}
								onClick={e => e.stopPropagation()}
							>
								{dropdownContent}
							</div>,
							document.body
						)}
				</div>
			</div>
		</div>
	);
};

export default MultiSelect;
