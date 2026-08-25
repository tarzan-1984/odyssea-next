"use client";

import { useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import CheckListTable from "./CheckListTable";
import CheckListVersionTable from "./CheckListVersionTable";
import CheckListSeveralDevicesTable from "./CheckListSeveralDevicesTable";
import CheckListEmailModal, {
	CHECK_LIST_EMAIL_DEFAULT_SUBJECT,
} from "./CheckListEmailModal";
import CheckListPushModal from "./CheckListPushModal";
import MassEmailIcon from "./MassEmailIcon";
import MassPushIcon from "./MassPushIcon";
import CheckUpdateLocationIcon from "./CheckUpdateLocationIcon";
import CheckUpdateVersionIcon from "./CheckUpdateVersionIcon";
import SeveralDevicesIcon from "./SeveralDevicesIcon";
import { useCurrentUser } from "@/stores/userStore";
import { canAccessCheckListMassEmail } from "@/utils/roleAccess";

type CheckListTab = "location" | "version" | "several-devices";

export default function CheckListPageClient() {
	const [activeTab, setActiveTab] = useState<CheckListTab>("location");
	const [isMassEmailOpen, setIsMassEmailOpen] = useState(false);
	const [isMassPushOpen, setIsMassPushOpen] = useState(false);
	const currentUser = useCurrentUser();
	const showMassEmail = canAccessCheckListMassEmail(currentUser?.role);

	return (
		<>
			{showMassEmail && (
				<div className="mb-4 flex flex-wrap items-start gap-3 sm:gap-4">
					<div className="flex shrink-0 flex-col gap-2">
						<Button
							type="button"
							size="sm"
							className="h-9 w-full whitespace-nowrap !bg-success-500 hover:!bg-success-600 disabled:!bg-success-300"
							startIcon={<MassEmailIcon className="h-5 w-5" />}
							onClick={() => setIsMassEmailOpen(true)}
						>
							Mass email
						</Button>
						<Button
							type="button"
							size="sm"
							className="h-9 w-full whitespace-nowrap !bg-success-500 hover:!bg-success-600 disabled:!bg-success-300"
							startIcon={<MassPushIcon className="h-5 w-5" />}
							onClick={() => setIsMassPushOpen(true)}
						>
							Mass Push
						</Button>
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-gray-800 dark:text-white/90">
							Service updates & alerts
						</p>
						<p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							Receive important technical, operational, and organizational updates that may
							affect your work, including service disruptions, payment delays, maintenance, and
							other important notices.
						</p>
					</div>
				</div>
			)}
			<ComponentCard
				title="Check list"
				headerRight={
					<>
						<Button
							type="button"
							size="sm"
							variant={activeTab === "location" ? "primary" : "outline"}
							className="h-9 whitespace-nowrap"
							startIcon={<CheckUpdateLocationIcon className="h-5 w-5" />}
							onClick={() => setActiveTab("location")}
						>
							Check update location
						</Button>
						<Button
							type="button"
							size="sm"
							variant={activeTab === "version" ? "primary" : "outline"}
							className="h-9 whitespace-nowrap"
							startIcon={<CheckUpdateVersionIcon className="h-5 w-5" />}
							onClick={() => setActiveTab("version")}
						>
							Check Update Version
						</Button>
						<Button
							type="button"
							size="sm"
							variant={activeTab === "several-devices" ? "primary" : "outline"}
							className="h-9 whitespace-nowrap"
							startIcon={<SeveralDevicesIcon className="h-5 w-5" />}
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
							ACTIVE drivers with at least one device whose app version is below the latest allowed
							version (see below). All devices for matching drivers are shown. Default sort is oldest
							app version first; use the &quot;App Version&quot; column header to toggle. Search by
							name, driver U, or email.
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
			{showMassEmail && (
				<>
					<CheckListEmailModal
						isOpen={isMassEmailOpen}
						onClose={() => setIsMassEmailOpen(false)}
						drivers={[]}
						hideRecipients
						defaultSubject={CHECK_LIST_EMAIL_DEFAULT_SUBJECT}
						defaultMessage=""
					/>
					<CheckListPushModal
						isOpen={isMassPushOpen}
						onClose={() => setIsMassPushOpen(false)}
						drivers={[]}
						hideRecipients
						defaultMessage=""
					/>
				</>
			)}
		</>
	);
}
