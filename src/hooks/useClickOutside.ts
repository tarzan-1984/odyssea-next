"use client";

import React, { useEffect } from "react";

/**
 * useClickOutside
 *
 * A custom React hook that triggers a callback when a click occurs outside the specified element.
 *
 * @param {React.RefObject<HTMLElement | null>} ref - A reference to the HTML element to detect outside clicks on.
 * @param {() => void} callback - The function to call when an outside click is detected.
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside(ref, () => {
 *   setIsDropdownOpen(false);
 * });
 */
export const useClickOutside = (ref: React.RefObject<HTMLElement | null>, callback: () => void) => {
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				callback();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [ref, callback]);
};
