/**
 * Leaflet raster basemap.
 *
 * MapTiler (paid) is opt-in via `useMapTiler: true` — only /tracking/load/[id].
 * All other maps use CARTO Voyager (free, no key).
 *
 * - simple: streets map (roads, labels)
 * - hybrid: satellite + semi-transparent streets-v4 (POI / business names)
 */

export type MapTileLayerOptions = {
	/** When true and API key is set, use MapTiler; otherwise always CARTO Voyager. */
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

export function isMapTilerConfigured(): boolean {
	return Boolean(process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim());
}

/** CARTO Voyager — same basemap used when no MapTiler key is configured. */
export function getCartoVoyagerTileLayerProps(): LeafletRasterTileLayerProps {
	return {
		url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: ["a", "b", "c", "d"],
		maxZoom: 20,
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
	const useMapTiler = options?.useMapTiler === true;
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
	return getCartoVoyagerTileLayerProps();
}

/** Normalizes single- or multi-layer config to an array. */
export function getLeafletRasterTileLayerStack(
	mode: MapBasemapMode = "simple",
	options?: MapTileLayerOptions
): LeafletRasterTileLayerProps[] {
	const layers = getLeafletRasterTileLayerProps(mode, options);
	return Array.isArray(layers) ? layers : [layers];
}
