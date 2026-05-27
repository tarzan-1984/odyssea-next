import { useCallback, useRef } from 'react';
import {
  getSelectedNotificationSoundFile,
  isNotificationSoundMuted,
  getNotificationSoundVolume,
} from '@/stores/adminNotificationSoundStore';
import { notificationSoundUrl } from '@/constants/notificationSounds';

export const useNotificationSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedSoundFileRef = useRef<string | null>(null);
  const hasUserInteracted = useRef(false);

  const ensureAudioElement = useCallback(() => {
    const soundFile = getSelectedNotificationSoundFile();
    const url = notificationSoundUrl(soundFile);
    const volume = getNotificationSoundVolume();

    if (!audioRef.current || loadedSoundFileRef.current !== soundFile) {
      audioRef.current = new Audio(url);
      audioRef.current.volume = volume;
      audioRef.current.preload = 'auto';
      loadedSoundFileRef.current = soundFile;
    }
    // Keep volume in sync even when reusing the same Audio instance.
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    return audioRef.current;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (isNotificationSoundMuted()) {
        return;
      }

      // Check if user has interacted with the page
      if (!hasUserInteracted.current) {
        return;
      }

      const audio = ensureAudioElement();

      // Reset audio to beginning and play
      audio.currentTime = 0;
      audio.play().catch((error) => {
        // Silent fail for audio playback errors
        if (error.name === 'NotAllowedError') {
          // Audio blocked by browser policy
        }
      });
    } catch (error) {
      // Silent fail for audio creation errors
    }
  }, [ensureAudioElement]);

  // Function to enable audio after user interaction
  const enableAudio = useCallback(() => {
    hasUserInteracted.current = true;
  }, []);

  return { playNotificationSound, enableAudio };
};
