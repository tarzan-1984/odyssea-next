import UserListTable from "@/components/tables/DataTables/UserListTable/UserListTable";
import ComponentCard from "@/components/common/ComponentCard";
import React from "react";

export default function userListPage() {
	return (
		<ComponentCard title="User List">
			<UserListTable />
		</ComponentCard>
	);
}
