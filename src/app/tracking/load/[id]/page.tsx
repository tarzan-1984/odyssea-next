import TrackingPageWrapper from "../../[id]/TrackingPageWrapper";
import TrackingLoadPageClient from "./TrackingLoadPageClient";

export const metadata = {
	title: "Odysseia Web",
};

interface PublicLoadTrackingPageProps {
	params: Promise<{ id: string }>;
}

export default async function PublicLoadTrackingPage({
	params,
}: PublicLoadTrackingPageProps) {
	const { id } = await params;

	return (
		<TrackingPageWrapper>
			<TrackingLoadPageClient loadId={id} />
		</TrackingPageWrapper>
	);
}
