import type { TTSModel } from '@/types/config/tts'

import { i18n } from '#imports'
import { Input } from '@repo/ui/components/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useAtom, useAtomValue } from 'jotai'
import { z } from 'zod'
import ValidatedInput from '@/components/ui/validated-input'
import { ttsModelSchema } from '@/types/config/tts'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

const TTS_MODELS = ttsModelSchema.options
const SPEED_SCHEMA = z.coerce.number().min(0.25).max(4)

export function TtsConfig() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)
  const isBetaEnabled = betaExperienceConfig.enabled

  return (
    <ConfigCard title={i18n.t('options.config.tts.title')} description={i18n.t('options.config.tts.description')}>
      <div className="space-y-4">
        {!isBetaEnabled && (
          <p className="text-sm text-muted-foreground">
            {i18n.t('options.config.tts.betaDisabled')}
          </p>
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
          <Input
            id="ttsVoice"
            value={ttsConfig.voice}
            placeholder={i18n.t('options.config.tts.voice.placeholder')}
            disabled={!isBetaEnabled}
            onChange={(event) => {
              if (!isBetaEnabled) {
                return
              }
              void setTtsConfig({ voice: event.target.value })
            }}
          />
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
