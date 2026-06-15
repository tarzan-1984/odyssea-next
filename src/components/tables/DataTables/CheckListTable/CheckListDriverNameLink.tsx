import {
	buildTmsDriverPageUrl,
	TMS_DRIVER_LOCATION_TAB,
} from "@/utils/tmsUrls";

type CheckListDriverNameLinkProps = {
	firstName: string;
	lastName: string;
	externalId: string | null;
};

export default function CheckListDriverNameLink({
	firstName,
	lastName,
	externalId,
}: CheckListDriverNameLinkProps) {
	const name = `${firstName} ${lastName}`.trim() || "—";
	const href = buildTmsDriverPageUrl(externalId, TMS_DRIVER_LOCATION_TAB);

	if (!href) {
		return <>{name}</>;
	}

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
		>
			{name}
		</a>
	);
}
