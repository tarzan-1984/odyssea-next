/** Visible duration before auto-close (hover pauses the timer). */
export const CHAT_TOAST_AUTO_CLOSE_MS = 3000;
export const SYSTEM_TOAST_AUTO_CLOSE_MS = 3000;

export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export const DEFAULT_TOAST_POSITION: ToastPosition = "top-right";

export const TOAST_POSITION_OPTIONS: {
	value: ToastPosition;
	label: string;
	description: string;
}[] = [
	{
		value: "top-left",
		label: "Top left",
		description: "Below the header on the left",
	},
	{
		value: "top-right",
		label: "Top right",
		description: "Default — below the header on the right",
	},
	{
		value: "bottom-left",
		label: "Bottom left",
		description: "Lower left corner with bottom offset",
	},
	{
		value: "bottom-right",
		label: "Bottom right",
		description: "Lower right corner with bottom offset",
	},
];

const TOAST_CONTAINER_BASE =
	"fixed z-[99990] space-y-2 pointer-events-none";

/** Below sticky AppHeader; xl = single row, smaller screens = taller bar with time zones. */
export const TOAST_CONTAINER_CLASS = `${TOAST_CONTAINER_BASE} right-4 top-[7.25rem] xl:top-[5.5rem]`;

export function isToastPosition(value: unknown): value is ToastPosition {
	return (
		value === "top-right" ||
		value === "top-left" ||
		value === "bottom-right" ||
		value === "bottom-left"
	);
}

export function isToastSlideFromLeft(position: ToastPosition): boolean {
	return position === "top-left" || position === "bottom-left";
}

export function isToastBottomPosition(position: ToastPosition): boolean {
	return position === "bottom-right" || position === "bottom-left";
}

export function getToastContainerClass(position: ToastPosition): string {
	switch (position) {
		case "top-left":
			return `${TOAST_CONTAINER_BASE} left-4 top-[7.25rem] xl:top-[5.5rem]`;
		case "bottom-right":
			return `${TOAST_CONTAINER_BASE} right-4 bottom-6 flex flex-col-reverse space-y-reverse`;
		case "bottom-left":
			return `${TOAST_CONTAINER_BASE} left-4 bottom-6 flex flex-col-reverse space-y-reverse`;
		case "top-right":
		default:
			return TOAST_CONTAINER_CLASS;
	}
}

export function getToastStackOffset(position: ToastPosition, index: number): string {
	const offset = index * 8;
	if (isToastBottomPosition(position)) {
		return `translateY(-${offset}px)`;
	}
	return `translateY(${offset}px)`;
}

export function getToastSlideClasses(
	isVisible: boolean,
	isClosing: boolean,
	slideFromLeft: boolean
): string {
	const shown = isVisible && !isClosing;
	if (shown) {
		return "translate-x-0 opacity-100";
	}
	return slideFromLeft ? "-translate-x-full opacity-0" : "translate-x-full opacity-0";
}
