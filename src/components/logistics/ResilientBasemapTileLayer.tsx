"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	getCartoVoyagerTileLayerProps,
	getLeafletRasterTileLayerStack,
	isMapTilerConfigured,
	type MapBasemapMode,
	type LeafletRasterTileLayerProps,
} from "@/lib/mapTileLayer";

const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), {
	ssr: false,
});

/** Switch to CARTO after this many tile errors in the error window (quota / 403 overlay tiles). */
const TILE_ERROR_FALLBACK_COUNT = 5;
const TILE_ERROR_WINDOW_MS = 2500;

type ResilientBasemapTileLayerProps = {
	mode: MapBasemapMode;
	/** MapTiler only when true (e.g. /tracking/load/[id]); default is free CARTO. */
	useMapTilerBasemap?: boolean;
	onFallback?: () => void;
};

export function ResilientBasemapTileLayer({
	mode,
	useMapTilerBasemap = false,
	onFallback,
}: ResilientBasemapTileLayerProps) {
	const mapTilerConfigured = useMapTilerBasemap && isMapTilerConfigured();
	const [useCartoFallback, setUseCartoFallback] = useState(false);
	const errorCountRef = useRef(0);
	const errorWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const tileStack = useMemo((): LeafletRasterTileLayerProps[] => {
		if (!mapTilerConfigured || useCartoFallback) {
			return [getCartoVoyagerTileLayerProps()];
		}
		return getLeafletRasterTileLayerStack(mode, { useMapTiler: true });
	}, [mapTilerConfigured, useCartoFallback, mode]);

	const activateFallback = useCallback(() => {
		if (useCartoFallback || !mapTilerConfigured) return;
		setUseCartoFallback(true);
		onFallback?.();
	}, [useCartoFallback, mapTilerConfigured, onFallback]);

	const handleTileError = useCallback(() => {
		if (useCartoFallback || !mapTilerConfigured) return;

		errorCountRef.current += 1;
		if (!errorWindowTimerRef.current) {
			errorWindowTimerRef.current = setTimeout(() => {
				errorCountRef.current = 0;
				errorWindowTimerRef.current = null;
			}, TILE_ERROR_WINDOW_MS);
		}

		if (errorCountRef.current >= TILE_ERROR_FALLBACK_COUNT) {
			if (errorWindowTimerRef.current) {
				clearTimeout(errorWindowTimerRef.current);
				errorWindowTimerRef.current = null;
			}
			errorCountRef.current = 0;
			activateFallback();
		}
	}, [useCartoFallback, mapTilerConfigured, activateFallback]);

	const layerKey = useCartoFallback ? "carto-fallback" : `maptiler-${mode}`;

	return (
		<>
			{tileStack.map((tiles, index) => (
				<TileLayer
					key={`${layerKey}-${index}`}
					attribution={index === tileStack.length - 1 ? tiles.attribution : undefined}
					url={tiles.url}
					{...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
					maxZoom={tiles.maxZoom}
					{...(tiles.opacity != null ? { opacity: tiles.opacity } : {})}
					eventHandlers={{ tileerror: handleTileError }}
				/>
			))}
		</>
	);
}
