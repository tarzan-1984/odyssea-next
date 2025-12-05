"use client";

import { useState } from "react";
import TrackingMapClient from "./TrackingMapClient";
import DriverInfo from "./DriverInfo";

interface DriverData {
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  lastLocationUpdateAt: string | null;
}

interface TrackingPageClientProps {
  driverId: string;
}

export default function TrackingPageClient({ driverId }: TrackingPageClientProps) {
  const [driverData, setDriverData] = useState<DriverData | null>(null);

  return (
    <>
      {/* Map takes full screen */}
      <section className="absolute inset-0 w-full h-full">
        <TrackingMapClient
          driverId={driverId}
          onDriverDataChange={setDriverData}
        />
      </section>

      {/* Driver info overlay - centered at bottom with white background */}
      <div className="absolute bottom-[25px] left-1/2 transform -translate-x-1/2 z-[1000]">
        <DriverInfo driverData={driverData} />
      </div>
    </>
  );
}

