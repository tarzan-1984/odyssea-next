"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { resolveChatVideoForPlayback } from "@/utils/chatVideoPrepare";

type ChatVideoModalProps = {
	isOpen: boolean;
	fileUrl: string;
	fileName?: string;
	onClose: () => void;
};

/** Popup player. Native `controls` include play and seeking. */
export default function ChatVideoModal({
	isOpen,
	fileUrl,
	fileName,
	onClose,
}: ChatVideoModalProps) {
	const [playUrl, setPlayUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen || !fileUrl) {
			setPlayUrl(null);
			setError(null);
			return;
		}
		let cancelled = false;
		setPlayUrl(null);
		setError(null);
		resolveChatVideoForPlayback(fileUrl, fileName || "video.mp4")
			.then(url => {
				if (!cancelled) setPlayUrl(url);
			})
			.catch(reason => {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : "Failed to prepare video");
				}
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, fileUrl, fileName]);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative flex h-[95vh] w-[95vw] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden !bg-black/90 p-0 shadow-none border-none"
			showCloseButton={true}
			closeButtonClassName="pointer-events-auto absolute right-3 top-3 z-[100003] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 [&_path]:fill-white sm:right-6 sm:top-6 sm:h-11 sm:w-11"
			closeOnBackdropClick={true}
		>
			<div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-14 sm:p-8">
				{isOpen && playUrl ? (
					<video
						key={playUrl}
						src={playUrl}
						controls
						autoPlay
						playsInline
						className="max-h-full max-w-full"
					>
						{fileName || "Video"}
					</video>
				) : error ? (
					<p className="px-6 text-center text-sm text-red-300">{error}</p>
				) : (
					<div className="flex flex-col items-center gap-3 text-white">
						<span className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
						<p className="text-sm">Preparing video…</p>
					</div>
				)}
			</div>
			{fileName ? (
				<div className="pointer-events-none absolute bottom-4 left-1/2 z-[100002] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 text-center text-white backdrop-blur-sm">
					<p className="max-w-md truncate text-sm font-medium">{fileName}</p>
				</div>
			) : null}
		</Modal>
	);
}
