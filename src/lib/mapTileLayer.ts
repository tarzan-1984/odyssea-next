/**
 * Leaflet raster basemap: MapTiler streets-v4 if NEXT_PUBLIC_MAPTILER_API_KEY is set,
 * else CARTO Voyager (no key).
 */

const MAPTILER_STYLE = "streets-v4";

export type LeafletRasterTileLayerProps = {
	url: string;
	attribution: string;
	subdomains?: string[];
	maxZoom: number;
};

export function getLeafletRasterTileLayerProps(): LeafletRasterTileLayerProps {
	const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim() ?? "";
	if (key) {
		return {
			url: `https://api.maptiler.com/maps/${MAPTILER_STYLE}/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`,
			attribution:
				'&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 22,
		};
	}
	return {
		url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: ["a", "b", "c", "d"],
		maxZoom: 20,
	};
}
