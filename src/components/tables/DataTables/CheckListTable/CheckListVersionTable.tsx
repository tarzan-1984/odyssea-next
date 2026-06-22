import CheckListDriverDevicesTable from "./CheckListDriverDevicesTable";
import { buildCheckListVersionPushDefaultMessage } from "./CheckListPushModal";
import { CHECK_LIST_VERSION_EMAIL_DEFAULT_MESSAGE } from "./CheckListEmailModal";

export default function CheckListVersionTable() {
	return (
		<CheckListDriverDevicesTable
			apiPath="/api/users/drivers/check-list/version"
			queryKey="drivers-check-list-version"
			showMinimumAppVersion
			getEmptyMessage={minimumAppVersion =>
				!minimumAppVersion
					? "Minimum app version is not configured in App settings."
					: "No drivers match the criteria"
			}
			getPushDefaultMessage={minimumAppVersion =>
				buildCheckListVersionPushDefaultMessage(minimumAppVersion)
			}
			getEmailDefaultMessage={() => CHECK_LIST_VERSION_EMAIL_DEFAULT_MESSAGE}
		/>
	);
}
