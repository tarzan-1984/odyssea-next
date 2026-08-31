"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
	isChatAttachmentFile,
	isChatAttachmentImageFile,
	isChatAttachmentNonImageFile,
	CHAT_ATTACHMENT_ACCEPT,
} from "@/utils/chatAttachmentTypes";
import { uploadNewsArticleImage, formatNewsArticleUploadStatus } from "@/app-api/uploadNewsArticleImage";
import {
	uploadNewsArticleAttachmentFile,
} from "@/app-api/uploadNewsArticleAttachmentFile";
import { deleteNewsArticleMediaInBackground } from "@/app-api/deleteNewsArticleMediaInBackground";
import { NewsTextFileExtension } from "./news-text-file-extension";
import {
	NewsImageExtension,
	NEWS_IMAGE_WIDTH_OPTIONS,
	normalizeNewsImageWidth,
	type NewsImageWidthValue,
} from "./news-image-extension";
import { NewsEditorUploadContext } from "./NewsEditorUploadContext";
import {
	unwrapNewsArticleShell,
	wrapNewsArticleShell,
} from "./newsArticleBackground";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	FileText,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	Image as ImageIcon,
	Italic,
	Link2,
	List,
	ListOrdered,
	Minus,
	PaintBucket,
	Palette,
	Quote,
	Redo2,
	Smile,
	SquareCode,
	Strikethrough,
	Underline as UnderlineIcon,
	Undo2,
	Unlink,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import EmojiPicker, { Theme as EmojiPickerTheme, type EmojiClickData } from "emoji-picker-react";

type NewsRichTextEditorProps = {
	onChange: (html: string, plainText: string) => void;
	onUploadStateChange?: (isUploading: boolean) => void;
	placeholder?: string;
	initialHtml?: string;
};

export type NewsRichTextEditorHandle = {
	cancelPendingUploads: () => void;
	getContent: () => { html: string; plainText: string };
};

type ActiveUpload = {
	previewUrl?: string;
	cancelled: boolean;
};

function isEditorAlive(editor: Editor | null): editor is Editor {
	return Boolean(editor && !editor.isDestroyed);
}

const TEXT_COLORS = [
	"#101828",
	"#465fff",
	"#039855",
	"#dc6803",
	"#d92d20",
	"#7a5af8",
	"#0ba5ec",
] as const;

const HIGHLIGHT_COLORS = [
	"#fef08a",
	"#bbf7d0",
	"#bfdbfe",
	"#fbcfe8",
	"#fed7aa",
	"#e9d5ff",
] as const;

const ARTICLE_BACKGROUND_COLORS = [
	"#ffffff",
	"#fefce8",
	"#fef3c7",
	"#ecfdf3",
	"#eff6ff",
	"#fdf2f8",
	"#f5f3ff",
	"#f3f4f6",
] as const;

const EMOJI_PICKER_WIDTH = 320;
const EMOJI_PICKER_HEIGHT = 360;
const COLOR_PICKER_WIDTH = 176;
const COLOR_PICKER_HEIGHT = 158;

function routeNewsEditorFile(
	file: File,
	uploadImage: (file: File) => void,
	uploadAttachment: (file: File) => void,
): boolean {
	if (isChatAttachmentImageFile(file)) {
		uploadImage(file);
		return true;
	}
	if (isChatAttachmentNonImageFile(file)) {
		uploadAttachment(file);
		return true;
	}
	return false;
}

function debounceChangeCallback(
	callback: (html: string, plainText: string) => void,
	delayMs: number,
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let version = 0;

	const debounced = (html: string, plainText: string) => {
		const scheduledVersion = ++version;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			if (scheduledVersion !== version) return;
			callback(html, plainText);
		}, delayMs);
	};

	debounced.cancel = () => {
		version += 1;
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};

	debounced.flush = (html: string, plainText: string) => {
		version += 1;
		if (timer) clearTimeout(timer);
		timer = null;
		callback(html, plainText);
	};

	return debounced;
}

