"use client";

import React from "react";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import {
	getSpecialRequirementIconUrl,
	getSpecialRequirementLabel,
	parseSpecialRequirements,
} from "@/icons/additional/specialRequirementIcons";

const ICON_WRAPPER_CLASS = "inline-flex h-11 w-11 items-center justify-center rounded bg-white dark:bg-white";
const ICON_INNER_CLASS = "h-9 w-9 shrink-0 object-contain";

interface SpecialRequirementsListProps {
	value: unknown;
	className?: string;
}

export default function SpecialRequirementsList({
	value,
	className,
}: SpecialRequirementsListProps) {
	const values = parseSpecialRequirements(value);
	if (values.length === 0) return null;

	return (
		<div className={`flex flex-wrap items-center justify-center gap-2 ${className ?? ""}`}>
			{values.map((item, index) => {
				const label = getSpecialRequirementLabel(item);
				const iconUrl = getSpecialRequirementIconUrl(item);

				if (!iconUrl) {
					return (
						<span key={`${item}-${index}`} className="text-theme-sm text-gray-800 dark:text-gray-200">
							{label}
						</span>
					);
				}

				return (
					<Tooltip key={`${item}-${index}`} theme="inverse" content={label} position="top">
						<span className={ICON_WRAPPER_CLASS}>
							<img
								src={encodeURI(iconUrl)}
								alt={label}
								className={ICON_INNER_CLASS}
								loading="lazy"
								decoding="async"
							/>
						</span>
					</Tooltip>
				);
			})}
		</div>
	);
}
