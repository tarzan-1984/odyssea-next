"use client";

import {
	busyOnOtherLoadHref,
	busyOnOtherLoadRefLabel,
	type BusyOnOtherLoad,
} from "@/utils/busyOnOtherLoad";

type BusyOnOtherLoadMessageProps = {
	busy: BusyOnOtherLoad;
	className?: string;
};

export default function BusyOnOtherLoadMessage({
	busy,
	className,
}: BusyOnOtherLoadMessageProps) {
	const refLabel = busyOnOtherLoadRefLabel(busy);
	const href = busyOnOtherLoadHref(busy);
	return (
		<p className={className}>
			Driver is currently active on Load #
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="font-semibold underline underline-offset-2"
			>
				{refLabel}
			</a>
			. ETA will be available after delivery is completed.
		</p>
	);
}
