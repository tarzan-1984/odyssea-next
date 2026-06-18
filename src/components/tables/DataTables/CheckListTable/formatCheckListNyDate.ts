const NY_TZ = "America/New_York";

export function formatCheckListNyDate(
	isoOrNyWall: string | null | undefined,
): string {
	if (!isoOrNyWall) return "—";
	try {
		const raw = isoOrNyWall.trim();
		const hasT = raw.includes("T");
		const d = hasT ? new Date(raw) : new Date(raw.replace(" ", "T"));
		if (Number.isNaN(d.getTime())) return raw;
		return new Intl.DateTimeFormat("en-US", {
			timeZone: NY_TZ,
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		}).format(d);
	} catch {
		return isoOrNyWall;
	}
}
