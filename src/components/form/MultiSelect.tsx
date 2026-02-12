import React, { useState, useEffect, useRef, ReactNode } from "react";

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
}

const MultiSelect: React.FC<MultiSelectProps> = ({
	label,
	options,
	defaultSelected = [],
	onChange,
	disabled = false,
	triggerClassName = "",
}) => {
	const [selectedOptions, setSelectedOptions] = useState<string[]>(defaultSelected);
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

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

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="w-full" ref={containerRef}>
			<label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white">
				{label}
			</label>

			<div className="relative z-20 inline-block w-full">
				<div className="relative flex flex-col items-center">
					<div onClick={toggleDropdown} className="w-full">
						<div className={`relative flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs outline-hidden transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 min-h-[38px] ${triggerClassName}`.trim()}>
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

					{isOpen && (
						<div
							className="absolute left-0 z-40 w-full overflow-y-auto bg-white rounded-lg shadow-sm top-full max-h-60 dark:bg-gray-800"
							onClick={e => e.stopPropagation()}
						>
							{/* Search input */}
							<div className="p-2 border-b border-gray-200 dark:border-gray-700">
								<input
									type="text"
									placeholder="Search participants..."
									value={searchTerm}
									onChange={e => setSearchTerm(e.target.value)}
									className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
								/>
							</div>
							<div className="flex flex-col">
								{filteredOptions.length > 0 ? (
									filteredOptions.map((option, index) => (
										<div key={index}>
											<div
												className={`hover:bg-primary/5 w-full cursor-pointer rounded-t border-b border-gray-200 dark:border-gray-800`}
												onClick={() => handleSelect(option.value)}
											>
												<div
													className={`relative flex w-full items-center p-2 pl-2 ${
														selectedOptions.includes(option.value)
															? "bg-primary/10"
															: ""
													}`}
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
										</div>
									))
								) : (
									<div className="p-3 text-sm text-gray-500 dark:text-white text-center">
										No participants found
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default MultiSelect;
