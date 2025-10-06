import type { TTSModel } from '@/types/config/tts'

/**
 * Shared audio manager for TTS playback
 * Ensures only one audio can play at a time across all components
 */

// OpenAI TTS API has a 4096 character limit
const MAX_TTS_CHARACTERS = 4096

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

/**
 * Split text into chunks that fit within the TTS API character limit
 * Tries to split on sentence boundaries for better audio quality
 */
export function splitTextForTTS(text: string, maxChars: number = MAX_TTS_CHARACTERS): string[] {
  if (text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []
  // Split by sentence boundaries (., !, ?, \n)
  const sentences = text.split(/([.!?\n]+\s*)/)
  let currentChunk = ''

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    if (!sentence)
      continue

    // If a single sentence is longer than maxChars, we need to split it further
    if (sentence.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      // Split long sentence by words
      const words = sentence.split(/(\s+)/)
      for (const word of words) {
        if (currentChunk.length + word.length > maxChars) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = word
        }
        else {
          currentChunk += word
        }
      }
    }
    else if (currentChunk.length + sentence.length > maxChars) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    }
    else {
      currentChunk += sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * Fetch audio from OpenAI TTS API
 */
export async function fetchAudioFromAPI(
  text: string,
  apiKey: string,
  baseURL: string,
  model: TTSModel,
  voice: string,
  speed: number,
): Promise<Blob> {
  const response = await fetch(`${baseURL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      speed,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`)
  }

  return await response.blob()
}

interface CachedAudio {
  url: string
  blob: Blob
}

interface AudioCacheInterface {
  get: (key: string) => CachedAudio | undefined
  set: (key: string, value: CachedAudio) => void
}

/**
 * Play text using TTS with automatic chunking for long texts
 * Supports caching to avoid redundant API calls
 */
export async function playTextWithTTS(
  text: string,
  apiKey: string,
  baseURL: string,
  model: TTSModel,
  voice: string,
  speed: number,
  audioCache: AudioCacheInterface,
): Promise<void> {
  // Stop any currently playing audio before starting new one
  stopCurrentAudio()

  // Split text into chunks if necessary
  const textChunks = splitTextForTTS(text)

  // If text is split into multiple chunks, we need to play them sequentially
  if (textChunks.length > 1) {
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      const cacheKey = JSON.stringify({ text: chunk, model, voice, speed })
      const cached = audioCache.get(cacheKey)
      let audioBlob: Blob
      let audioUrl: string

      if (cached) {
        audioBlob = cached.blob
        audioUrl = cached.url
      }
      else {
        audioBlob = await fetchAudioFromAPI(chunk, apiKey, baseURL, model, voice, speed)
        audioUrl = URL.createObjectURL(audioBlob)
        audioCache.set(cacheKey, { url: audioUrl, blob: audioBlob })
      }

      // Play audio chunk and wait for it to finish
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl)
        setCurrentAudio(audio)

        audio.onended = () => {
          if (getCurrentAudio() === audio) {
            setCurrentAudio(null)
          }
          resolve()
        }

        audio.onerror = () => {
          if (getCurrentAudio() === audio) {
            setCurrentAudio(null)
          }
          reject(new Error('Audio playback error'))
        }

        audio.play().catch(reject)
      })
    }
  }
  else {
    // Single chunk - simpler logic
    const cacheKey = JSON.stringify({ text, model, voice, speed })
    const cached = audioCache.get(cacheKey)
    let audioBlob: Blob
    let audioUrl: string

    if (cached) {
      audioBlob = cached.blob
      audioUrl = cached.url
    }
    else {
      audioBlob = await fetchAudioFromAPI(text, apiKey, baseURL, model, voice, speed)
      audioUrl = URL.createObjectURL(audioBlob)
      audioCache.set(cacheKey, { url: audioUrl, blob: audioBlob })
    }

    const audio = new Audio(audioUrl)
    setCurrentAudio(audio)

    const cleanup = () => {
      audio.onended = null
      audio.onerror = null
      if (getCurrentAudio() === audio) {
        setCurrentAudio(null)
      }
    }

    audio.onended = cleanup
    audio.onerror = cleanup

    await audio.play()
  }
}