function replaceImageSrc(editor: Editor, fromSrc: string, toSrc: string): boolean {
	let targetPos: number | null = null;
	let targetAttrs: Record<string, unknown> | null = null;

	editor.state.doc.descendants((node, pos) => {
		if (targetPos != null) return false;
		if (node.type.name === "image" && node.attrs.src === fromSrc) {
			targetPos = pos;
			targetAttrs = { ...node.attrs, src: toSrc };
			return false;
		}
		return true;
	});

	if (targetPos == null || targetAttrs == null) {
		return false;
	}

	const { tr } = editor.state;
	tr.setNodeMarkup(targetPos, undefined, targetAttrs);
	editor.view.dispatch(tr);
	return true;
}

function removeImageBySrc(editor: Editor, src: string) {
	let targetPos: number | null = null;
	let nodeSize = 0;

	editor.state.doc.descendants((node, pos) => {
		if (targetPos != null) return false;
		if (node.type.name === "image" && node.attrs.src === src) {
			targetPos = pos;
			nodeSize = node.nodeSize;
			return false;
		}
		return true;
	});

	if (targetPos == null) return;

	const { tr } = editor.state;
	tr.delete(targetPos, targetPos + nodeSize);
	editor.view.dispatch(tr);
}

type FloatingPanelPosition = { top: number; left: number };

function computeFloatingPanelPosition(
	trigger: HTMLElement,
	panelWidth: number,
	panelHeight: number,
): FloatingPanelPosition {
	const padding = 8;
	const rect = trigger.getBoundingClientRect();
	let top = rect.bottom + padding;
	let left = rect.left;

	if (top + panelHeight > window.innerHeight - padding) {
		top = rect.top - panelHeight - padding;
	}
	if (left + panelWidth > window.innerWidth - padding) {
		left = window.innerWidth - panelWidth - padding;
	}

	return {
		top: Math.max(padding, top),
		left: Math.max(padding, left),
	};
}

function useToolbarFloatingPanel(
	open: boolean,
	onClose: () => void,
	panelWidth: number,
	panelHeight: number,
) {
	const [position, setPosition] = useState<FloatingPanelPosition | null>(null);
	const [mounted, setMounted] = useState(false);
	const triggerRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	const updatePosition = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		setPosition(computeFloatingPanelPosition(trigger, panelWidth, panelHeight));
	}, [panelWidth, panelHeight]);

	useLayoutEffect(() => {
		setMounted(true);
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		updatePosition();
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) return;

		const onScrollOrResize = () => updatePosition();
		window.addEventListener("resize", onScrollOrResize);
		window.addEventListener("scroll", onScrollOrResize, true);

		return () => {
			window.removeEventListener("resize", onScrollOrResize);
			window.removeEventListener("scroll", onScrollOrResize, true);
		};
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) return;

		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
				return;
			}
			onClose();
		};

		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [open, onClose]);

	return { mounted, position, triggerRef, panelRef };
}

