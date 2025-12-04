"use client";

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

interface DriverInfoProps {
  driverData: DriverData | null;
}

export default function DriverInfo({ driverData }: DriverInfoProps) {
  if (!driverData) {
    return null;
  }

  // Get initials from first and last name
  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    return `${first}${last}` || "?";
  };

  const initials = getInitials(driverData.firstName, driverData.lastName);
  const fullName = `${driverData.firstName} ${driverData.lastName}`.trim();

  // Format coordinates
  const coordinates =
    driverData.latitude !== null && driverData.longitude !== null
      ? `${driverData.latitude.toFixed(6)}, ${driverData.longitude.toFixed(6)}`
      : "N/A";

  // Format last location update
  const formatLastUpdate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg px-6 py-4">
      <table className="w-full">
        <tbody>
          <tr>
            {/* First column: Avatar and Name */}
            <td className="align-top pr-6">
              <div className="flex flex-col items-center">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mb-2">
                  {driverData.profilePhoto ? (
                    <img
                      src={driverData.profilePhoto}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-semibold text-slate-600">
                      {initials}
                    </span>
                  )}
                </div>
                {/* Name */}
                <p className="text-sm font-medium text-slate-900 text-center">
                  {fullName}
                </p>
              </div>
            </td>

            {/* Other columns: Phone, City, State, Zip, Coordinates, Last Update */}
            <td className="align-top pr-6">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Phone</p>
                  <p className="text-sm font-medium text-slate-900">
                    {driverData.phone || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">City</p>
                  <p className="text-sm font-medium text-slate-900">
                    {driverData.city || "N/A"}
                  </p>
                </div>
              </div>
            </td>

            <td className="align-top pr-6">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">State</p>
                  <p className="text-sm font-medium text-slate-900">
                    {driverData.state || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">ZIP</p>
                  <p className="text-sm font-medium text-slate-900">
                    {driverData.zip || "N/A"}
                  </p>
                </div>
              </div>
            </td>

            <td className="align-top pr-6">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Coordinates</p>
                  <p className="text-sm font-medium text-slate-900">
                    {coordinates}
                  </p>
                </div>
              </div>
            </td>

            <td className="align-top">
              <div>
                <p className="text-xs text-slate-500 mb-1">Last Update</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatLastUpdate(driverData.lastLocationUpdateAt)}
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

