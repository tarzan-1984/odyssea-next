"use client";

import { useEffect, useState } from "react";
import { driverUsesMobileAppFromLastActive } from "@/components/tables/DataTables/DriversTable/DriverMobileAppIcon";
import { clientAuth } from "@/utils/auth";
import { pickLastActiveApp } from "@/utils/trackingLoadDriver";

/** Enrichment may omit `lastActiveApp`; fall back to users API by externalId. */
export function useResolvedDriverLastActiveApp(
	externalId: string | null | undefined,
	lastActiveApp: string | null | undefined
) {
	const [resolvedLastActiveApp, setResolvedLastActiveApp] = useState<string | null>(
		lastActiveApp ?? null
	);

	useEffect(() => {
		setResolvedLastActiveApp(lastActiveApp ?? null);
	}, [lastActiveApp, externalId]);

	useEffect(() => {
		if (driverUsesMobileAppFromLastActive(lastActiveApp)) return;
		const id = externalId?.trim();
		if (!id || !clientAuth.isAuthenticated()) return;

		let cancelled = false;
		(async () => {
			try {
				const token = clientAuth.getAccessToken();
				if (!token) return;
				const res = await fetch(`/api/users/external/${encodeURIComponent(id)}`, {
					headers: { Authorization: `Bearer ${token}` },
					cache: "no-store",
				});
				if (!res.ok || cancelled) return;
				const json = await res.json();
				const user = (json?.data ?? json) as Record<string, unknown>;
				const picked = pickLastActiveApp(user);
				if (!cancelled && picked) {
					setResolvedLastActiveApp(picked);
				}
			} catch {
				// keep enrichment value
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [externalId, lastActiveApp]);

	const usesMobileApp = driverUsesMobileAppFromLastActive(resolvedLastActiveApp);

	return { resolvedLastActiveApp, usesMobileApp };
}
