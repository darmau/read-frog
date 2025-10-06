import { z } from 'zod'

export const ttsModelSchema = z.enum([
  'tts-1',
  'tts-1-hd',
  'gpt-4o-mini-tts',
])

export const ttsConfigSchema = z.object({
  model: ttsModelSchema,
  voice: z.string().min(1),
  speed: z.number().min(0.25).max(4),
})

export type TTSModel = z.infer<typeof ttsModelSchema>
export type TTSConfig = z.infer<typeof ttsConfigSchema>
