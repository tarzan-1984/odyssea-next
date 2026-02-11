import ComponentCard from "@/components/common/ComponentCard";
import React from "react";
import DriversListTable from "@/components/tables/DataTables/DriversTable/DriversListTable";

const driversList = () => {
	return (
		<ComponentCard title="Driver List">
			<DriversListTable />
		</ComponentCard>
	);
};

export default driversList;
