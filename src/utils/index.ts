import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines and merges Tailwind CSS class names with conditional logic.
 * @example
 * cn("bg-white", isActive && "text-black", "px-4") → "bg-white text-black px-4"
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(...inputs));
}

/**
 * Validates email format using regex pattern.
 * @param email - The email string to validate
 * @returns true if email format is valid, false otherwise
 * @example
 * isValidEmail("user@example.com") → true
 * isValidEmail("invalid-email") → false
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}
