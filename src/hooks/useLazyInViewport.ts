"use client";

import { useEffect, useRef, useState } from "react";

type UseLazyInViewportOptions = {
	root?: Element | null;
	rootMargin?: string;
	/** Reset visibility tracking when this key changes (e.g. fileUrl). */
	resetKey?: string;
};

/**
 * Fires once when the element enters the scroll root viewport (or browser viewport if root is null).
 */
export function useLazyInViewport(options?: UseLazyInViewportOptions) {
	const { root = null, rootMargin = "80px", resetKey } = options ?? {};
	const elementRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(false);

	// Re-check only when the file changes. Resetting on scrollRoot attach unmounted in-flight
	// images and left previews stuck on "Loading image..." (cached img skips onLoad).
	useEffect(() => {
		setInView(false);
	}, [resetKey]);

	useEffect(() => {
		if (inView) return;

		const element = elementRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ root, rootMargin, threshold: 0.01 }
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [root, rootMargin, inView, resetKey]);

	return { elementRef, inView };
}
