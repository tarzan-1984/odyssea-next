import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import NewsTextFileNodeView from "./NewsTextFileNodeView";

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		newsTextFile: {
			setNewsTextFile: (attrs: {
				fileUrl: string;
				fileName: string;
				fileSize?: number;
			}) => ReturnType;
		};
	}
}

export const NewsTextFileExtension = Node.create({
	name: "newsTextFile",
	group: "block",
	atom: true,
	selectable: true,
	draggable: true,

	addAttributes() {
		return {
			fileUrl: {
				default: null,
				parseHTML: element => element.getAttribute("data-file-url"),
				renderHTML: attributes => {
					if (!attributes.fileUrl) return {};
					return { "data-file-url": attributes.fileUrl };
				},
			},
			fileName: {
				default: null,
				parseHTML: element => element.getAttribute("data-file-name"),
				renderHTML: attributes => {
					if (!attributes.fileName) return {};
					return { "data-file-name": attributes.fileName };
				},
			},
			fileSize: {
				default: null,
				parseHTML: element => {
					const value = element.getAttribute("data-file-size");
					return value ? Number(value) : null;
				},
				renderHTML: attributes => {
					if (attributes.fileSize == null) return {};
					return { "data-file-size": String(attributes.fileSize) };
				},
			},
		};
	},

	parseHTML() {
		return [{ tag: 'div[class*="news-text-file"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { class: "news-text-file" })];
	},

	addCommands() {
		return {
			setNewsTextFile:
				attrs =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs }),
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(NewsTextFileNodeView);
	},
});
