import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import NewsImageNodeView from "./NewsImageNodeView";

export const NEWS_IMAGE_ALIGN_CLASS_PREFIX = "news-image-align-";
export const NEWS_IMAGE_WIDTH_CLASS_PREFIX = "news-image-width-";
export const NEWS_IMAGE_WIDTH_DEFAULT_CLASS = "news-image-width-default";
export const NEWS_IMAGE_LINKED_CLASS = "news-image-linked";
export const NEWS_IMAGE_LINK_OVERLAY_CLASS = "news-image-link-overlay";

export const NEWS_IMAGE_WIDTH_OPTIONS = [25, 50, 75, 100] as const;
export type NewsImageWidthPercent = (typeof NEWS_IMAGE_WIDTH_OPTIONS)[number];
/** null = natural/default size (auto width, capped by container). */
export type NewsImageWidthValue = NewsImageWidthPercent | null;

export function isNewsImageWidthPercent(value: number): value is NewsImageWidthPercent {
	return (NEWS_IMAGE_WIDTH_OPTIONS as readonly number[]).includes(value);
}

export function normalizeNewsImageWidth(value: unknown): NewsImageWidthValue {
	if (typeof value === "number" && isNewsImageWidthPercent(value)) {
		return value;
	}
	return null;
}

export function newsImageAlignClass(
	textAlign: string | null | undefined,
): string | undefined {
	if (!textAlign || textAlign === "left") return undefined;
	return `${NEWS_IMAGE_ALIGN_CLASS_PREFIX}${textAlign}`;
}

export function newsImageWidthClass(
	widthPercent: NewsImageWidthValue | undefined,
): string {
	const normalized = normalizeNewsImageWidth(widthPercent);
	if (normalized == null) {
		return NEWS_IMAGE_WIDTH_DEFAULT_CLASS;
	}
	return `${NEWS_IMAGE_WIDTH_CLASS_PREFIX}${normalized}`;
}

export function newsImageClassNames(
	textAlign: string | null | undefined,
	widthPercent: NewsImageWidthValue | undefined,
): string | undefined {
	const classes = [
		newsImageAlignClass(textAlign),
		newsImageWidthClass(widthPercent),
	].filter(Boolean);

	return classes.length > 0 ? classes.join(" ") : undefined;
}

function readImageLayoutHost(element: HTMLElement): HTMLElement {
	const linkedWrapper = element.closest(`.${NEWS_IMAGE_LINKED_CLASS}`);
	return linkedWrapper instanceof HTMLElement ? linkedWrapper : element;
}

function readImageAlignFromElement(element: HTMLElement): string | null {
	const layoutHost = readImageLayoutHost(element);
	const fromStyle = layoutHost.style.textAlign;
	if (fromStyle && fromStyle !== "left") {
		return fromStyle;
	}

	for (const className of layoutHost.classList) {
		if (className.startsWith(NEWS_IMAGE_ALIGN_CLASS_PREFIX)) {
			return className.slice(NEWS_IMAGE_ALIGN_CLASS_PREFIX.length);
		}
	}

	return null;
}

function readImageWidthPercentFromElement(element: HTMLElement): NewsImageWidthValue {
	const layoutHost = readImageLayoutHost(element);
	if (layoutHost.classList.contains(NEWS_IMAGE_WIDTH_DEFAULT_CLASS)) {
		return null;
	}

	for (const className of layoutHost.classList) {
		if (className.startsWith(NEWS_IMAGE_WIDTH_CLASS_PREFIX)) {
			const suffix = className.slice(NEWS_IMAGE_WIDTH_CLASS_PREFIX.length);
			if (suffix === "default") {
				return null;
			}
			const parsed = Number.parseInt(suffix, 10);
			if (isNewsImageWidthPercent(parsed)) {
				return parsed;
			}
		}
	}

	const widthStyle = layoutHost.style.width;
	if (widthStyle.endsWith("%")) {
		const parsed = Number.parseInt(widthStyle, 10);
		if (isNewsImageWidthPercent(parsed)) {
			return parsed;
		}
	}

	// Legacy images without a width class keep natural size.
	return null;
}

