"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Check } from "lucide-react";
import {
	DEFAULT_NOTIFICATION_SOUND,
	formatNotificationSoundLabel,
	notificationSoundUrl,
} from "@/constants/notificationSounds";
import { useAdminNotificationSoundStore } from "@/stores/adminNotificationSoundStore";
import { useNotificationSoundsQuery } from "@/hooks/useNotificationSoundsQuery";

const PREVIEW_VOLUME = 0.7;

export default function NotificationSoundSettings() {
	const selectedSound = useAdminNotificationSoundStore(s => s.selectedNotificationSound);
	const setSelectedSound = useAdminNotificationSoundStore(s => s.setSelectedNotificationSound);
	const { data: sounds = [], isPending } = useNotificationSoundsQuery();
	const [playingFile, setPlayingFile] = useState<string | null>(null);
	const previewAudioRef = useRef<HTMLAudioElement | null>(null);

	const stopPreview = useCallback(() => {
		if (previewAudioRef.current) {
			previewAudioRef.current.pause();
			previewAudioRef.current = null;
		}
		setPlayingFile(null);
	}, []);

	useEffect(() => () => stopPreview(), [stopPreview]);

	const handlePreview = useCallback(
		async (file: string) => {
			stopPreview();
			const audio = new Audio(notificationSoundUrl(file));
			audio.volume = PREVIEW_VOLUME;
			previewAudioRef.current = audio;
			setPlayingFile(file);

			audio.onended = () => {
				if (previewAudioRef.current === audio) {
					stopPreview();
				}
			};

			try {
				await audio.play();
			} catch {
				stopPreview();
			}
		},
		[stopPreview]
	);

	const handleSelect = useCallback(
		(file: string) => {
			setSelectedSound(file);
		},
		[setSelectedSound]
	);

	return (
		<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
			<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
				Notification sound
			</h4>
			<p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
				Choose the sound played for new messages and notifications. Saved in this browser.
			</p>

			{isPending ? (
				<p className="text-sm text-gray-500 dark:text-gray-400">Loading sounds...</p>
			) : (
				<ul className="space-y-2">
					{sounds.map(sound => {
						const isSelected = selectedSound === sound.file;
						const isPlaying = playingFile === sound.file;

						return (
							<li
								key={sound.file}
								className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
									isSelected
										? "border-brand-500 bg-brand-500/5 dark:border-brand-500/80"
										: "border-gray-200 dark:border-gray-700"
								}`}
							>
								<button
									type="button"
									onClick={() => handleSelect(sound.file)}
									className="flex min-w-0 flex-1 items-center gap-2 text-left"
									aria-pressed={isSelected}
								>
									<span
										className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
											isSelected
												? "border-brand-500 bg-brand-500 text-white"
												: "border-gray-300 dark:border-gray-600"
										}`}
									>
										{isSelected ? <Check className="h-3 w-3" aria-hidden /> : null}
									</span>
									<span className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
										{sound.label}
									</span>
								</button>

								<button
									type="button"
									onClick={() => handlePreview(sound.file)}
									disabled={isPlaying}
									className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
									aria-label={`Preview ${sound.label}`}
								>
									<Play className="h-3.5 w-3.5" aria-hidden />
									{isPlaying ? "Playing..." : "Play"}
								</button>
							</li>
						);
					})}
				</ul>
			)}

			{!isPending && selectedSound !== DEFAULT_NOTIFICATION_SOUND && (
				<p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Current: {formatNotificationSoundLabel(selectedSound)}
				</p>
			)}
		</div>
	);
}
