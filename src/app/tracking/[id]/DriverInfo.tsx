"use client";

import { getStatusLabelForFilter } from "@/components/logistics/driversMapConstants";

interface DriverData {
	firstName: string;
	lastName: string;
	phone: string;
	profilePhoto: string | null;
	driverStatus: string | null;
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

	const driverStatusLabel = getStatusLabelForFilter(driverData.driverStatus);

	return (
		<div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 px-6 py-4">
			<div className="flex items-start gap-6">
				{/* Avatar + Name */}
				<div className="flex flex-col items-center shrink-0">
					<div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden mb-2">
						{driverData.profilePhoto ? (
							<img
								src={driverData.profilePhoto}
								alt={fullName}
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-xl font-semibold text-slate-600 dark:text-gray-300">
								{initials}
							</span>
						)}
					</div>
					<p className="text-sm font-medium text-slate-900 dark:text-white text-center">
						{fullName}
					</p>
				</div>

				{/* Details grid (4 columns) */}
				<div className="grid grid-cols-4 gap-x-8 gap-y-3 flex-1 min-w-0">
					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Phone</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white break-words">
							{driverData.phone || "N/A"}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">State</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white">
							{driverData.state || "N/A"}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Coordinates</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white break-words">
							{coordinates}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Last Update</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white">
							{formatLastUpdate(driverData.lastLocationUpdateAt)}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">City</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white">
							{driverData.city || "N/A"}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">ZIP</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white">
							{driverData.zip || "N/A"}
						</p>
					</div>

					<div>
						<p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Status</p>
						<p className="text-sm font-medium text-slate-900 dark:text-white">
							{driverStatusLabel}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
