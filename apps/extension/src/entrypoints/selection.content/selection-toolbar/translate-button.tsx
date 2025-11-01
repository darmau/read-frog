import type { LangCodeISO6393 } from '@repo/definitions'
import type { TextUIPart } from 'ai'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME, LANG_CODE_TO_LOCALE_NAME, langCodeISO6393Schema } from '@repo/definitions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { readUIMessageStream, streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { isLLMTranslateProviderConfig, isNonAPIProvider, isPureAPIProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { translateProviderConfigAtom, ttsProviderConfigAtom } from '@/utils/atoms/provider'
import { authClient } from '@/utils/auth/auth-client'
import { getConfigFromStorage } from '@/utils/config/config'
import { getProviderOptions } from '@/utils/constants/model'
import { WEBSITE_URL } from '@/utils/constants/url'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { sendMessage } from '@/utils/message'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'
import { trpc } from '@/utils/trpc/client'
import { shadowWrapper } from '../index'
import { isSelectionToolbarVisibleAtom, isTranslatePopoverVisibleAtom, mouseClickPositionAtom, selectionContentAtom } from './atom'
import { PopoverWrapper } from './components/popover-wrapper'

export function TranslateButton() {
  // const selectionContent = useAtomValue(selectionContentAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setIsTranslatePopoverVisible = useSetAtom(isTranslatePopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)

  const handleClick = async (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.top

    setMousePosition({ x, y })
    setIsSelectionToolbarVisible(false)
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

  // Local language selection state (only affects current translation)
  const [localSourceLang, setLocalSourceLang] = useState<LangCodeISO6393 | 'auto'>('auto')
  const [localTargetLang, setLocalTargetLang] = useState<LangCodeISO6393>('eng')

  const createVocabulary = useMutation({
    ...trpc.vocabulary.create.mutationOptions(),
    onSuccess: () => {
      toast.success(`Translation saved successfully! Please go to ${WEBSITE_URL}/vocabulary to view it.`)
    },
  })

  // Initialize local language state from global config when popover opens
  useEffect(() => {
    if (!isVisible) {
      return
    }

    setLocalSourceLang(prev => (isVisible ? languageConfig.sourceCode : prev))
    setLocalTargetLang(prev => (isVisible ? languageConfig.targetCode : prev))
    setTranslatedText(prev => (isVisible ? undefined : prev))
  }, [isVisible, languageConfig.sourceCode, languageConfig.targetCode])

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
        sourceLanguageISO6393: localSourceLang === 'auto' ? 'eng' : localSourceLang,
        targetLanguageISO6393: localTargetLang,
      })
    }
    catch {
      // Error handled by mutation
    }
  }, [session?.user?.id, selectionContent, translatedText, localSourceLang, localTargetLang, createVocabulary])

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
          const sourceLang = localSourceLang === 'auto' ? 'auto' : (ISO6393_TO_6391[localSourceLang] ?? 'auto')
          const targetLang = ISO6393_TO_6391[localTargetLang]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${localTargetLang}`)
          }

          if (provider === 'google') {
            translatedText = await googleTranslate(cleanText, sourceLang, targetLang)
          }
          else if (provider === 'microsoft') {
            translatedText = await microsoftTranslate(cleanText, sourceLang, targetLang)
          }
        }
        else if (isPureAPIProvider(provider)) {
          const sourceLang = localSourceLang === 'auto' ? 'auto' : (ISO6393_TO_6391[localSourceLang] ?? 'auto')
          const targetLang = ISO6393_TO_6391[localTargetLang]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${localTargetLang}`)
          }

          if (provider === 'deeplx') {
            translatedText = await deeplxTranslate(cleanText, sourceLang, targetLang, translateProviderConfig, { forceBackgroundFetch: true })
          }
        }
        else if (isLLMTranslateProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[localTargetLang]
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
  }, [isVisible, selectionContent, localSourceLang, localTargetLang, translateProviderConfig])

  const getLangLabel = useCallback((langCode: LangCodeISO6393) => {
    const localeName = LANG_CODE_TO_LOCALE_NAME[langCode]
    return localeName ?? langCode
  }, [])

  const getSourceLangLabel = useCallback(() => {
    if (localSourceLang === 'auto') {
      const detectedCode = languageConfig.detectedCode
      return `${getLangLabel(detectedCode)} (auto)`
    }
    return getLangLabel(localSourceLang)
  }, [localSourceLang, languageConfig.detectedCode, getLangLabel])

  return (
    <PopoverWrapper
      title="Translation"
      icon="ri:translate"
      onClose={handleClose}
      isVisible={isVisible}
      setIsVisible={setIsVisible}
    >
      <div className="p-4 border-b">
        <div className="border-b pb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{i18n.t('selection.original')}</span>
            <Select value={localSourceLang} onValueChange={value => setLocalSourceLang(value as LangCodeISO6393 | 'auto')}>
              <SelectTrigger className="!h-auto w-auto min-w-[100px] text-xs px-2 py-1 bg-white dark:bg-zinc-800">
                <SelectValue asChild>
                  <span className="truncate text-xs">{getSourceLangLabel()}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent container={shadowWrapper} className="max-h-[300px]">
                <SelectItem value="auto">
                  {getLangLabel(languageConfig.detectedCode)}
                  {' '}
                  <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">auto</span>
                </SelectItem>
                {langCodeISO6393Schema.options.map(code => (
                  <SelectItem key={code} value={code}>{getLangLabel(code)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p>
        </div>
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{i18n.t('selection.translation')}</span>
            <Select value={localTargetLang} onValueChange={value => setLocalTargetLang(value as LangCodeISO6393)}>
              <SelectTrigger className="!h-auto w-auto min-w-[100px] text-xs px-2 py-1 bg-white dark:bg-zinc-800">
                <SelectValue asChild>
                  <span className="truncate text-xs">{getLangLabel(localTargetLang)}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent container={shadowWrapper} className="max-h-[300px]">
                {langCodeISO6393Schema.options.map(code => (
                  <SelectItem key={code} value={code}>{getLangLabel(code)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <SpeakOriginalButton />
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

function SpeakOriginalButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const ttsProviderConfig = useAtomValue(ttsProviderConfigAtom)
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handleSpeak = useCallback(async () => {
    if (!selectionContent) {
      toast.error(i18n.t('speak.noTextSelected'))
      return
    }

    if (!ttsProviderConfig) {
      toast.error(i18n.t('speak.openaiNotConfigured'))
      return
    }

    void play(selectionContent, ttsConfig, ttsProviderConfig)
  }, [selectionContent, ttsConfig, ttsProviderConfig, play])

  if (!ttsProviderConfig) {
    return null
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={isFetching || isPlaying}
      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      title={isFetching ? 'Fetching audio…' : isPlaying ? 'Playing audio…' : 'Speak original text'}
    >
      {isFetching || isPlaying
        ? (
            <IconLoader2 className="size-4 text-zinc-600 dark:text-zinc-400 animate-spin" strokeWidth={1.6} />
          )
        : (
            <IconVolume className="size-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
          )}
    </button>
  )
}
