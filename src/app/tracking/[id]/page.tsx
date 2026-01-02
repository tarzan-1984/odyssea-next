import TrackingPageClient from "./TrackingPageClient";
import TrackingPageWrapper from "./TrackingPageWrapper";

export const metadata = {
	title: "Odysseia Web",
};

interface PublicTrackingPageProps {
	params: Promise<{ id: string }>;
}

export default async function PublicTrackingPage({ params }: PublicTrackingPageProps) {
	const { id } = await params;

	return (
		<TrackingPageWrapper>
			<TrackingPageClient driverId={id} />
		</TrackingPageWrapper>
	);
}