function ToolbarButton({
	active,
	disabled,
	onClick,
	label,
	children,
}: {
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	label: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
				active
					? "bg-brand-500 text-white"
					: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
			}`}
		>
			{children}
		</button>
	);
}

function ToolbarWidthButton({
	active,
	onClick,
	label,
}: {
	active?: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			aria-label={`Image width ${label}`}
			title={`Image width ${label}`}
			onClick={onClick}
			aria-pressed={active}
			className={`flex h-8 min-w-[2.75rem] items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors ${
				active
					? "bg-brand-500 text-white"
					: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
			}`}
		>
			{label}
		</button>
	);
}

function readActiveImageWidth(editor: Editor): NewsImageWidthValue {
	return normalizeNewsImageWidth(editor.getAttributes("image").widthPercent);
}

function ToolbarColorPicker({
	label,
	icon,
	colors,
	defaultCustomColor,
	onPick,
	onClear,
}: {
	label: string;
	icon: ReactNode;
	colors: readonly string[];
	defaultCustomColor: string;
	onPick: (color: string) => void;
	onClear?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [customColor, setCustomColor] = useState(defaultCustomColor);
	const close = useCallback(() => setOpen(false), []);
	const { mounted, position, triggerRef, panelRef } = useToolbarFloatingPanel(
		open,
		close,
		COLOR_PICKER_WIDTH,
		COLOR_PICKER_HEIGHT,
	);

	const applyColor = (color: string, closePanel = true) => {
		setCustomColor(color);
		onPick(color);
		if (closePanel) setOpen(false);
	};

	const pickerPanel =
		open && position ? (
			<div
				ref={panelRef}
				className="fixed z-[100010] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
				style={{ top: position.top, left: position.left, width: COLOR_PICKER_WIDTH }}
			>
				<div className="grid grid-cols-4 gap-1.5">
					{colors.map(color => (
						<button
							key={color}
							type="button"
							title={color}
							onClick={() => applyColor(color, true)}
							className="h-6 w-6 rounded border border-gray-200 dark:border-gray-600"
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
				<div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
					<label className="flex cursor-pointer items-center gap-2">
						<input
							type="color"
							value={customColor}
							onChange={event => applyColor(event.target.value, false)}
							className="h-8 w-10 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent p-0.5 dark:border-gray-600"
							aria-label={`${label} custom`}
						/>
						<span className="text-xs text-gray-600 dark:text-gray-300">Custom color</span>
					</label>
				</div>
				{onClear ? (
					<button
						type="button"
						onClick={() => {
							onClear();
							setOpen(false);
						}}
						className="mt-2 w-full rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						Clear
					</button>
				) : null}
			</div>
		) : null;

	return (
		<div ref={triggerRef}>
			<button
				type="button"
				aria-label={label}
				title={label}
				onClick={() => setOpen(prev => !prev)}
				className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
			>
				{icon}
			</button>
			{mounted && pickerPanel ? createPortal(pickerPanel, document.body) : null}
		</div>
	);
}

function EmojiPickerButton({ onPick }: { onPick: (emoji: string) => void }) {
	const [open, setOpen] = useState(false);
	const close = useCallback(() => setOpen(false), []);
	const { mounted, position, triggerRef, panelRef } = useToolbarFloatingPanel(
		open,
		close,
		EMOJI_PICKER_WIDTH,
		EMOJI_PICKER_HEIGHT,
	);
	const { theme } = useTheme();

	const pickerPanel =
		open && position ? (
			<div
				ref={panelRef}
				className="fixed z-[100010] overflow-hidden rounded-lg border border-gray-200 shadow-xl dark:border-gray-700"
				style={{ top: position.top, left: position.left }}
			>
				<EmojiPicker
					onEmojiClick={(data: EmojiClickData) => {
						onPick(data.emoji);
						setOpen(false);
					}}
					theme={theme === "dark" ? EmojiPickerTheme.DARK : EmojiPickerTheme.LIGHT}
					width={EMOJI_PICKER_WIDTH}
					height={EMOJI_PICKER_HEIGHT}
					lazyLoadEmojis
					searchPlaceholder="Search emoji"
					previewConfig={{ showPreview: false }}
				/>
			</div>
		) : null;

	return (
		<div ref={triggerRef}>
			<ToolbarButton label="Insert emoji" onClick={() => setOpen(prev => !prev)}>
				<Smile className="h-4 w-4" />
			</ToolbarButton>
			{mounted && pickerPanel ? createPortal(pickerPanel, document.body) : null}
		</div>
	);
}

export default forwardRef<NewsRichTextEditorHandle, NewsRichTextEditorProps>(
	function NewsRichTextEditor(
		{ onChange, onUploadStateChange, placeholder = "Write the article…", initialHtml = "" },
		ref,
	) {
	const uploadImageRef = useRef<(file: File) => Promise<void>>(async () => {});
	const uploadTextFileRef = useRef<(file: File) => Promise<void>>(async () => {});
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textFileInputRef = useRef<HTMLInputElement>(null);
	const activeUploadsRef = useRef<Map<string, ActiveUpload>>(new Map());
	const onUploadStateChangeRef = useRef(onUploadStateChange);
	onUploadStateChangeRef.current = onUploadStateChange;
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const syncUploadBusyState = useCallback(() => {
		const busy = activeUploadsRef.current.size > 0;
		setIsUploading(busy);
		onUploadStateChangeRef.current?.(busy);
		if (!busy) {
			setUploadStatus(null);
		}
	}, []);

	const beginUpload = useCallback(
		(uploadId: string, previewUrl?: string) => {
			activeUploadsRef.current.set(uploadId, { previewUrl, cancelled: false });
			syncUploadBusyState();
		},
		[syncUploadBusyState],
	);

	const endUpload = useCallback(
		(uploadId: string) => {
			activeUploadsRef.current.delete(uploadId);
			syncUploadBusyState();
		},
		[syncUploadBusyState],
	);

	const isUploadCancelled = useCallback((uploadId: string) => {
		return !activeUploadsRef.current.has(uploadId);
	}, []);

	const cancelUploadByPreviewUrl = useCallback(
		(previewUrl: string) => {
			for (const [uploadId, upload] of activeUploadsRef.current.entries()) {
				if (upload.previewUrl === previewUrl) {
					activeUploadsRef.current.delete(uploadId);
					syncUploadBusyState();
					return uploadId;
				}
			}
			return null;
		},
		[syncUploadBusyState],
	);

	const cancelAllUploads = useCallback(() => {
		activeUploadsRef.current.clear();
		syncUploadBusyState();
	}, [syncUploadBusyState]);

	useEffect(() => () => cancelAllUploads(), [cancelAllUploads]);

	const initialParsed = unwrapNewsArticleShell(initialHtml);
	const [articleBackground, setArticleBackground] = useState<string | null>(
		initialParsed.backgroundColor,
	);
	const articleBackgroundRef = useRef<string | null>(initialParsed.backgroundColor);
	articleBackgroundRef.current = articleBackground;

	const serializeHtml = useCallback((instance: Editor) => {
		return wrapNewsArticleShell(instance.getHTML(), articleBackgroundRef.current);
	}, []);

	const emitChange = useMemo(
		() => debounceChangeCallback((html, plainText) => onChangeRef.current(html, plainText), 200),
		[],
	);

	useEffect(() => () => emitChange.cancel(), [emitChange]);

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: true,
		content: initialParsed.innerHtml,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: {
					openOnClick: false,
					autolink: true,
					defaultProtocol: "https",
				},
			}),
			TextStyle,
			Color,
			Highlight.configure({ multicolor: true }),
			NewsImageExtension.configure({ inline: false, allowBase64: false }),
			NewsTextFileExtension,
			Placeholder.configure({ placeholder }),
			TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
		],
		editorProps: {
			attributes: {
				class: "news-rich-editor-content outline-none",
			},
			handleDrop: (_view, event, _slice, moved) => {
				if (moved || !event.dataTransfer?.files?.length) return false;
				const files = Array.from(event.dataTransfer.files).filter(isChatAttachmentFile);
				if (!files.length) return false;
				event.preventDefault();
				for (const file of files) {
					routeNewsEditorFile(
						file,
						f => {
							uploadImageRef.current(f).catch(() => undefined);
						},
						f => {
							uploadTextFileRef.current(f).catch(() => undefined);
						},
					);
				}
				return true;
			},
			handlePaste: (_view, event) => {
				const files = Array.from(event.clipboardData?.items ?? [])
					.map(item => item.getAsFile())
					.filter((file): file is File => file != null)
					.filter(isChatAttachmentFile);
				if (!files.length) return false;
				event.preventDefault();
				for (const file of files) {
					routeNewsEditorFile(
						file,
						f => {
							uploadImageRef.current(f).catch(() => undefined);
						},
						f => {
							uploadTextFileRef.current(f).catch(() => undefined);
						},
					);
				}
				return true;
			},
		},
		onUpdate: ({ editor: instance }) => {
			emitChange(serializeHtml(instance), instance.getText());
		},
	});

	useEffect(() => {
		if (!editor) return;
		onChangeRef.current(serializeHtml(editor), editor.getText());
	}, [editor, serializeHtml]);

	useEffect(() => {
		if (!editor) return;
		editor.view.dom.style.backgroundColor = articleBackground ?? "";
	}, [articleBackground, editor]);

	const applyArticleBackground = useCallback(
		(color: string | null) => {
			setArticleBackground(color);
			articleBackgroundRef.current = color;
			if (!isEditorAlive(editor)) return;
			editor.view.dom.style.backgroundColor = color ?? "";
			emitChange.flush(serializeHtml(editor), editor.getText());
		},
		[editor, emitChange, serializeHtml],
	);

	const setLink = useCallback(() => {
		if (!editor) return;

		if (editor.isActive("image")) {
			const previous = editor.getAttributes("image").href as string | undefined;
			const url = window.prompt("Link URL", previous ?? "https://");
			if (url === null) return;
			const trimmed = url.trim();
			editor
				.chain()
				.focus()
				.updateAttributes("image", { href: trimmed || null })
				.run();
			return;
		}

		const previous = editor.getAttributes("link").href as string | undefined;
		const url = window.prompt("Link URL", previous ?? "https://");
		if (url === null) return;
		const trimmed = url.trim();
		if (!trimmed) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		editor.chain().focus().setLink({ href: trimmed }).run();
	}, [editor]);

	const unsetLink = useCallback(() => {
		if (!editor) return;
		if (editor.isActive("image")) {
			editor.chain().focus().updateAttributes("image", { href: null }).run();
			return;
		}
		editor.chain().focus().unsetLink().run();
	}, [editor]);

	const insertEmoji = useCallback(
		(emoji: string) => {
			if (!editor) return;
			editor.chain().focus().insertContent(emoji).run();
		},
		[editor],
	);

	const uploadAndInsertImage = useCallback(
		async (file: File) => {
			if (!isEditorAlive(editor)) return;

			const uploadId = crypto.randomUUID();
			const previewUrl = URL.createObjectURL(file);
			editor.chain().focus().setImage({ src: previewUrl }).run();
			emitChange.flush(serializeHtml(editor), editor.getText());
			beginUpload(uploadId, previewUrl);

			setUploadError(null);
			setUploadStatus("Optimizing image…");
			try {
				const fileUrl = await uploadNewsArticleImage(file, progress => {
					setUploadStatus(formatNewsArticleUploadStatus(progress));
				});

				if (isUploadCancelled(uploadId)) {
					deleteNewsArticleMediaInBackground(fileUrl);
					return;
				}

				if (!isEditorAlive(editor)) {
					deleteNewsArticleMediaInBackground(fileUrl);
					return;
				}

				const replaced = replaceImageSrc(editor, previewUrl, fileUrl);
				if (!replaced) {
					deleteNewsArticleMediaInBackground(fileUrl);
					removeImageBySrc(editor, previewUrl);
				}
				emitChange.flush(serializeHtml(editor), editor.getText());
			} catch (error) {
				if (isEditorAlive(editor)) {
					removeImageBySrc(editor, previewUrl);
					emitChange.flush(serializeHtml(editor), editor.getText());
				}
				if (!isUploadCancelled(uploadId)) {
					setUploadError(
						error instanceof Error ? error.message : "Failed to upload image.",
					);
				}
			} finally {
				endUpload(uploadId);
				if (isEditorAlive(editor)) {
					emitChange.flush(serializeHtml(editor), editor.getText());
				}
				// Revoke after React node view swaps src away from the blob URL.
				window.setTimeout(() => URL.revokeObjectURL(previewUrl), 0);
			}
		},
		[editor, emitChange, beginUpload, endUpload, isUploadCancelled],
	);

	const uploadAndInsertTextFile = useCallback(
		async (file: File) => {
			if (!isEditorAlive(editor)) return;

			const uploadId = crypto.randomUUID();
			setUploadError(null);
			setUploadStatus("Uploading file…");
			beginUpload(uploadId);
			try {
				const uploaded = await uploadNewsArticleAttachmentFile(file);

				if (isUploadCancelled(uploadId)) {
					deleteNewsArticleMediaInBackground(uploaded.fileUrl);
					return;
				}

				if (!isEditorAlive(editor)) {
					deleteNewsArticleMediaInBackground(uploaded.fileUrl);
					return;
				}

				editor
					.chain()
					.focus()
					.setNewsTextFile({
						fileUrl: uploaded.fileUrl,
						fileName: uploaded.fileName,
						fileSize: uploaded.fileSize,
					})
					.run();
				emitChange.flush(serializeHtml(editor), editor.getText());
			} catch (error) {
				if (!isUploadCancelled(uploadId)) {
					setUploadError(
						error instanceof Error ? error.message : "Failed to upload file.",
					);
				}
			} finally {
				endUpload(uploadId);
			}
		},
		[editor, emitChange, beginUpload, endUpload, isUploadCancelled],
	);

	useEffect(() => {
		uploadImageRef.current = uploadAndInsertImage;
	}, [uploadAndInsertImage]);

	useEffect(() => {
		uploadTextFileRef.current = uploadAndInsertTextFile;
	}, [uploadAndInsertTextFile]);

	useImperativeHandle(
		ref,
		() => ({
			cancelPendingUploads: cancelAllUploads,
			getContent: () => {
				if (!isEditorAlive(editor)) {
					return { html: "", plainText: "" };
				}
				return { html: serializeHtml(editor), plainText: editor.getText() };
			},
		}),
		[cancelAllUploads, editor, serializeHtml],
	);

	if (!editor) {
		return (
			<div className="min-h-[280px] rounded-lg border border-gray-300 dark:border-gray-700" />
		);
	}

	const iconClass = "h-4 w-4";
	const isImageActive = editor.isActive("image");
	const activeImageWidth = isImageActive ? readActiveImageWidth(editor) : null;
	const activeImageHref =
		isImageActive && typeof editor.getAttributes("image").href === "string"
			? editor.getAttributes("image").href
			: "";
	const hasActiveImageLink = Boolean(activeImageHref?.trim());

	return (
		<NewsEditorUploadContext.Provider value={{ cancelUploadByPreviewUrl }}>
			<div className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
			<div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 p-1.5 dark:border-gray-700 dark:bg-gray-800/60">
				<ToolbarButton
					label="Undo"
					disabled={!editor.can().undo()}
					onClick={() => editor.chain().focus().undo().run()}
				>
					<Undo2 className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Redo"
					disabled={!editor.can().redo()}
					onClick={() => editor.chain().focus().redo().run()}
				>
					<Redo2 className={iconClass} />
				</ToolbarButton>
				<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
				<ToolbarButton
					label="Bold"
					active={editor.isActive("bold")}
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<Bold className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Italic"
					active={editor.isActive("italic")}
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<Italic className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Underline"
					active={editor.isActive("underline")}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
				>
					<UnderlineIcon className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Strikethrough"
					active={editor.isActive("strike")}
					onClick={() => editor.chain().focus().toggleStrike().run()}
				>
					<Strikethrough className={iconClass} />
				</ToolbarButton>
				<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
				<ToolbarColorPicker
					label="Text color"
					icon={<Palette className={iconClass} />}
					colors={TEXT_COLORS}
					defaultCustomColor="#465fff"
					onPick={color => editor.chain().focus().setColor(color).run()}
					onClear={() => editor.chain().focus().unsetColor().run()}
				/>
				<ToolbarColorPicker
					label="Highlight color"
					icon={<Highlighter className={iconClass} />}
					colors={HIGHLIGHT_COLORS}
					defaultCustomColor="#fef08a"
					onPick={color => editor.chain().focus().setHighlight({ color }).run()}
					onClear={() => editor.chain().focus().unsetHighlight().run()}
				/>
				<ToolbarColorPicker
					label="Article background"
					icon={<PaintBucket className={iconClass} />}
					colors={ARTICLE_BACKGROUND_COLORS}
					defaultCustomColor={articleBackground ?? "#ffffff"}
					onPick={color => applyArticleBackground(color)}
					onClear={() => applyArticleBackground(null)}
				/>
				<EmojiPickerButton onPick={insertEmoji} />
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={event => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (file) {
							uploadAndInsertImage(file).catch(() => undefined);
						}
					}}
				/>
				<ToolbarButton
					label="Insert image"
					disabled={isUploading}
					onClick={() => fileInputRef.current?.click()}
				>
					<ImageIcon className={iconClass} />
				</ToolbarButton>
				<input
					ref={textFileInputRef}
					type="file"
					accept={CHAT_ATTACHMENT_ACCEPT}
					className="hidden"
					onChange={event => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (!file) return;
						if (
							!routeNewsEditorFile(
								file,
								f => {
									uploadAndInsertImage(f).catch(() => undefined);
								},
								f => {
									uploadAndInsertTextFile(f).catch(() => undefined);
								},
							)
						) {
							setUploadError("File type not allowed.");
						}
					}}
				/>
				<ToolbarButton
					label="Insert file"
					disabled={isUploading}
					onClick={() => textFileInputRef.current?.click()}
				>
					<FileText className={iconClass} />
				</ToolbarButton>
				<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
				<ToolbarButton
					label="Heading 1"
					active={editor.isActive("heading", { level: 1 })}
					onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				>
					<Heading1 className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Heading 2"
					active={editor.isActive("heading", { level: 2 })}
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				>
					<Heading2 className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Heading 3"
					active={editor.isActive("heading", { level: 3 })}
					onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				>
					<Heading3 className={iconClass} />
				</ToolbarButton>
				<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
				<ToolbarButton
					label="Bullet list"
					active={editor.isActive("bulletList")}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<List className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Numbered list"
					active={editor.isActive("orderedList")}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<ListOrdered className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Quote"
					active={editor.isActive("blockquote")}
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
				>
					<Quote className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Inline code"
					active={editor.isActive("code")}
					onClick={() => editor.chain().focus().toggleCode().run()}
				>
					<Code className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Code block"
					active={editor.isActive("codeBlock")}
					onClick={() => editor.chain().focus().toggleCodeBlock().run()}
				>
					<SquareCode className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Horizontal rule"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
				>
					<Minus className={iconClass} />
				</ToolbarButton>
				<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
				<ToolbarButton
					label="Link"
					active={editor.isActive("link") || hasActiveImageLink}
					onClick={setLink}
				>
					<Link2 className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Remove link"
					disabled={!editor.isActive("link") && !hasActiveImageLink}
					onClick={unsetLink}
				>
					<Unlink className={iconClass} />
				</ToolbarButton>
			</div>
			<div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1 dark:border-gray-700 dark:bg-gray-800/60">
				{isImageActive ? (
					<>
						<ToolbarWidthButton
							label="Default"
							active={activeImageWidth == null}
							onClick={() =>
								editor
									.chain()
									.focus()
									.updateAttributes("image", { widthPercent: null })
									.run()
							}
						/>
						{NEWS_IMAGE_WIDTH_OPTIONS.map(option => (
							<ToolbarWidthButton
								key={option}
								label={`${option}%`}
								active={activeImageWidth === option}
								onClick={() =>
									editor
										.chain()
										.focus()
										.updateAttributes("image", { widthPercent: option })
										.run()
								}
							/>
						))}
						<span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
					</>
				) : null}
				<ToolbarButton
					label="Align left"
					active={editor.isActive({ textAlign: "left" })}
					onClick={() => editor.chain().focus().setTextAlign("left").run()}
				>
					<AlignLeft className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Align center"
					active={editor.isActive({ textAlign: "center" })}
					onClick={() => editor.chain().focus().setTextAlign("center").run()}
				>
					<AlignCenter className={iconClass} />
				</ToolbarButton>
				<ToolbarButton
					label="Align right"
					active={editor.isActive({ textAlign: "right" })}
					onClick={() => editor.chain().focus().setTextAlign("right").run()}
				>
					<AlignRight className={iconClass} />
				</ToolbarButton>
			</div>
			{uploadStatus ? (
				<p className="border-b border-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
					{uploadStatus}
				</p>
			) : null}
			{uploadError ? (
				<p className="border-b border-gray-200 px-3 py-1.5 text-xs text-red-600 dark:border-gray-700 dark:text-red-400">
					{uploadError}
				</p>
			) : null}
			<EditorContent editor={editor} className="news-rich-editor" />
			</div>
		</NewsEditorUploadContext.Provider>
	);
},
);
