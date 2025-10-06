export function migrate(oldConfig: any): any {
  if (oldConfig.tts) {
    return oldConfig
  }

  return {
    ...oldConfig,
    tts: {
      model: 'tts-1',
      voice: 'alloy',
      speed: 1,
    },
  }
}
