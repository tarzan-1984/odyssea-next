"use client";

import { useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import CheckListTable from "./CheckListTable";
import CheckListVersionTable from "./CheckListVersionTable";
import CheckListSeveralDevicesTable from "./CheckListSeveralDevicesTable";

type CheckListTab = "location" | "version" | "several-devices";

export default function CheckListPageClient() {
	const [activeTab, setActiveTab] = useState<CheckListTab>("location");

	return (
		<ComponentCard
			title="Check list"
			headerRight={
				<>
					<Button
						type="button"
						size="sm"
						variant={activeTab === "location" ? "primary" : "outline"}
						className="h-9 whitespace-nowrap"
						onClick={() => setActiveTab("location")}
					>
						Check update location
					</Button>
					<Button
						type="button"
						size="sm"
						variant={activeTab === "version" ? "primary" : "outline"}
						className="h-9 whitespace-nowrap"
						onClick={() => setActiveTab("version")}
					>
						Check Update Version
					</Button>
					<Button
						type="button"
						size="sm"
						variant={activeTab === "several-devices" ? "primary" : "outline"}
						className="h-9 whitespace-nowrap"
						onClick={() => setActiveTab("several-devices")}
					>
						Several devices
					</Button>
				</>
			}
		>
			{activeTab === "location" ? (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						ACTIVE drivers (loaded en route or available) whose last location update is older than 3
						hours. Default sort is oldest location first; use the &quot;Last location update&quot;
						column header to toggle. Timestamps use America/New_York wall time in YYYY-MM-DD HH:mm:ss
						form.
					</p>
					<CheckListTable />
				</>
			) : activeTab === "version" ? (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						ACTIVE drivers with at least one device whose app version is below the minimum
						required version configured in App settings. All devices for matching drivers are shown.
						Default sort is oldest app version first; use the &quot;App Version&quot; column header
						to toggle. Search by name, driver ID, or email.
					</p>
					<CheckListVersionTable />
				</>
			) : (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						ACTIVE drivers with two or more devices on one account. All devices for matching
						drivers are shown. Default sort is oldest app version first; use the &quot;App
						Version&quot; column header to toggle. Search by name, driver ID, or email.
					</p>
					<CheckListSeveralDevicesTable />
				</>
			)}
		</ComponentCard>
	);
}
