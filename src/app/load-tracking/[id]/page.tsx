import CustomerLoadTrackingPageClient from "./CustomerLoadTrackingPageClient";

export const metadata = {
	title: "Shipment tracking",
	robots: { index: false, follow: false },
};

interface CustomerLoadTrackingPageProps {
	params: Promise<{ id: string }>;
}

export default async function CustomerLoadTrackingPage({
	params,
}: CustomerLoadTrackingPageProps) {
	const { id } = await params;

	return (
		<main className="relative h-screen w-full overflow-hidden">
			<CustomerLoadTrackingPageClient token={id} />
		</main>
	);
}
