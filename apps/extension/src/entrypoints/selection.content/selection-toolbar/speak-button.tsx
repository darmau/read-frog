import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderApiKey, getProviderBaseURL } from '@/utils/config/helpers'
import { isTooltipVisibleAtom, selectionContentAtom } from './atom'

interface SpeakMutationVariables {
  apiKey: string
  baseURL: string
  selectionContent: string
}

export function SpeakButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const setIsTooltipVisible = useSetAtom(isTooltipVisibleAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const openaiProvider = providersConfig.find(p => p.provider === 'openai' && p.enabled)

  const speakMutation = useMutation<void, Error, SpeakMutationVariables>({
    mutationFn: async ({ selectionContent, apiKey, baseURL }) => {
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

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.onended = null
          audio.onerror = null
          URL.revokeObjectURL(audioUrl)
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
          .then(() => {
            toast.success('Playing audio...')
          })
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
      toast.error(error.message || 'Failed to generate speech')
    },
  })

  const { mutate, isPending } = speakMutation

  const handleClick = useCallback(() => {
    if (!selectionContent) {
      toast.error('No text selected')
      return
    }

    if (!openaiProvider) {
      toast.error('OpenAI provider is not configured or enabled')
      return
    }

    const apiKey = getProviderApiKey(providersConfig, openaiProvider.id)
    if (!apiKey) {
      toast.error('OpenAI API key is not configured')
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
