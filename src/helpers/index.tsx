import Image from "next/image";
import { UserData, UserListItem } from "@/app-api/api-types";
import { twMerge } from "tailwind-merge";

/**
 * Stable background color for LOAD/OFFER chat avatars when no image is set.
 * Derived from room id so the same chat always gets the same color.
 */
export function chatRoomPlaceholderBg(chatRoomId: string): string {
	let hash = 2166136261;
	for (let i = 0; i < chatRoomId.length; i++) {
		hash ^= chatRoomId.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	const hue = (hash >>> 0) % 360;
	// Saturated, mid–high lightness so placeholders read as bright, not dark
	return `hsl(${hue} 78% 62%)`;
}

/** Human-readable labels for user roles (used in chat, modals, etc.) */
const ROLE_DISPLAY_LABELS: Record<string, string> = {
	DRIVER_UPDATES: "Driver Updates",
	MODERATOR: "Moderator",
	RECRUITER: "Recruiter",
	ADMINISTRATOR: "Administrator",
	NIGHTSHIFT_TRACKING: "Nightshift Tracking",
	DISPATCHER: "Dispatcher",
	BILLING: "Billing",
	ACCOUNTING: "Accounting",
	RECRUITER_TL: "Recruiter Team Leader",
	DRIVER: "Driver",
	EXPEDITE_MANAGER: "Expedite Manager",
	TRACKING_TL: "Tracking Team Leader",
	DISPATCHER_TL: "Dispatcher Team Leader",
	TRACKING: "Tracking",
	SUBSCRIBER: "Subscriber",
	MORNING_TRACKING: "Morning Tracking",
	HR_MANAGER: "HR Manager",
	GAST: "Guest",
};

/**
 * Returns human-readable label for a role code (e.g. DRIVER -> "Driver").
 * Falls back to role with underscores replaced by spaces if not in mapping.
 */
export function getRoleDisplayLabel(role: string | null | undefined): string {
	if (!role || typeof role !== "string") return "User";
	const normalized = role.toUpperCase().trim();
	return ROLE_DISPLAY_LABELS[normalized] ?? role.replace(/_/g, " ");
}

const DEFAULT_AVATAR_BG = "#465fff";

/** Normalize TMS / DB hex color for CSS background (supports #RGB and #RRGGBB). */
function normalizeHexColor(raw?: string | null): string | null {
	if (raw == null || typeof raw !== "string") return null;
	let s = raw.trim();
	if (!s) return null;
	if (!s.startsWith("#")) s = `#${s}`;
	if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
	if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
		const r = s[1];
		const g = s[2];
		const b = s[3];
		return `#${r}${r}${g}${g}${b}${b}`;
	}
	return null;
}

/** Background for initials / plate behind photo (non-driver uses userColor when valid). */
export function resolveAvatarBackground(role?: string | null, userColor?: string | null): string {
	if (role?.toUpperCase().trim() === "DRIVER") return DEFAULT_AVATAR_BG;
	return normalizeHexColor(userColor) ?? DEFAULT_AVATAR_BG;
}

function pickAvatarPhotoUrl(item: UserData | UserListItem): string {
	const loose = item as UserData & UserListItem & { profilePhoto?: string };
	const fromAvatar = typeof loose.avatar === "string" ? loose.avatar.trim() : "";
	const fromPhoto = typeof loose.profilePhoto === "string" ? loose.profilePhoto.trim() : "";
	return fromAvatar || fromPhoto;
}

export type RenderAvatarOptions = {
	/** Parent element already sets backgroundColor (e.g. chat row wrapper); skip duplicate fill. */
	parentProvidesBackground?: boolean;
};

/**
 * Renders a user's avatar. If the user has an avatar image, it displays the image.
 * Otherwise, it generates a circle with the user's initials.
 *
 * Works for both `UserData` and `UserListItem` types.
 *
 * @param item - The user object which may contain avatar and name.
 * @param className - Optional Tailwind CSS classes to override default styling.
 * @returns The avatar element (either an Image or a div with initials).
 */
export function renderAvatar(
	item?: UserData | UserListItem | null,
	className?: string,
	options?: RenderAvatarOptions,
) {
	if (!item) return <div className={twMerge("w-10 h-10 bg-gray-300 rounded-full", className)} />;

	const u = item as UserData | UserListItem;
	const bg = resolveAvatarBackground(u.role, u.userColor ?? null);
	const photoUrl = pickAvatarPhotoUrl(item);
	const parentBg = options?.parentProvidesBackground === true;

	if (photoUrl) {
		if (parentBg) {
			return (
				<Image
					src={photoUrl}
					alt="user"
					fill
					className={twMerge("object-cover", className)}
					sizes="40px"
				/>
			);
		}
		return (
			<div
				className={twMerge("relative shrink-0 overflow-hidden rounded-full", className)}
				style={{ backgroundColor: bg }}
			>
				<Image src={photoUrl} alt="user" fill className="object-cover" sizes="96px" />
			</div>
		);
	}

	// Get the username depending on the object type
	const name = (() => {
		if ("firstName" in item && "lastName" in item) {
			return `${item.firstName} ${item.lastName}`.trim();
		}

		return "";
	})();

	const initials = name
		.replace(/\(.*?\)/g, "")
		.trim()
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map(n => n.charAt(0).toUpperCase())
		.join("");

	// Determine text size based on className
	const getTextSize = (className?: string) => {
		if (className?.includes('w-[50px]') || className?.includes('h-[50px]') || className?.includes('w-12') || className?.includes('h-12')) {
			return 'text-lg';
		}
		if (className?.includes('w-10') || className?.includes('h-10')) {
			return 'text-sm';
		}
		if (className?.includes('w-[40px]') || className?.includes('h-[40px]')) {
			return 'text-base';
		}
		if (className?.includes('w-[30px]') || className?.includes('h-[30px]')) {
			return 'text-sm';
		}
		return 'text-xs'; // default for 15px
	};

	if (parentBg) {
		return (
			<span
				className={twMerge(
					"relative z-[1] font-semibold text-white",
					getTextSize(className),
					className,
				)}
			>
				{initials}
			</span>
		);
	}

	return (
		<div
			className={twMerge(
				`flex items-center justify-center rounded-full text-white font-semibold ${getTextSize(className)} w-[15px] h-[15px]`,
				className,
			)}
			style={{ backgroundColor: bg }}
		>
			{initials}
		</div>
	);
}
