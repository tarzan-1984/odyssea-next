"use client";

import { createContext, useContext } from "react";

type NewsEditorUploadContextValue = {
	cancelUploadByPreviewUrl: (previewUrl: string) => void;
};

export const NewsEditorUploadContext = createContext<NewsEditorUploadContextValue | null>(
	null,
);

export function useNewsEditorUploadCancel() {
	return useContext(NewsEditorUploadContext)?.cancelUploadByPreviewUrl ?? null;
}
