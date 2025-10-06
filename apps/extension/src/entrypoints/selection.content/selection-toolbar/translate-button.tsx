import type { TextUIPart } from 'ai'
import type { TTSModel } from '@/types/config/tts'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@repo/definitions'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { readUIMessageStream, streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { isLLMTranslateProviderConfig, isNonAPIProvider, isPureAPIProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { translateProviderConfigAtom } from '@/utils/atoms/provider'
import { authClient } from '@/utils/auth/auth-client'
import { getConfigFromStorage } from '@/utils/config/config'
import { getProviderApiKey, getProviderBaseURL } from '@/utils/config/helpers'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { getProviderOptions } from '@/utils/constants/model'
import { WEBSITE_URL } from '@/utils/constants/url'
import { LRUCache } from '@/utils/data-structure/rlu'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { sendMessage } from '@/utils/message'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'
import { trpc } from '@/utils/trpc/client'
import { isTooltipVisibleAtom, isTranslatePopoverVisibleAtom, mouseClickPositionAtom, selectionContentAtom } from './atom'
import { getCurrentAudio, setCurrentAudio, stopCurrentAudio } from './audio-manager'
import { PopoverWrapper } from './components/popover-wrapper'

// OpenAI TTS API has a 4096 character limit
const MAX_TTS_CHARACTERS = 4096

interface CachedAudio {
  url: string
  blob: Blob
}

interface SpeakMutationVariables {
  apiKey: string
  baseURL: string
  text: string
  model: TTSModel
  voice: string
  speed: number
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

/**
 * Split text into chunks that fit within the TTS API character limit
 * Tries to split on sentence boundaries for better audio quality
 */
function splitTextForTTS(text: string, maxChars: number = MAX_TTS_CHARACTERS): string[] {
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
async function fetchAudioFromAPI(
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

export function TranslateButton() {
  // const selectionContent = useAtomValue(selectionContentAtom)
  const setIsTooltipVisible = useSetAtom(isTooltipVisibleAtom)
  const setIsTranslatePopoverVisible = useSetAtom(isTranslatePopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)

  const handleClick = async (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.top

    setMousePosition({ x, y })
    setIsTooltipVisible(false)
    setIsTranslatePopoverVisible(true)
  }

  return (
    <button type="button" className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer" onClick={handleClick}>
      <Icon icon="ri:translate" strokeWidth={0.8} className="size-4" />
    </button>
  )
}

export function TranslatePopover() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)
  const languageConfig = useAtomValue(configFieldsAtomMap.language)
  const selectionContent = useAtomValue(selectionContentAtom)
  const [isVisible, setIsVisible] = useAtom(isTranslatePopoverVisibleAtom)
  const { data: session } = authClient.useSession()
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)

  const openaiProvider = providersConfig.find(p => p.provider === 'openai' && p.enabled)
  const hasOpenAIKey = openaiProvider && getProviderApiKey(providersConfig, openaiProvider.id)

  const createVocabulary = useMutation({
    ...trpc.vocabulary.create.mutationOptions(),
    onSuccess: () => {
      toast.success(`Translation saved successfully! Please go to ${WEBSITE_URL}/vocabulary to view it.`)
    },
  })

