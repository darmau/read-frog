import type { TTSModel } from '@/types/config/tts'

import { i18n } from '#imports'
import { Button } from '@repo/ui/components/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import ValidatedInput from '@/components/ui/validated-input'
import { ttsModelSchema } from '@/types/config/tts'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderApiKey, getProviderBaseURL } from '@/utils/config/helpers'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

const TTS_MODELS = ttsModelSchema.options
const SPEED_SCHEMA = z.coerce.number().min(0.25).max(4)
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

interface OpenAIVoice {
  id: string
  name: string
}

const AVAILABLE_OPENAI_VOICES: ReadonlyArray<OpenAIVoice> = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'ash', name: 'Ash' },
  { id: 'ballad', name: 'Ballad' },
  { id: 'coral', name: 'Coral' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'nova', name: 'Nova' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'sage', name: 'Sage' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'verse', name: 'Verse' },
]

export function TtsConfig() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const isBetaEnabled = betaExperienceConfig.enabled

  const openaiProvider = useMemo(() => providersConfig.find(provider => provider.provider === 'openai'), [providersConfig])
  const openaiProviderId = openaiProvider?.id

  const apiKey = useMemo(() => openaiProviderId ? getProviderApiKey(providersConfig, openaiProviderId) : undefined, [providersConfig, openaiProviderId])

  const baseURL = useMemo(() => {
    if (!openaiProviderId) {
      return undefined
    }
    const configuredBaseUrl = getProviderBaseURL(providersConfig, openaiProviderId)
    return configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : DEFAULT_OPENAI_BASE_URL
  }, [providersConfig, openaiProviderId])

  const voiceOptions = useMemo<OpenAIVoice[]>(() => {
    if (!ttsConfig.voice) {
      return [...AVAILABLE_OPENAI_VOICES]
    }
    const exists = AVAILABLE_OPENAI_VOICES.some(voice => voice.id === ttsConfig.voice)
    if (exists) {
      return [...AVAILABLE_OPENAI_VOICES]
    }
    return [...AVAILABLE_OPENAI_VOICES, { id: ttsConfig.voice, name: ttsConfig.voice }]
  }, [ttsConfig.voice])

  const hasApiKey = Boolean(apiKey)
  const voiceSelectDisabled = !isBetaEnabled

  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const cleanupPreviewAudio = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
  }, [])

  useEffect(() => () => {
    cleanupPreviewAudio()
  }, [cleanupPreviewAudio])

  const handleVoiceChange = useCallback((value: string) => {
    if (!isBetaEnabled) {
      return
    }
    void setTtsConfig({ voice: value })
  }, [isBetaEnabled, setTtsConfig])

  const handlePreviewVoice = useCallback(async () => {
    if (!isBetaEnabled) {
      return
    }
    if (!ttsConfig.voice) {
      toast.error(i18n.t('options.config.tts.voice.selectVoiceFirst'))
      return
    }
    if (!apiKey) {
      toast.error(i18n.t('speak.openaiApiKeyNotConfigured'))
      return
    }

    setIsPreviewing(true)
    cleanupPreviewAudio()

    try {
      const normalizedBaseURL = (baseURL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '')
      const previewText = i18n.t('options.config.tts.voice.previewSample')

      const response = await fetch(`${normalizedBaseURL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ttsConfig.model,
          input: previewText,
          voice: ttsConfig.voice,
          speed: ttsConfig.speed,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      previewObjectUrlRef.current = audioUrl

      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio

      audio.onended = () => {
        cleanupPreviewAudio()
      }

      audio.onerror = () => {
        cleanupPreviewAudio()
        toast.error(i18n.t('options.config.tts.voice.previewError'))
      }

      await audio.play()
    }
    catch (error) {
      cleanupPreviewAudio()
      const message = error instanceof Error && error.message ? error.message : i18n.t('options.config.tts.voice.previewError')
      toast.error(message)
    }
    finally {
      setIsPreviewing(false)
    }
  }, [apiKey, baseURL, cleanupPreviewAudio, isBetaEnabled, ttsConfig.model, ttsConfig.speed, ttsConfig.voice])

  return (
    <ConfigCard title={i18n.t('options.config.tts.title')} description={i18n.t('options.config.tts.description')}>
      <div className="space-y-4">
        {!isBetaEnabled && (
          <p className="text-sm text-muted-foreground">
            {i18n.t('options.config.tts.betaDisabled')}
          </p>
        )}
        {!hasApiKey && (
          <SetApiKeyWarning />
        )}
        <FieldWithLabel id="ttsModel" label={i18n.t('options.config.tts.model.label')}>
          <Select
            value={ttsConfig.model}
            onValueChange={(value) => {
              if (!isBetaEnabled) {
                return
              }
              void setTtsConfig({ model: value as TTSModel })
            }}
          >
            <SelectTrigger className="w-full" disabled={!isBetaEnabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TTS_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldWithLabel>
        <FieldWithLabel id="ttsVoice" label={i18n.t('options.config.tts.voice.label')}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex flex-1 items-center gap-2">
              <Select value={ttsConfig.voice} onValueChange={handleVoiceChange}>
                <SelectTrigger
                  id="ttsVoice"
                  className="w-full"
                  disabled={voiceSelectDisabled}
                >
                  <SelectValue placeholder={i18n.t('options.config.tts.voice.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {voiceOptions.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="sm:w-auto"
              onClick={handlePreviewVoice}
              disabled={!isBetaEnabled || !ttsConfig.voice || !hasApiKey || isPreviewing}
            >
              {isPreviewing ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconPlayerPlayFilled className="mr-2 size-4" />}
              {i18n.t('options.config.tts.voice.preview')}
            </Button>
          </div>
        </FieldWithLabel>
        <FieldWithLabel id="ttsSpeed" label={i18n.t('options.config.tts.speed.label')}>
          <ValidatedInput
            id="ttsSpeed"
            type="number"
            step="0.05"
            min={0.25}
            max={4}
            value={ttsConfig.speed}
            schema={SPEED_SCHEMA}
            disabled={!isBetaEnabled}
            onChange={(event) => {
              if (!isBetaEnabled) {
                return
              }
              void setTtsConfig({ speed: Number(event.target.value) })
            }}
          />
          <p className="text-xs text-muted-foreground">
            {i18n.t('options.config.tts.speed.hint')}
          </p>
        </FieldWithLabel>
      </div>
    </ConfigCard>
  )
}
