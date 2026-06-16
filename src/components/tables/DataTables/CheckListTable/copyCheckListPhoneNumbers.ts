import type { SystemToastData } from "@/components/notifications/SystemToastNotification";

export function joinDriverPhoneNumbers(
	phones: Array<string | null | undefined>,
): string {
	return phones
		.map(phone => phone?.trim())
		.filter((phone): phone is string => Boolean(phone))
		.join(", ");
}

function showPhoneNumbersCopiedToast(count: number): void {
	const addSystemToast = (
		window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void }
	).addSystemToastNotification;

	if (typeof addSystemToast !== "function") return;

	addSystemToast({
		id: `check-list-copy-phones-${Date.now()}`,
		title: "Check list",
		message:
			count === 1
				? "Phone number copied to clipboard."
				: `${count} phone numbers copied to clipboard.`,
		variant: "success",
	});
}

export async function copyDriverPhoneNumbers(
	phones: Array<string | null | undefined>,
): Promise<boolean> {
	const numbers = phones
		.map(phone => phone?.trim())
		.filter((phone): phone is string => Boolean(phone));

	if (numbers.length === 0) return false;

	await navigator.clipboard.writeText(numbers.join(", "));
	showPhoneNumbersCopiedToast(numbers.length);
	return true;
}
