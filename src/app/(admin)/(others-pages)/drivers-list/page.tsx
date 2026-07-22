import ComponentCard from "@/components/common/ComponentCard";
import React, { Suspense } from "react";
import DriversListTable from "@/components/tables/DataTables/DriversTable/DriversListTable";

const driversList = () => {
	return (
		<ComponentCard title="Driver List">
			<Suspense fallback={null}>
				<DriversListTable />
			</Suspense>
		</ComponentCard>
	);
};

export default driversList;
