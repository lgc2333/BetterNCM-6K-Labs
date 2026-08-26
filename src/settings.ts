export type CoverMode = 'url' | 'base64url'

export interface CoverSettings {
  coverMode: CoverMode
  coverQuality: string
}

export const COVER_QUALITY_PRESETS = ['128', '256', '512', '1024', 'max'] as const
export const DEFAULT_COVER_MODE: CoverMode = 'url'
export const DEFAULT_COVER_QUALITY = '256'

export function normalizeCoverMode(value: unknown): CoverMode {
  return value === 'base64url' ? 'base64url' : 'url'
}

export function normalizeCoverQuality(value: unknown): string {
  if (value === 'max') return 'max'

  const text = typeof value === 'number' ? `${value}` : `${value ?? ''}`.trim()
  if (text === 'max') return 'max'

  const parsed = Number.parseInt(text, 10)
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 4096) {
    return `${parsed}`
  }

  return DEFAULT_COVER_QUALITY
}

export function readCoverSettings(): CoverSettings {
  return {
    coverMode: normalizeCoverMode(plugin.getConfig('coverMode', DEFAULT_COVER_MODE)),
    coverQuality: normalizeCoverQuality(
      plugin.getConfig('coverQuality', DEFAULT_COVER_QUALITY),
    ),
  }
}

export function writeCoverSettings(settings: Partial<CoverSettings>): CoverSettings {
  const next = {
    ...readCoverSettings(),
    ...settings,
  }
  next.coverMode = normalizeCoverMode(next.coverMode)
  next.coverQuality = normalizeCoverQuality(next.coverQuality)

  plugin.setConfig('coverMode', next.coverMode)
  plugin.setConfig('coverQuality', next.coverQuality)

  return next
}
