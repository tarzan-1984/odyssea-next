"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import LoadChatPhotoUploadModal, {
	type LoadChatSelectedPhoto,
} from "@/components/chats/LoadChatPhotoUploadModal";

export type { LoadChatSelectedPhoto };

type LoadChatPhotoSelectionContextValue = {
	isSelected: (key: string) => boolean;
	toggle: (key: string) => void;
	openUpload: (files: LoadChatSelectedPhoto[]) => void;
};

const LoadChatPhotoSelectionContext = createContext<LoadChatPhotoSelectionContextValue | null>(
	null
);

export function LoadChatPhotoSelectionProvider({
	enabled,
	roomId,
	loadId,
	children,
}: {
	enabled: boolean;
	roomId: string;
	loadId: string;
	children: React.ReactNode;
}) {
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
	const [pendingUpload, setPendingUpload] = useState<LoadChatSelectedPhoto[] | null>(null);
	const [scope, setScope] = useState(roomId);

	if (scope !== roomId) {
		setScope(roomId);
		setSelectedKeys(new Set());
		setPendingUpload(null);
	}

	const isSelected = useCallback((key: string) => selectedKeys.has(key), [selectedKeys]);

	const toggle = useCallback((key: string) => {
		setSelectedKeys(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const openUpload = useCallback((files: LoadChatSelectedPhoto[]) => {
		if (files.length === 0) return;
		setPendingUpload(files);
	}, []);

	const closeUpload = useCallback(() => {
		setPendingUpload(null);
	}, []);

	const clearSelected = useCallback((keys: string[]) => {
		setSelectedKeys(prev => {
			const next = new Set(prev);
			for (const key of keys) next.delete(key);
			return next;
		});
	}, []);

	const removeFromUpload = useCallback((key: string) => {
		setSelectedKeys(prev => {
			if (!prev.has(key)) return prev;
			const next = new Set(prev);
			next.delete(key);
			return next;
		});
		setPendingUpload(prev => {
			if (!prev) return prev;
			const next = prev.filter(file => file.key !== key);
			return next.length === 0 ? null : next;
		});
	}, []);

	const value = useMemo(
		() => (enabled ? { isSelected, toggle, openUpload } : null),
		[enabled, isSelected, toggle, openUpload]
	);

	return (
		<LoadChatPhotoSelectionContext.Provider value={value}>
			{children}
			{enabled ? (
				<LoadChatPhotoUploadModal
					isOpen={pendingUpload !== null}
					files={pendingUpload ?? []}
					loadId={loadId}
					onClose={closeUpload}
					onUploaded={clearSelected}
					onRemoveFile={removeFromUpload}
				/>
			) : null}
		</LoadChatPhotoSelectionContext.Provider>
	);
}

export function useLoadChatPhotoSelection() {
	return useContext(LoadChatPhotoSelectionContext);
}