  const speakMutation = useMutation<void, Error, SpeakMutationVariables, { toastId: string | number }>({
    mutationFn: async ({ text, apiKey, baseURL, model, voice, speed }) => {
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
        // Single chunk - use the same logic as speak-button
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
    },
    onMutate: () => {
      const toastId = toast.loading(i18n.t('speak.fetchingAudio'))
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.toastId) {
        toast.success(i18n.t('speak.playingAudio'), { id: context.toastId })
      }
    },
    onError: (error, _variables, context) => {
      if (context?.toastId) {
        toast.dismiss(context.toastId)
      }
      console.error('TTS error:', error)
      toast.error(error.message || i18n.t('speak.failedToGenerateSpeech'))
      setCurrentAudio(null)
    },
  })

  const handleClose = useCallback(() => {
    setTranslatedText(undefined)
  }, [])

  const handleCopy = useCallback(() => {
    if (translatedText) {
      void navigator.clipboard.writeText(translatedText)
      toast.success('Translation copied to clipboard!')
    }
  }, [translatedText])

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) {
      await sendMessage('openPage', { url: `${WEBSITE_URL}/log-in`, active: true })
      return
    }

    if (!selectionContent || !translatedText) {
      toast.error('No content to save')
      return
    }

    const config = await getConfigFromStorage()
    if (!config) {
      toast.error('Configuration not loaded')
      return
    }

    try {
      await createVocabulary.mutateAsync({
        originalText: selectionContent,
        translation: translatedText,
        sourceLanguageISO6393: config.language.sourceCode === 'auto' ? 'eng' : config.language.sourceCode,
        targetLanguageISO6393: config.language.targetCode,
      })
    }
    catch {
      // Error handled by mutation
    }
  }, [session?.user?.id, selectionContent, translatedText, createVocabulary])

  const handleSpeak = useCallback(() => {
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
    const { model, voice, speed } = betaExperienceConfig.enabled ? ttsConfig : DEFAULT_CONFIG.tts

    speakMutation.mutate({
      apiKey,
      baseURL,
      text: selectionContent,
      model,
      voice,
      speed,
    })
  }, [selectionContent, providersConfig, openaiProvider, speakMutation, ttsConfig, betaExperienceConfig])

  useEffect(() => {
    const translate = async () => {
      const cleanText = selectionContent?.replace(/\u200B/g, '').trim()
      if (!cleanText) {
        return
      }

      const config = await getConfigFromStorage()
      if (!config) {
        throw new Error('No global config when translate text')
      }

      if (!translateProviderConfig) {
        throw new Error(`No provider config for ${config.translate.providerId} when translate text`)
      }

      const { provider } = translateProviderConfig

      setIsTranslating(true)

      try {
        let translatedText = ''

        if (isNonAPIProvider(provider)) {
          const sourceLang = languageConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto')
          const targetLang = ISO6393_TO_6391[languageConfig.targetCode]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${languageConfig.targetCode}`)
          }

          if (provider === 'google') {
            translatedText = await googleTranslate(cleanText, sourceLang, targetLang)
          }
          else if (provider === 'microsoft') {
            translatedText = await microsoftTranslate(cleanText, sourceLang, targetLang)
          }
        }
        else if (isPureAPIProvider(provider)) {
          const sourceLang = languageConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto')
          const targetLang = ISO6393_TO_6391[languageConfig.targetCode]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${languageConfig.targetCode}`)
          }

          if (provider === 'deeplx') {
            translatedText = await deeplxTranslate(cleanText, sourceLang, targetLang, translateProviderConfig, { forceBackgroundFetch: true })
          }
        }
        else if (isLLMTranslateProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
          const { id: providerId, models: { translate } } = translateProviderConfig
          const translateModel = translate.isCustomModel ? translate.customModel : translate.model
          const model = await getTranslateModelById(providerId)

          // Configure ultrathink for thinking models
          const providerOptions = getProviderOptions(translateModel ?? '')
          const prompt = await getTranslatePrompt(targetLangName, cleanText)

          // Use streaming for AI providers
          const result = streamText({
            model,
            prompt,
            providerOptions,
          })

          for await (const uiMessage of readUIMessageStream({
            stream: result.toUIMessageStream(),
          })) {
            const lastPart = uiMessage.parts[uiMessage.parts.length - 1] as TextUIPart
            setTranslatedText(lastPart.text)
          }
        }
        else {
          throw new Error(`Unknown provider: ${provider}`)
        }

        // Set final text if not streaming
        if (translatedText && !isLLMTranslateProviderConfig(translateProviderConfig)) {
          translatedText = translatedText.trim()
          setTranslatedText(translatedText === cleanText ? '' : translatedText)
        }
      }
      catch (error) {
        console.error('Translation error:', error)
        toast.error('Translation failed')
      }
      finally {
        setIsTranslating(false)
      }
    }

    if (isVisible) {
      void translate()
    }
  }, [isVisible, selectionContent, languageConfig.sourceCode, languageConfig.targetCode, translateProviderConfig])

  return (
    <PopoverWrapper
      title="Translation"
      icon="ri:translate"
      onClose={handleClose}
      isVisible={isVisible}
      setIsVisible={setIsVisible}
    >
      <div className="p-4 border-b">
        <div className="border-b pb-4"><p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p></div>
        <div className="pt-4">
          <p className="text-sm">
            {isTranslating && !translatedText && <Icon icon="svg-spinners:3-dots-bounce" />}
            {translatedText}
            {isTranslating && translatedText && ' ●'}
          </p>
        </div>
      </div>
      <div className="p-4 flex justify-between items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={!translatedText || createVocabulary.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded"
        >
          {createVocabulary.isPending
            ? (
                <Icon icon="svg-spinners:3-dots-bounce" className="size-4" />
              )
            : (
                <Icon icon="tabler:bookmark-plus" strokeWidth={1} className="size-4" />
              )}
          {createVocabulary.isPending ? 'Saving...' : 'Save'}
        </button>
        <div className="flex items-center gap-2">
          {hasOpenAIKey && (
            <button
              type="button"
              onClick={handleSpeak}
              disabled={!selectionContent || speakMutation.isPending}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Speak original text"
            >
              {speakMutation.isPending
                ? (
                    <IconLoader2 className="size-4 text-zinc-600 dark:text-zinc-400 animate-spin" strokeWidth={1.6} />
                  )
                : (
                    <IconVolume className="size-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                  )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
          >
            <Icon icon="tabler:copy" strokeWidth={1} className="size-4 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>
      </div>
    </PopoverWrapper>
  )
}
