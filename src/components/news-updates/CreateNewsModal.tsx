"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { createNews, updateNews, type NewsArticle } from "@/app-api/news";
import NewsRichTextEditor, { type NewsRichTextEditorHandle } from "./NewsRichTextEditor";
import {
	cleanupNewsArticleMediaInBackground,
	cleanupNewsArticleMediaNotIn,
	hasUnuploadedNewsArticleMedia,
} from "./newsArticleUploadUtils";

type CreateNewsModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onCreated?: () => void;
	onUpdated?: () => void;
	/** When set, modal opens in edit mode with prefilled fields. */
	article?: NewsArticle | null;
};

export default function CreateNewsModal({
	isOpen,
	onClose,
	onCreated,
	onUpdated,
	article = null,
}: CreateNewsModalProps) {
	const isEdit = article != null;
	const editorRef = useRef<NewsRichTextEditorHandle>(null);
	const [title, setTitle] = useState("");
	const [contentHtml, setContentHtml] = useState("");
	const [contentText, setContentText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [isEditorUploading, setIsEditorUploading] = useState(false);
	const [editorKey, setEditorKey] = useState(0);

	useEffect(() => {
		if (!isOpen) return;
		if (article) {
			setTitle(article.title);
			setContentHtml(article.article);
			setContentText("");
			setError(null);
			setSubmitting(false);
			setIsEditorUploading(false);
			setEditorKey(key => key + 1);
		} else {
			setTitle("");
			setContentHtml("");
			setContentText("");
			setError(null);
			setSubmitting(false);
			setIsEditorUploading(false);
			setEditorKey(key => key + 1);
		}
	}, [isOpen, article]);

	const onEditorChange = useCallback((html: string, plainText: string) => {
		setContentHtml(html);
		setContentText(plainText);
		if (!hasUnuploadedNewsArticleMedia(html)) {
			setError(current => (current === "Please wait until all files finish uploading." ? null : current));
		}
	}, []);

	const onEditorUploadStateChange = useCallback((isUploading: boolean) => {
		setIsEditorUploading(isUploading);
		if (!isUploading) {
			const content = editorRef.current?.getContent();
			if (content) {
				setContentHtml(content.html);
				setContentText(content.plainText);
				if (!hasUnuploadedNewsArticleMedia(content.html)) {
					setError(current =>
						current === "Please wait until all files finish uploading." ? null : current,
					);
				}
			}
		}
	}, []);

	const resetForm = () => {
		setTitle("");
		setContentHtml("");
		setContentText("");
		setError(null);
		setSubmitting(false);
		setIsEditorUploading(false);
	};

	const handleClose = () => {
		if (submitting) return;

		editorRef.current?.cancelPendingUploads();
		if (isEdit && article) {
			// Drop only newly uploaded media that was never saved
			cleanupNewsArticleMediaNotIn(contentHtml, article.article);
		} else {
			cleanupNewsArticleMediaInBackground(contentHtml);
		}
		resetForm();
		onClose();
	};

	const onSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (submitting || isEditorUploading) {
			return;
		}

		if (!title.trim()) {
			setError("Please enter a news title.");
			return;
		}

		if (!contentText.trim()) {
			setError("Please enter news content.");
			return;
		}

		if (hasUnuploadedNewsArticleMedia(contentHtml)) {
			setError("Please wait until all files finish uploading.");
			return;
		}

		setError(null);
		setSubmitting(true);
		try {
			if (isEdit && article) {
				await updateNews(article.id, {
					title: title.trim(),
					article: contentHtml,
				});
				cleanupNewsArticleMediaNotIn(article.article, contentHtml);
				resetForm();
				onUpdated?.();
				onClose();
			} else {
				await createNews({
					title: title.trim(),
					article: contentHtml,
				});
				resetForm();
				onCreated?.();
				onClose();
			}
		} catch (err) {
			const raw =
				(err as { response?: { data?: { error?: unknown } } })?.response?.data?.error ??
				(err as Error)?.message;
			setError(
				typeof raw === "string"
					? raw
					: isEdit
						? "Failed to update news."
						: "Failed to create news.",
			);
			setSubmitting(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			className="w-full max-w-3xl rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick={!submitting}
			containScroll
		>
			<form onSubmit={onSubmit} className="flex max-h-[85vh] flex-col p-6">
				<h2 className="pr-12 text-lg font-semibold text-gray-900 dark:text-white">
					{isEdit ? "Edit post" : "Create post"}
				</h2>

				<div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
					<div>
						<Label htmlFor="create-news-title">Title</Label>
						<Input
							id="create-news-title"
							name="title"
							type="text"
							value={title}
							onChange={e => {
								setTitle(e.target.value);
								if (error === "Please enter a news title.") {
									setError(null);
								}
							}}
							placeholder="News title"
							disabled={submitting}
						/>
					</div>
					<div>
						<Label>Content</Label>
						<NewsRichTextEditor
							key={editorKey}
							ref={editorRef}
							initialHtml={isEdit && article ? article.article : ""}
							onChange={onEditorChange}
							onUploadStateChange={onEditorUploadStateChange}
							placeholder="Write the article…"
						/>
						{isEditorUploading ? (
							<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
								Files are still uploading.{" "}
								{isEdit ? "Save" : "Create"} will be available when upload finishes.
							</p>
						) : null}
					</div>
					{error ? <p className="text-sm text-error-500">{error}</p> : null}
				</div>

				<div className="mt-6 flex flex-wrap justify-end gap-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleClose}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						disabled={
							!contentText.trim() ||
							submitting ||
							isEditorUploading ||
							hasUnuploadedNewsArticleMedia(contentHtml)
						}
					>
						{submitting ? <SpinnerOne /> : isEdit ? "Save" : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
