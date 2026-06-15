"use client";

import CheckListDriverDevicesTable from "./CheckListDriverDevicesTable";
import { CHECK_LIST_PUSH_DEFAULT_MESSAGE } from "./CheckListPushModal";

export default function CheckListSeveralDevicesTable() {
	return (
		<CheckListDriverDevicesTable
			apiPath="/api/users/drivers/check-list/several-devices"
			queryKey="drivers-check-list-several-devices"
			getEmptyMessage={() => "No drivers match the criteria"}
			getPushDefaultMessage={() => CHECK_LIST_PUSH_DEFAULT_MESSAGE}
		/>
	);
}
