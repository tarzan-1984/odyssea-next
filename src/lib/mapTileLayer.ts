/**
 * Leaflet raster basemap.
 *
 * Paid MapTiler is production-only so local `next dev` does not consume quota,
 * even if NEXT_PUBLIC_MAPTILER_API_KEY is present in .env.
 *
 * - production: streets-v4 / hybrid satellite (MapTiler)
 * - development: free OSM streets; Hybrid is disabled
 */

export type MapTileLayerOptions = {
	/** When true, use MapTiler in production if the API key is set. */
	useMapTiler?: boolean;
};

export type MapBasemapMode = "simple" | "hybrid";

const MAPTILER_SIMPLE_STYLE = "streets-v4";
const MAPTILER_SATELLITE_STYLE = "satellite";

/** Streets overlay opacity on satellite — keeps imagery visible while showing POI labels. */
const HYBRID_STREETS_OVERLAY_OPACITY = 0.58;

export type LeafletRasterTileLayerProps = {
	url: string;
	attribution: string;
	subdomains?: string[];
	maxZoom: number;
	opacity?: number;
};

export function hasMapTilerApiKey(): boolean {
	return Boolean(process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim());
}

/** True only in production builds with a MapTiler key (never during local next dev). */
export function isPaidMapTilerEnabled(): boolean {
	return process.env.NODE_ENV === "production" && hasMapTilerApiKey();
}

/** Paid MapTiler is available for this build. */
export function isMapTilerConfigured(): boolean {
	return isPaidMapTilerEnabled();
}

/** Free OSM streets — used in local development and if MapTiler is unavailable. */
export function getFreeStreetTileLayerProps(): LeafletRasterTileLayerProps {
	return {
		url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		subdomains: ["a", "b", "c"],
		maxZoom: 19,
	};
}

function mapTilerAttribution(): string {
	return '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}

function mapTilerRasterUrl(styleId: string, key: string, format: "png" | "jpg" = "png"): string {
	return `https://api.maptiler.com/maps/${styleId}/{z}/{x}/{y}.${format}?key=${encodeURIComponent(key)}`;
}

/** One or more Leaflet raster layers (hybrid = satellite + streets overlay). */
export function getLeafletRasterTileLayerProps(
	mode: MapBasemapMode = "simple",
	options?: MapTileLayerOptions
): LeafletRasterTileLayerProps | LeafletRasterTileLayerProps[] {
	const useMapTiler = options?.useMapTiler === true && isPaidMapTilerEnabled();
	const key = useMapTiler ? (process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ?? "") : "";
	if (key) {
		const attribution = mapTilerAttribution();
		if (mode === "hybrid") {
			return [
				{
					url: mapTilerRasterUrl(MAPTILER_SATELLITE_STYLE, key, "jpg"),
					attribution,
					maxZoom: 22,
				},
				{
					url: mapTilerRasterUrl(MAPTILER_SIMPLE_STYLE, key, "png"),
					attribution,
					maxZoom: 22,
					opacity: HYBRID_STREETS_OVERLAY_OPACITY,
				},
			];
		}
		return {
			url: mapTilerRasterUrl(MAPTILER_SIMPLE_STYLE, key, "png"),
			attribution,
			maxZoom: 22,
		};
	}
	return getFreeStreetTileLayerProps();
}

/** Normalizes single- or multi-layer config to an array. */
export function getLeafletRasterTileLayerStack(
	mode: MapBasemapMode = "simple",
	options?: MapTileLayerOptions
): LeafletRasterTileLayerProps[] {
	const layers = getLeafletRasterTileLayerProps(mode, options);
	return Array.isArray(layers) ? layers : [layers];
}
