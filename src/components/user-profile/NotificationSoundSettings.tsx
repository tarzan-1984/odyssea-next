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
import { useQueryClient } from "@tanstack/react-query";
import { S3Uploader } from "@/app-api/S3Uploader";

export default function NotificationSoundSettings() {
	const selectedSound = useAdminNotificationSoundStore(s => s.selectedNotificationSound);
	const setSelectedSound = useAdminNotificationSoundStore(s => s.setSelectedNotificationSound);
	const volume = useAdminNotificationSoundStore(s => s.notificationSoundVolume);
	const setVolume = useAdminNotificationSoundStore(s => s.setNotificationSoundVolume);
	const { data: sounds = [], isPending } = useNotificationSoundsQuery();
	const queryClient = useQueryClient();
	const [playingFile, setPlayingFile] = useState<string | null>(null);
	const previewAudioRef = useRef<HTMLAudioElement | null>(null);
	const uploadInputRef = useRef<HTMLInputElement | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [deletingFile, setDeletingFile] = useState<string | null>(null);

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
			audio.volume = volume;
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

	const refreshSounds = useCallback(() => {
		return queryClient.invalidateQueries({ queryKey: ["notification-sounds"] }).catch(() => {});
	}, [queryClient]);

	const handleUploadClick = useCallback(() => {
		uploadInputRef.current?.click();
	}, []);

	const handleUploadChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const MAX_BYTES = Math.round(1.5 * 1024 * 1024);
			if (file.size > MAX_BYTES) {
				alert("Max file size is 1.5MB");
				if (uploadInputRef.current) uploadInputRef.current.value = "";
				return;
			}
			const lowerName = file.name.toLowerCase();
			if (!lowerName.endsWith(".mp3") && !lowerName.endsWith(".wav")) {
				alert("Only .mp3 or .wav files are allowed");
				if (uploadInputRef.current) uploadInputRef.current.value = "";
				return;
			}
			try {
				setIsUploading(true);
				const uploader = new S3Uploader();
				const uploaded = await uploader.upload(file, { filename: file.name });
				const res = await fetch("/api/sounds", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fileUrl: uploaded.fileUrl,
						key: uploaded.key,
						fileName: file.name,
						fileSize: file.size,
					}),
				});
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				if (!res.ok) throw new Error(data?.error || "Upload failed");
				await refreshSounds();
			} catch (err) {
				alert(err instanceof Error ? err.message : "Upload failed");
			} finally {
				setIsUploading(false);
				if (uploadInputRef.current) uploadInputRef.current.value = "";
			}
		},
		[refreshSounds]
	);

	const handleDelete = useCallback(
		async (soundId: string, soundFile: string) => {
			try {
				setDeletingFile(soundId);
				const res = await fetch(`/api/sounds?id=${encodeURIComponent(soundId)}`, {
					method: "DELETE",
				});
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				if (!res.ok) {
					throw new Error(data?.error || "Delete failed");
				}
				if (selectedSound === soundFile) {
					setSelectedSound(DEFAULT_NOTIFICATION_SOUND);
				}
				await refreshSounds();
			} catch (err) {
				alert(err instanceof Error ? err.message : "Delete failed");
			} finally {
				setDeletingFile(null);
			}
		},
		[refreshSounds, selectedSound, setSelectedSound]
	);

	const standardSounds = sounds.filter(s => !s.isUserOwned);
	const customSounds = sounds.filter(s => s.isUserOwned);

	return (
		<div className="flex h-full min-w-0 flex-col rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
			<input
				ref={uploadInputRef}
				type="file"
				accept="audio/mpeg,audio/wav,.mp3,.wav"
				className="hidden"
				onChange={handleUploadChange}
			/>
			<div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
				<div className="min-w-0">
					<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Notification sound
					</h4>
					<p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
						Choose the sound played for new messages and notifications. Saved in this browser.
					</p>
				</div>

				<div className="flex w-full min-w-0 flex-col gap-3 min-[520px]:w-auto min-[520px]:shrink-0 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-end min-[520px]:gap-4">
					<button
						type="button"
						onClick={handleUploadClick}
						disabled={isUploading || isPending}
						className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
					>
						{isUploading ? "Uploading..." : "Add sound"}
					</button>

					<div className="w-full min-[520px]:w-[220px]">
					<p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
						Volume: {Math.round((volume ?? 0.7) * 100)}%
					</p>
					<input
						type="range"
						min={0}
						max={100}
						step={5}
						value={Math.round((volume ?? 0.7) * 100)}
						onChange={e => {
							const next = Number(e.target.value) / 100;
							setVolume(next);
						}}
						className="w-full accent-brand-500"
						aria-label="Notification sound volume"
					/>
					</div>
				</div>
			</div>

			{isPending ? (
				<p className="text-sm text-gray-500 dark:text-gray-400">Loading sounds...</p>
			) : (
				<div className="space-y-5">
					{customSounds.length > 0 ? (
						<div>
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Custom sounds
							</p>
							<ul className="space-y-2">
								{customSounds.map(sound => {
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
													{isSelected ? (
														<Check className="h-3 w-3" aria-hidden />
													) : null}
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
											<button
												type="button"
										onClick={() => {
											if (!sound.id) return;
											handleDelete(sound.id, sound.file);
										}}
										disabled={!sound.id || deletingFile === sound.id}
												className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
												aria-label={`Delete ${sound.label}`}
											>
										{deletingFile === sound.id ? "Deleting..." : "Delete"}
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					) : null}

					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Standard sounds
						</p>
						<ul className="space-y-2">
							{standardSounds.map(sound => {
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
												{isSelected ? (
													<Check className="h-3 w-3" aria-hidden />
												) : null}
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
					</div>
				</div>
			)}

			{!isPending && selectedSound !== DEFAULT_NOTIFICATION_SOUND && (
				<p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Current:{" "}
					{/^https?:\/\//i.test(selectedSound)
						? "Custom sound"
						: formatNotificationSoundLabel(selectedSound)}
				</p>
			)}
		</div>
	);
}
