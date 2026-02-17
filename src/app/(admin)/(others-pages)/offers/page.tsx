"use client";

import ComponentCard from "@/components/common/ComponentCard";
import React from "react";
import OffersListTable from "@/components/tables/DataTables/OffersTable/OffersListTable";

const Offers = () => {
	return (
		<ComponentCard title="My Offers">
			<OffersListTable />
		</ComponentCard>
	);
};

export default Offers;
