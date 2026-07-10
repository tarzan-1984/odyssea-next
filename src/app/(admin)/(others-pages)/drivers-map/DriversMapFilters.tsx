import {
	useEffect,
	useRef,
	useCallback,
	type Dispatch,
	type SetStateAction,
} from "react";
import MultiSelect from "@/components/form/MultiSelect";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import { CAPABILITIES_OPTIONS } from "@/components/tables/DataTables/DriversTable/capabilitiesFilterOptions";
import MinDimensionsModal from "@/components/tables/DataTables/DriversTable/MinDimensionsModal";
import DimensionsFilterDisplay from "@/components/tables/DataTables/DriversTable/DimensionsFilterDisplay";
import type { DimensionsFilterValues } from "@/components/tables/DataTables/DriversTable/dimensionsFilterUtils";

const ADDRESS_DEBOUNCE_MS = 400;

interface DriversMapFiltersProps {
	extendedSearchEnabled: boolean;
	onExtendedSearchToggle: (enabled: boolean) => void;
	addressFilter: string;
	setAddressFilter: Dispatch<SetStateAction<string>>;
	extendedSearchFilter: string;
	setExtendedSearchFilter: Dispatch<SetStateAction<string>>;
	capabilitiesFilter: string[];
	setCapabilitiesFilter: Dispatch<SetStateAction<string[]>>;
	dimensionsFilter: DimensionsFilterValues;
	setDimensionsFilter: Dispatch<SetStateAction<DimensionsFilterValues>>;
	dimensionsModalOpen: boolean;
	setDimensionsModalOpen: Dispatch<SetStateAction<boolean>>;
	locationFilter: "USA" | "Canada";
	setLocationFilter: Dispatch<SetStateAction<"USA" | "Canada">>;
	radiusFilter: string;
	setRadiusFilter: Dispatch<SetStateAction<string>>;
	statusFilter: string;
	onStatusFilterChange: (value: string) => void;
	statusFilterOptions: { value: string; label: string }[];
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
	extendedSearchEnabled,
	onExtendedSearchToggle,
	addressFilter,
	setAddressFilter,
	extendedSearchFilter,
	setExtendedSearchFilter,
	capabilitiesFilter,
	setCapabilitiesFilter,
	dimensionsFilter,
	setDimensionsFilter,
	dimensionsModalOpen,
	setDimensionsModalOpen,
	locationFilter,
	setLocationFilter,
	radiusFilter,
	setRadiusFilter,
	statusFilter,
	onStatusFilterChange,
	statusFilterOptions,
	onFilterApply,
	onRadiusChange,
	onClearFilter,
	onReset,
}: DriversMapFiltersProps) {
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastGeocodeRef = useRef<string>("");

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

	useEffect(() => {
		if (extendedSearchEnabled) {
			lastGeocodeRef.current = "";
			onClearFilter?.();
			return;
		}

		const trimmed = addressFilter.trim();
		if (!trimmed) {
			lastGeocodeRef.current = "";
			onClearFilter?.();
			return;
		}

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null;
			const miles = Number.parseInt(radiusFilter, 10) || 500;
			runGeocodeAndApply(trimmed, locationFilter, miles);
		}, ADDRESS_DEBOUNCE_MS);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [
		addressFilter,
		locationFilter,
		radiusFilter,
		extendedSearchEnabled,
		runGeocodeAndApply,
		onClearFilter,
	]);

	useEffect(() => {
		if (extendedSearchEnabled || !addressFilter.trim()) return;
		const miles = Number.parseInt(radiusFilter, 10);
		if (Number.isNaN(miles)) return;
		onRadiusChange?.(miles);
	}, [radiusFilter, addressFilter, extendedSearchEnabled, onRadiusChange]);

	const handleResetClick = () => {
		onReset?.();
	};

	return (
		<div>
			<div className="mb-3">
				<Switch
					label="Extended search"
					checked={extendedSearchEnabled}
					onChange={onExtendedSearchToggle}
				/>
			</div>

			<div className="grid grid-cols-2 gap-2 sm:gap-3 md:flex md:flex-wrap md:items-end md:gap-3">
				<div className="flex min-w-0 flex-col">
					{extendedSearchEnabled ? (
						<>
							<Label htmlFor="drivers-map-extended-search">Search</Label>
							<input
								id="drivers-map-extended-search"
								name="extended_search"
								type="text"
								value={extendedSearchFilter}
								onChange={e => setExtendedSearchFilter(e.target.value)}
								placeholder="Unit/name/phone/vehicle"
								className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-white/30 md:w-40"
							/>
						</>
					) : (
						<>
							<Label htmlFor="drivers-map-address-filter">Address</Label>
							<input
								id="drivers-map-address-filter"
								type="text"
								value={addressFilter}
								onChange={e => setAddressFilter(e.target.value)}
								placeholder="Enter address"
								className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-white/30 md:w-40"
							/>
						</>
					)}
				</div>

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="flex min-w-0 flex-col md:min-w-[220px]">
					<MultiSelect
						label="Capabilities"
						options={CAPABILITIES_OPTIONS}
						defaultSelected={capabilitiesFilter}
						onChange={values => setCapabilitiesFilter(values)}
						triggerClassName="h-11"
						dropdownInPortal
					/>
				</div>

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="flex min-w-0 flex-col">
					<Label htmlFor="drivers-map-dimensions-filter">Dimensions</Label>
					<button
						id="drivers-map-dimensions-filter"
						type="button"
						onClick={() => setDimensionsModalOpen(true)}
						className="h-11 w-full min-w-0 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 md:w-40"
					>
						<DimensionsFilterDisplay values={dimensionsFilter} />
					</button>
				</div>

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="flex min-w-0 flex-col">
					<Label htmlFor="drivers-map-location-filter">Location</Label>
					<select
						id="drivers-map-location-filter"
						value={locationFilter}
						onChange={e =>
							setLocationFilter(e.target.value === "Canada" ? "Canada" : "USA")
						}
						className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[140px] md:w-auto"
					>
						<option value="USA">USA</option>
						<option value="Canada">Canada</option>
					</select>
				</div>

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="flex min-w-0 flex-col">
					<Label htmlFor="drivers-map-radius-filter">Radius</Label>
					<select
						id="drivers-map-radius-filter"
						value={radiusFilter}
						onChange={e => setRadiusFilter(e.target.value)}
						className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[140px] md:w-auto"
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

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="flex min-w-0 flex-col">
					<Label htmlFor="drivers-map-status-filter">Status</Label>
					<select
						id="drivers-map-status-filter"
						value={statusFilter}
						onChange={e => onStatusFilterChange(e.target.value)}
						className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[160px] md:w-auto"
					>
						{statusFilterOptions.map(opt => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

				<div className="col-span-2 flex min-w-0 flex-col md:col-span-1">
					<Label className="select-none text-transparent">{""}</Label>
					<button
						type="button"
						onClick={handleResetClick}
						className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:border-brand-800 md:w-auto"
					>
						Reset
					</button>
				</div>
			</div>

			<MinDimensionsModal
				isOpen={dimensionsModalOpen}
				onClose={() => setDimensionsModalOpen(false)}
				initialValues={dimensionsFilter}
				onApply={setDimensionsFilter}
			/>
		</div>
	);
}
