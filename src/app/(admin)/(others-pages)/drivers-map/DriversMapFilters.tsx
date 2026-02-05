import {
	useState,
	useEffect,
	useRef,
	useCallback,
	type Dispatch,
	type SetStateAction,
} from "react";
import { DRIVER_STATUS_LABELS } from "@/components/logistics/driversMapConstants";

const ADDRESS_DEBOUNCE_MS = 400;

interface DriversMapFiltersProps {
	driverStatusFilter: string;
	setDriverStatusFilter: Dispatch<SetStateAction<string>>;
	driverStatusOptions: string[];
	zipFilter: string;
	setZipFilter: Dispatch<SetStateAction<string>>;
	onFilterApply?: (params: {
		latitude: number;
		longitude: number;
		radiusMiles: number;
	}) => void;
	onRadiusChange?: (radiusMiles: number) => void;
	onClearFilter?: () => void;
	onReset?: () => void;
}

export function DriversMapFilters({
	driverStatusFilter,
	setDriverStatusFilter,
	driverStatusOptions,
	zipFilter,
	setZipFilter,
	onFilterApply,
	onRadiusChange,
	onClearFilter,
	onReset,
}: DriversMapFiltersProps) {
	const [location, setLocation] = useState<"USA" | "Canada">("USA");
	const [radius, setRadius] = useState<string>("500");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastGeocodeRef = useRef<string>("");

	// Simple geocoding using OpenStreetMap Nominatim API.
	// Appending country to the query helps resolve short inputs (e.g. state codes OH, CA, TX).
	async function geocodeAddress(address: string, country: "USA" | "Canada") {
		const countryLabel = country === "USA" ? "USA" : "Canada";
		const query = address.includes(countryLabel) ? address : `${address}, ${countryLabel}`;

		const params = new URLSearchParams({
			q: query,
			format: "json",
			limit: "1",
			addressdetails: "1",
		});

		const countryCode = country === "USA" ? "us" : "ca";
		params.set("countrycodes", countryCode);

		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?${params.toString()}`,
			{
				headers: {
					"Accept-Language": "en",
				},
			}
		);

		if (!response.ok) {
			throw new Error("Failed to geocode address");
		}

		const data = (await response.json()) as Array<{
			lat: string;
			lon: string;
		}>;

		if (!Array.isArray(data) || data.length === 0) {
			return null;
		}

		return {
			latitude: Number.parseFloat(data[0].lat),
			longitude: Number.parseFloat(data[0].lon),
		};
	}

	const runGeocodeAndApply = useCallback(
		async (address: string, loc: "USA" | "Canada", radiusMiles: number) => {
			const key = `${address}|${loc}`;
			if (lastGeocodeRef.current === key) return;
			lastGeocodeRef.current = key;
			try {
				const coords = await geocodeAddress(address, loc);
				if (coords && onFilterApply) {
					onFilterApply({
						latitude: coords.latitude,
						longitude: coords.longitude,
						radiusMiles,
					});
				}
			} catch {
				lastGeocodeRef.current = "";
				onClearFilter?.();
			}
		},
		[onFilterApply, onClearFilter]
	);

	// Auto-filter when address or location changes (debounced for address)
	useEffect(() => {
		const trimmed = zipFilter.trim();
		if (!trimmed) {
			lastGeocodeRef.current = "";
			onClearFilter?.();
			return;
		}

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null;
			const miles = Number.parseInt(radius, 10) || 500;
			runGeocodeAndApply(trimmed, location, miles);
		}, ADDRESS_DEBOUNCE_MS);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [zipFilter, location, radius, runGeocodeAndApply]);

	// When only radius changes (address not empty), update radius in parent
	useEffect(() => {
		if (!zipFilter.trim()) return;
		const miles = Number.parseInt(radius, 10);
		if (Number.isNaN(miles)) return;
		onRadiusChange?.(miles);
	}, [radius, zipFilter, onRadiusChange]);

	const handleResetClick = () => {
		setDriverStatusFilter("all");
		setZipFilter("");
		setLocation("USA");
		setRadius("500");
		lastGeocodeRef.current = "";
		onReset?.();
	};

	return (
		<div className="grid grid-cols-2 gap-2 sm:gap-3 md:flex md:flex-wrap md:items-end md:gap-3">
			<div className="flex min-w-0 flex-col gap-1">
				<label
					htmlFor="driver-status-filter"
					className="text-xs font-medium text-gray-700 dark:text-gray-300"
				>
					Status
				</label>
				<select
					id="driver-status-filter"
					value={driverStatusFilter}
					onChange={(e) => setDriverStatusFilter(e.target.value)}
					className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 md:min-w-[160px] md:w-auto"
				>
					<option value="all">{DRIVER_STATUS_LABELS.all}</option>
					{driverStatusOptions.map((status) => (
						<option key={status} value={status}>
							{DRIVER_STATUS_LABELS[status.toLowerCase()] ?? status}
						</option>
					))}
				</select>
			</div>

			<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

			<div className="flex min-w-0 flex-col gap-1">
				<label
					htmlFor="address-filter"
					className="text-xs font-medium text-gray-700 dark:text-gray-300"
				>
					Address
				</label>
				<input
					id="address-filter"
					type="text"
					value={zipFilter}
					onChange={(e) => setZipFilter(e.target.value)}
					placeholder="Enter address"
					className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 md:w-40"
				/>
			</div>

			<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

			<div className="flex min-w-0 flex-col gap-1">
				<label
					htmlFor="location-filter"
					className="text-xs font-medium text-gray-700 dark:text-gray-300"
				>
					Location
				</label>
				<select
					id="location-filter"
					value={location}
					onChange={(e) =>
						setLocation(e.target.value === "Canada" ? "Canada" : "USA")
					}
					className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 md:min-w-[140px] md:w-auto"
				>
					<option value="USA">USA</option>
					<option value="Canada">Canada</option>
				</select>
			</div>

			<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

			<div className="flex min-w-0 flex-col gap-1">
				<label
					htmlFor="radius-filter"
					className="text-xs font-medium text-gray-700 dark:text-gray-300"
				>
					Radius
				</label>
				<select
					id="radius-filter"
					value={radius}
					onChange={(e) => setRadius(e.target.value)}
					className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 md:min-w-[140px] md:w-auto"
				>
					<option value="50">50 miles</option>
					<option value="100">100 miles</option>
					<option value="150">150 miles</option>
					<option value="200">200 miles</option>
					<option value="250">250 miles</option>
					<option value="300">300 miles</option>
					<option value="400">400 miles</option>
					<option value="500">500 miles</option>
					<option value="600">600 miles</option>
					<option value="800">800 miles</option>
					<option value="1000">1000 miles</option>
				</select>
			</div>

			<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

			<div className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
				{/* Invisible label so button aligns with other fields (same label + control height) */}
				<label className="text-xs font-medium text-transparent select-none">
					Reset
				</label>
				<button
					type="button"
					onClick={handleResetClick}
					className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 md:w-auto"
				>
					Reset
				</button>
			</div>
		</div>
	);
}

