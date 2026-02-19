"use client";

import ComponentCard from "@/components/common/ComponentCard";
import React from "react";
import OffersList from "@/components/OffersList/OffersList";

const Offers = () => {
	return (
		<ComponentCard title="My Offers">
			<OffersList />
		</ComponentCard>
	);
};

export default Offers;
