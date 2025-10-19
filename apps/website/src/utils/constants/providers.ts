import { getLobeIconsCDNUrlFn } from '../logo'

export interface Provider { id: string, logo: (isDark: boolean) => string }

export const CUSTOM_LLM_PROVIDER_NAMES = ['customProvider', 'openaiCompatible', 'tensdaq', 'siliconflow', 'ai302'] as const

export type CustomLLMProviderNames = typeof CUSTOM_LLM_PROVIDER_NAMES[number]

export const CUSTOM_PROVIDER_ITEMS: Record<CustomLLMProviderNames, Provider> = {
  customProvider: {
    id: 'Custom Provider',
    logo: () => '/providers/custom-provider.svg',
  },
  openaiCompatible: {
    id: 'OpenAI Compatible',
    logo: (isDark: boolean) => isDark ? '/providers/openai-compatible-dark.svg' : '/providers/openai-compatible-light.svg',
  },
  tensdaq: {
    id: 'TensDAQ',
    logo: () => '/providers/tensdaq-color.svg',
  },
  siliconflow: {
    id: 'SiliconFlow',
    logo: getLobeIconsCDNUrlFn('siliconcloud-color'),
  },
  ai302: {
    id: '302.AI',
    logo: getLobeIconsCDNUrlFn('ai302-color'),
  },
}

export const NON_CUSTOM_LLM_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter'] as const

export type NonCustomLLMProviderNames = typeof NON_CUSTOM_LLM_PROVIDER_NAMES[number]

export const NON_CUSTOM_LLM_PROVIDER_ITEMS: Record<NonCustomLLMProviderNames, Provider> = {
  openai: {
    id: 'OpenAI',
    logo: getLobeIconsCDNUrlFn('openai'),
  },
  openrouter: {
    id: 'OpenRouter',
    logo: getLobeIconsCDNUrlFn('openrouter'),
  },
  deepseek: {
    id: 'DeepSeek',
    logo: getLobeIconsCDNUrlFn('deepseek-color'),
  },
  gemini: {
    id: 'Gemini',
    logo: getLobeIconsCDNUrlFn('gemini-color'),
  },
  anthropic: {
    id: 'Anthropic',
    logo: getLobeIconsCDNUrlFn('anthropic'),
  },
  grok: {
    id: 'Grok',
    logo: getLobeIconsCDNUrlFn('grok'),
  },
  amazonBedrock: {
    id: 'Amazon Bedrock',
    logo: getLobeIconsCDNUrlFn('bedrock-color'),
  },
  groq: {
    id: 'Groq',
    logo: getLobeIconsCDNUrlFn('groq'),
  },
  deepinfra: {
    id: 'DeepInfra',
    logo: getLobeIconsCDNUrlFn('deepinfra-color'),
  },
  mistral: {
    id: 'Mistral AI',
    logo: getLobeIconsCDNUrlFn('mistral-color'),
  },
  togetherai: {
    id: 'Together.ai',
    logo: getLobeIconsCDNUrlFn('together-color'),
  },
  cohere: {
    id: 'Cohere',
    logo: getLobeIconsCDNUrlFn('cohere-color'),
  },
  fireworks: {
    id: 'Fireworks AI',
    logo: getLobeIconsCDNUrlFn('fireworks-color'),
  },
  cerebras: {
    id: 'Cerebras',
    logo: getLobeIconsCDNUrlFn('cerebras-color'),
  },
  replicate: {
    id: 'Replicate',
    logo: getLobeIconsCDNUrlFn('replicate'),
  },
  perplexity: {
    id: 'Perplexity',
    logo: getLobeIconsCDNUrlFn('perplexity-color'),
  },
  vercel: {
    id: 'Vercel',
    logo: getLobeIconsCDNUrlFn('vercel'),
  },
}

export const PURE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx'] as const

export type PureProviderNames = typeof PURE_PROVIDER_NAMES[number]

export const PURE_PROVIDERS_ITEMS: Record<PureProviderNames, Provider> = {
  google: {
    id: 'Google',
    logo: getLobeIconsCDNUrlFn('google-color'),
  },
  microsoft: {
    id: 'Microsoft',
    logo: getLobeIconsCDNUrlFn('microsoft-color'),
  },
  deeplx: {
    id: 'DeepLX',
    logo: (isDark: boolean) => isDark ? '/providers/deeplx-dark.svg' : '/providers/deeplx-light.svg',
  },
}
