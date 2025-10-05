import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderApiKey, getProviderBaseURL } from '@/utils/config/helpers'
import { isTooltipVisibleAtom, selectionContentAtom } from './atom'

export function SpeakButton() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const selectionContent = useAtomValue(selectionContentAtom)
  const setIsTooltipVisible = useSetAtom(isTooltipVisibleAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const handleClick = useCallback(async () => {
    if (!selectionContent) {
      toast.error('No text selected')
      return
    }

    // Check if OpenAI is configured
    const openaiProvider = providersConfig.find(p => p.provider === 'openai' && p.enabled)
    if (!openaiProvider) {
      toast.error('OpenAI provider is not configured or enabled')
      return
    }

    const apiKey = getProviderApiKey(providersConfig, openaiProvider.id)
    if (!apiKey) {
      toast.error('OpenAI API key is not configured')
      return
    }

    setIsSpeaking(true)
    setIsTooltipVisible(false)

    try {
      const baseURL = getProviderBaseURL(providersConfig, openaiProvider.id) || 'https://api.openai.com/v1'

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

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
        toast.error('Failed to play audio')
      }

      await audio.play()
      toast.success('Playing audio...')
    }
    catch (error) {
      console.error('TTS error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate speech')
      setIsSpeaking(false)
    }
  }, [selectionContent, providersConfig, setIsTooltipVisible])

  // Don't render the button if OpenAI is not configured
  const openaiProvider = providersConfig.find(p => p.provider === 'openai' && p.enabled)
  const hasApiKey = openaiProvider && getProviderApiKey(providersConfig, openaiProvider.id)

  if (!hasApiKey) {
    return null
  }

  return (
    <button
      type="button"
      className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={isSpeaking}
      title="Speak selected text"
    >
      {isSpeaking
        ? (
            <Icon icon="eos-icons:loading" className="size-4" />
          )
        : (
            <Icon icon="material-symbols:volume-up" className="size-4" />
          )}
    </button>
  )
}
