import CheckListDriverDevicesTable from "./CheckListDriverDevicesTable";
import { buildCheckListVersionPushDefaultMessage } from "./CheckListPushModal";

export default function CheckListVersionTable() {
	return (
		<CheckListDriverDevicesTable
			apiPath="/api/users/drivers/check-list/version"
			queryKey="drivers-check-list-version"
			getEmptyMessage={minimumAppVersion =>
				!minimumAppVersion
					? "Minimum app version is not configured in App settings."
					: "No drivers match the criteria"
			}
			getPushDefaultMessage={minimumAppVersion =>
				buildCheckListVersionPushDefaultMessage(minimumAppVersion)
			}
		/>
	);
}
