import type { Config } from '@/types/config/config'
import { ISO6393_TO_6391, RTL_LANG_CODES } from '@repo/definitions'
import { getFinalSourceCode } from '@/utils/config/languages'

function getLanguageDirection(langCode: string): 'ltr' | 'rtl' {
  return RTL_LANG_CODES.includes(langCode as typeof RTL_LANG_CODES[number]) ? 'rtl' : 'ltr'
}

export function setTranslationLangAndDir(element: HTMLElement, config: Config): void {
  const targetCode = config.language.targetCode
  const sourceCode = getFinalSourceCode(config.language.sourceCode, config.language.detectedCode)

  // Set lang attribute for target languages
  const langAttr = ISO6393_TO_6391[targetCode]
  if (langAttr) {
    element.setAttribute('lang', langAttr)
  }

  // Only set dir attribute when source and target languages have different directions
  const sourceDir = getLanguageDirection(sourceCode)
  const targetDir = getLanguageDirection(targetCode)

  if (sourceDir !== targetDir) {
    element.setAttribute('dir', targetDir)
  }

  // If directions are the same, don't set dir attribute
}
