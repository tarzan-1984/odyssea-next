/**
 * Leaflet raster basemap.
 *
 * MapTiler (paid) is opt-in via `useMapTiler: true` — only /tracking/load/[id].
 * All other maps use CARTO Voyager (free, no key).
 *
 * - simple: streets map (roads, labels)
 * - hybrid: satellite + labels (MapTiler only, when useMapTiler)
 */

export type MapTileLayerOptions = {
	/** When true and API key is set, use MapTiler; otherwise always CARTO Voyager. */
	useMapTiler?: boolean;
};

export type MapBasemapMode = "simple" | "hybrid";

const MAPTILER_STYLE_BY_MODE: Record<MapBasemapMode, string> = {
	simple: "streets-v4",
	hybrid: "hybrid",
};

export type LeafletRasterTileLayerProps = {
	url: string;
	attribution: string;
	subdomains?: string[];
	maxZoom: number;
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

export function getLeafletRasterTileLayerProps(
	mode: MapBasemapMode = "simple",
	options?: MapTileLayerOptions
): LeafletRasterTileLayerProps {
	const useMapTiler = options?.useMapTiler === true;
	const key = useMapTiler ? (process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ?? "") : "";
	if (key) {
		const styleId = MAPTILER_STYLE_BY_MODE[mode];
		return {
			url: `https://api.maptiler.com/maps/${styleId}/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`,
			attribution:
				'&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 22,
		};
	}
	return getCartoVoyagerTileLayerProps();
}
