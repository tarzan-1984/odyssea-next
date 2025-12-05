import TrackingPageClient from "./TrackingPageClient";

export const metadata = {
  title: "Live Tracking",
};

interface PublicTrackingPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicTrackingPage({ params }: PublicTrackingPageProps) {
  const { id } = await params;

  return (
    <main className="h-screen w-full relative overflow-hidden">
      <TrackingPageClient driverId={id} />

      {/* Header overlay - centered at top with white background */}
      <header className="absolute top-0 left-1/2 transform -translate-x-1/2 z-[1000] mt-4 px-6 py-3 bg-white rounded-lg shadow-lg">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Live Tracking Delivery
          </h1>
          <p className="text-sm text-slate-500">
            Public map with real‑time location updates.
          </p>
        </div>
      </header>
    </main>
  );
}


