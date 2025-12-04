import { useCallback, useRef } from 'react';

export const useNotificationSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUserInteracted = useRef(false);

  const playNotificationSound = useCallback(() => {
    try {
      // Check if user has interacted with the page
      if (!hasUserInteracted.current) {
        return;
      }

      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/livechat.mp3');
        audioRef.current.volume = 0.7; // 70% volume
        audioRef.current.preload = 'auto';
      }

      // Reset audio to beginning and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Silent fail for audio playback errors
        if (error.name === 'NotAllowedError') {
          // Audio blocked by browser policy
        }
      });
    } catch (error) {
      // Silent fail for audio creation errors
    }
  }, []);

  // Function to enable audio after user interaction
  const enableAudio = useCallback(() => {
    hasUserInteracted.current = true;
  }, []);

  return { playNotificationSound, enableAudio };
};
