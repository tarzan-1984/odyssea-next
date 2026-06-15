type CheckListPhoneLinkProps = {
	phone: string | null | undefined;
};

export default function CheckListPhoneLink({ phone }: CheckListPhoneLinkProps) {
	const value = phone?.trim();
	if (!value) return <>—</>;

	return (
		<a
			href={`tel:${value.replace(/\s/g, "")}`}
			className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
		>
			{value}
		</a>
	);
}
