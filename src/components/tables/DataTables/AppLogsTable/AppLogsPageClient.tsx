"use client";

import { useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import AppLogsTable from "./AppLogsTable";
import DriversLogsTable from "./DriversLogsTable";

type AppLogsTab = "load-chats-logs" | "drivers-logs";

export default function AppLogsPageClient() {
	const [activeTab, setActiveTab] = useState<AppLogsTab>("load-chats-logs");

	return (
		<ComponentCard
			title="App Logs"
			headerRight={
				<>
					<Button
						type="button"
						size="sm"
						variant={activeTab === "load-chats-logs" ? "primary" : "outline"}
						className="h-9 whitespace-nowrap"
						onClick={() => setActiveTab("load-chats-logs")}
					>
						Load chats logs
					</Button>
					<Button
						type="button"
						size="sm"
						variant={activeTab === "drivers-logs" ? "primary" : "outline"}
						className="h-9 whitespace-nowrap"
						onClick={() => setActiveTab("drivers-logs")}
					>
						Drivers logs
					</Button>
				</>
			}
		>
			{activeTab === "load-chats-logs" ? (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Audit log of LOAD chat create/update events from web and TMS. Sorted by created at
						(newest first).
					</p>
					<AppLogsTable />
				</>
			) : (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Audit log of driver profile / status changes. Sorted by created at (newest first).
						Search filters by driver id.
					</p>
					<DriversLogsTable />
				</>
			)}
		</ComponentCard>
	);
}
