"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
	createEmptyDimensionsFilter,
	type DimensionsFilterValues,
} from "./dimensionsFilterUtils";

export interface MinDimensionsModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialValues: DimensionsFilterValues;
	onApply: (values: DimensionsFilterValues) => void;
}

const inputBaseClassName =
	"h-11 w-full rounded-lg border-2 bg-white px-3 py-2.5 text-center text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-3 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-white/30";

const dimensionInputClassName = {
	// LENGTH — green arrow on diagram
	dim_min_1: `${inputBaseClassName} border-[#16a34a] focus:border-[#16a34a] focus:ring-[#16a34a]/20 dark:border-[#22c55e] dark:focus:border-[#22c55e] dark:focus:ring-[#22c55e]/20`,
	// WIDTH — orange arrow on diagram
	dim_min_2: `${inputBaseClassName} border-[#ea580c] focus:border-[#ea580c] focus:ring-[#ea580c]/20 dark:border-[#f97316] dark:focus:border-[#f97316] dark:focus:ring-[#f97316]/20`,
	// HEIGHT — blue arrow on diagram
	dim_min_3: `${inputBaseClassName} border-[#2563eb] focus:border-[#2563eb] focus:ring-[#2563eb]/20 dark:border-[#3b82f6] dark:focus:border-[#3b82f6] dark:focus:ring-[#3b82f6]/20`,
} as const;

const dimensionLabelClassName = {
	dim_min_1: "text-[#16a34a] dark:text-[#22c55e]",
	dim_min_2: "text-[#ea580c] dark:text-[#f97316]",
	dim_min_3: "text-[#2563eb] dark:text-[#3b82f6]",
} as const;

export default function MinDimensionsModal({
	isOpen,
	onClose,
	initialValues,
	onApply,
}: MinDimensionsModalProps) {
	const [draft, setDraft] = useState<DimensionsFilterValues>(createEmptyDimensionsFilter);

	useEffect(() => {
		if (isOpen) {
			setDraft({ ...initialValues });
		}
	}, [isOpen, initialValues]);

	const handleApply = () => {
		onApply({
			dim_min_1: draft.dim_min_1.trim(),
			dim_min_2: draft.dim_min_2.trim(),
			dim_min_3: draft.dim_min_3.trim(),
		});
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<div className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Min dimensions
				</h2>

				<div className="mt-4 flex justify-center">
					<Image
						src="/images/min-dimensions.png"
						alt="Cargo van dimensions diagram"
						width={420}
						height={280}
						className="h-auto w-full max-w-[420px] object-contain"
						priority
					/>
				</div>

				<div className="mt-6 flex items-end justify-center gap-2">
					<div className="w-24">
						<Label
							htmlFor="dim_min_1"
							className={`mb-1.5 block text-center font-medium ${dimensionLabelClassName.dim_min_1}`}
						>
							L
						</Label>
						<input
							id="dim_min_1"
							name="dim_min_1"
							type="number"
							inputMode="decimal"
							step="0.01"
							min="0"
							value={draft.dim_min_1}
							onChange={e =>
								setDraft(prev => ({ ...prev, dim_min_1: e.target.value }))
							}
							placeholder="min"
							className={dimensionInputClassName.dim_min_1}
						/>
					</div>

					<span className="mb-3 text-sm text-gray-400 dark:text-gray-500">x</span>

					<div className="w-24">
						<Label
							htmlFor="dim_min_2"
							className={`mb-1.5 block text-center font-medium ${dimensionLabelClassName.dim_min_2}`}
						>
							W
						</Label>
						<input
							id="dim_min_2"
							name="dim_min_2"
							type="number"
							inputMode="decimal"
							step="0.01"
							min="0"
							value={draft.dim_min_2}
							onChange={e =>
								setDraft(prev => ({ ...prev, dim_min_2: e.target.value }))
							}
							placeholder="min"
							className={dimensionInputClassName.dim_min_2}
						/>
					</div>

					<span className="mb-3 text-sm text-gray-400 dark:text-gray-500">x</span>

					<div className="w-24">
						<Label
							htmlFor="dim_min_3"
							className={`mb-1.5 block text-center font-medium ${dimensionLabelClassName.dim_min_3}`}
						>
							H
						</Label>
						<input
							id="dim_min_3"
							name="dim_min_3"
							type="number"
							inputMode="decimal"
							step="0.01"
							min="0"
							value={draft.dim_min_3}
							onChange={e =>
								setDraft(prev => ({ ...prev, dim_min_3: e.target.value }))
							}
							placeholder="min"
							className={dimensionInputClassName.dim_min_3}
						/>
					</div>
				</div>

				<div className="mt-6 flex items-center justify-between gap-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => setDraft(createEmptyDimensionsFilter())}
						className="border-error-500 text-error-500 hover:bg-error-50 dark:border-error-500 dark:text-error-400 dark:hover:bg-error-500/10"
					>
						Clear
					</Button>
					<Button type="button" size="sm" variant="primary" onClick={handleApply}>
						Apply
					</Button>
				</div>
			</div>
		</Modal>
	);
}
