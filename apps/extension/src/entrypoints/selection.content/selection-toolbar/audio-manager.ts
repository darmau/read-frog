/**
 * Shared audio manager for TTS playback
 * Ensures only one audio can play at a time across all components
 */

// Keep track of the currently playing audio to prevent multiple audios playing at once
let currentAudio: HTMLAudioElement | null = null

/**
 * Get the currently playing audio instance
 */
export function getCurrentAudio(): HTMLAudioElement | null {
  return currentAudio
}

/**
 * Set the currently playing audio instance
 */
export function setCurrentAudio(audio: HTMLAudioElement | null): void {
  currentAudio = audio
}

/**
 * Stop the currently playing audio if any
 */
export function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}
