import Image from "next/image";
import { UserData, UserListItem } from "@/app-api/api-types";
import { twMerge } from "tailwind-merge";

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
export function renderAvatar(item?: UserData | UserListItem | null, className?: string) {
	if (!item) return <div className="w-10 h-10 bg-gray-300 rounded-full" />;

	if ("avatar" in item && item.avatar) {
		return (
			<Image
				width={40}
				height={40}
				src={item.avatar}
				alt="user"
				className={twMerge("rounded-full object-cover", className)}
			/>
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

	return (
		<div
			className={twMerge(
				"flex items-center justify-center rounded-full bg-[#465fff] text-white font-semibold text-lg w-10 h-10",
				className
			)}
		>
			{initials}
		</div>
	);
}
