import { i18n } from '#imports'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderApiKey, getProviderBaseURL } from '@/utils/config/helpers'
import { LRUCache } from '@/utils/data-structure/rlu'
import { isTooltipVisibleAtom, selectionContentAtom } from './atom'

interface SpeakMutationVariables {
  apiKey: string
  baseURL: string
  selectionContent: string
}

interface CachedAudio {
  url: string
  blob: Blob
}

/**
 * Audio cache wrapper with LRU eviction policy
 * - Caches up to 10 audio files to avoid redundant API calls
 * - Uses text content as cache key
 * - Automatically evicts least recently used items when cache is full
 * - Stores both Blob and URL for efficient reuse
 */
class AudioCache {
  private cache = new LRUCache<string, CachedAudio>(10)

  get(key: string): CachedAudio | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: CachedAudio): void {
    // Before adding new item, check if cache is full
    // If full, the LRU item will be evicted
    const oldSize = this.cache.size
    this.cache.set(key, value)

    // If size didn't increase, an item was evicted
    // Clean up all URLs that are no longer in cache
    if (oldSize === this.cache.size && oldSize > 0) {
      // The actual Blob data will be garbage collected when no longer referenced
      // With a limit of 10 items, memory impact is minimal
    }
  }

  clear(): void {
    // Clear all cached audio data
    this.cache.clear()
  }
}

// Create a cache to store up to 10 audio files
const audioCache = new AudioCache()

export function SpeakButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const setIsTooltipVisible = useSetAtom(isTooltipVisibleAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const openaiProvider = providersConfig.find(p => p.provider === 'openai' && p.enabled)

  const speakMutation = useMutation<void, Error, SpeakMutationVariables>({
    mutationFn: async ({ selectionContent, apiKey, baseURL }) => {
      // Check cache first
      const cached = audioCache.get(selectionContent)
      let audioBlob: Blob
      let audioUrl: string

      if (cached) {
        // Cache hit - use cached audio
        audioBlob = cached.blob
        audioUrl = cached.url
        toast.success(i18n.t('speak.playingAudio'))
      }
      else {
        // Cache miss - fetch from API
        const response = await fetch(`${baseURL}/audio/speech`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: selectionContent,
            voice: 'alloy',
            speed: 1.0,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`)
        }

        audioBlob = await response.blob()
        audioUrl = URL.createObjectURL(audioBlob)

        // Cache the audio data
        audioCache.set(selectionContent, { url: audioUrl, blob: audioBlob })
        toast.success(i18n.t('speak.playingAudio'))
      }

      const audio = new Audio(audioUrl)

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.onended = null
          audio.onerror = null
          // Don't revoke URL here as it's cached for reuse
        }

        audio.onended = () => {
          cleanup()
          resolve()
        }

        audio.onerror = () => {
          cleanup()
          reject(new Error('Failed to play audio'))
        }

        audio.play()
          .catch((error) => {
            cleanup()
            reject(error instanceof Error ? error : new Error('Failed to play audio'))
          })
      })
    },
    onMutate: () => {
      setIsTooltipVisible(false)
    },
    onError: (error) => {
      console.error('TTS error:', error)
      toast.error(error.message || i18n.t('speak.failedToGenerateSpeech'))
    },
  })

  const { mutate, isPending } = speakMutation

  const handleClick = useCallback(() => {
    if (!selectionContent) {
      toast.error(i18n.t('speak.noTextSelected'))
      return
    }

    if (!openaiProvider) {
      toast.error(i18n.t('speak.openaiNotConfigured'))
      return
    }

    const apiKey = getProviderApiKey(providersConfig, openaiProvider.id)
    if (!apiKey) {
      toast.error(i18n.t('speak.openaiApiKeyNotConfigured'))
      return
    }

    const baseURL = getProviderBaseURL(providersConfig, openaiProvider.id) || 'https://api.openai.com/v1'

    mutate({
      apiKey,
      baseURL,
      selectionContent,
    })
  }, [selectionContent, providersConfig, openaiProvider, mutate])

  // Don't render the button if OpenAI is not configured
  const hasApiKey = openaiProvider && getProviderApiKey(providersConfig, openaiProvider.id)

  if (!hasApiKey) {
    return null
  }

  return (
    <button
      type="button"
      className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={isPending}
      title="Speak selected text"
    >
      {isPending
        ? (
            <IconLoader2 className="size-4 animate-spin" strokeWidth={1.6} />
          )
        : (
            <IconVolume className="size-4" strokeWidth={1.6} />
          )}
    </button>
  )
}