function readImageHrefFromElement(element: HTMLElement): string | null {
	const linkedWrapper = element.closest(`.${NEWS_IMAGE_LINKED_CLASS}`);
	if (linkedWrapper instanceof HTMLElement) {
		const overlay = linkedWrapper.querySelector(
			`a.${NEWS_IMAGE_LINK_OVERLAY_CLASS}[href]`,
		);
		const overlayHref = overlay?.getAttribute("href")?.trim() ?? "";
		if (/^https?:\/\//i.test(overlayHref)) {
			return overlayHref;
		}
	}

	const anchor = element.closest("a[href]");
	const href = anchor?.getAttribute("href")?.trim() ?? "";
	return /^https?:\/\//i.test(href) ? href : null;
}

export const NewsImageExtension = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			widthPercent: {
				default: null,
				parseHTML: element => readImageWidthPercentFromElement(element),
				renderHTML: () => ({}),
			},
			href: {
				default: null,
				parseHTML: element => {
					if (!(element instanceof HTMLElement)) {
						return null;
					}
					return readImageHrefFromElement(element);
				},
				renderHTML: () => ({}),
			},
		};
	},

	renderHTML({ node, HTMLAttributes }) {
		const textAlign =
			typeof node.attrs.textAlign === "string" ? node.attrs.textAlign : null;
		const widthPercent = normalizeNewsImageWidth(node.attrs.widthPercent);
		const href =
			typeof node.attrs.href === "string" ? node.attrs.href.trim() : "";
		const { style, width, height, ...rest } = HTMLAttributes;

		let cleanedStyle: string | undefined;
		if (typeof style === "string") {
			cleanedStyle =
				style
					.replace(/text-align:\s*[^;]+;?\s*/gi, "")
					.replace(/width:\s*[^;]+;?\s*/gi, "")
					.trim() || undefined;
		}

		const className = newsImageClassNames(textAlign, widthPercent);
		const imgAttrs = mergeAttributes(this.options.HTMLAttributes, rest, {
			...(cleanedStyle ? { style: cleanedStyle } : {}),
		});

		if (/^https?:\/\//i.test(href)) {
			const wrapperClass = [NEWS_IMAGE_LINKED_CLASS, className].filter(Boolean).join(" ");
			return [
				"div",
				{ class: wrapperClass },
				["img", imgAttrs],
				[
					"a",
					{
						href,
						class: NEWS_IMAGE_LINK_OVERLAY_CLASS,
						target: "_blank",
						rel: "noopener noreferrer nofollow",
						"aria-label": "Open image link",
					},
				],
			];
		}

		return [
			"img",
			mergeAttributes(imgAttrs, {
				...(className ? { class: className } : {}),
			}),
		];
	},

	parseHTML() {
		return [
			{
				tag: `div.${NEWS_IMAGE_LINKED_CLASS} img[src]`,
				getAttrs: element => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}

					const attrs: Record<string, string | number | null> = {};
					const textAlign = readImageAlignFromElement(element);
					if (textAlign) {
						attrs.textAlign = textAlign;
					}

					attrs.widthPercent = readImageWidthPercentFromElement(element);
					const linkHref = readImageHrefFromElement(element);
					if (linkHref) {
						attrs.href = linkHref;
					}

					return attrs;
				},
			},
			{
				tag: "a[href] img[src]",
				getAttrs: element => {
					if (!(element instanceof HTMLElement)) {
						return false;
					}

					const attrs: Record<string, string | number | null> = {};
					const textAlign = readImageAlignFromElement(element);
					if (textAlign) {
						attrs.textAlign = textAlign;
					}

					attrs.widthPercent = readImageWidthPercentFromElement(element);
					const linkHref = readImageHrefFromElement(element);
					if (linkHref) {
						attrs.href = linkHref;
					}

					return attrs;
				},
			},
			{
				tag: this.options.allowBase64
					? "img[src]"
					: 'img[src]:not([src^="data:"])',
				getAttrs: element => {
					if (!(element instanceof HTMLElement)) {
						return {};
					}

					const attrs: Record<string, string | number | null> = {};
					const textAlign = readImageAlignFromElement(element);
					if (textAlign) {
						attrs.textAlign = textAlign;
					}

					attrs.widthPercent = readImageWidthPercentFromElement(element);

					return attrs;
				},
			},
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(NewsImageNodeView);
	},
});
