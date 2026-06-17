"use client";

import { useEffect, useRef, useState } from "react";

type UseLazyInViewportOptions = {
	root?: Element | null;
	rootMargin?: string;
	/** Reset visibility tracking when this key changes (e.g. fileUrl). */
	resetKey?: string;
	/** When true, inView flips false when the element leaves the viewport (releases media). */
	releaseOnExit?: boolean;
};

/**
 * Tracks whether an element is inside the scroll root viewport.
 * Default: fires once when entering (legacy lazy load).
 * With releaseOnExit: toggles on enter/leave so media can unload off-screen.
 */
export function useLazyInViewport(options?: UseLazyInViewportOptions) {
	const {
		root = null,
		rootMargin = "80px",
		resetKey,
		releaseOnExit = false,
	} = options ?? {};
	const elementRef = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		setInView(false);
	}, [resetKey]);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		if (!releaseOnExit && inView) {
			return;
		}

		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (!entry) return;

				if (releaseOnExit) {
					setInView(entry.isIntersecting);
					return;
				}

				if (entry.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ root, rootMargin, threshold: 0.01 }
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [root, rootMargin, inView, resetKey, releaseOnExit]);

	return { elementRef, inView };
}
