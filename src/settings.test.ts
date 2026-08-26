import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COVER_QUALITY_PRESETS,
  DEFAULT_COVER_MODE,
  DEFAULT_COVER_QUALITY,
  normalizeCoverMode,
  normalizeCoverQuality,
  readCoverSettings,
  writeCoverSettings,
} from './settings'

describe('normalizeCoverMode', () => {
  it('keeps base64url', () => {
    expect(normalizeCoverMode('base64url')).toBe('base64url')
  })

  it('falls back to url for anything else', () => {
    expect(normalizeCoverMode('url')).toBe('url')
    expect(normalizeCoverMode(undefined)).toBe('url')
    expect(normalizeCoverMode(123)).toBe('url')
    expect(normalizeCoverMode('BASE64URL')).toBe('url')
  })
})

describe('normalizeCoverQuality', () => {
  it('accepts max in any form', () => {
    expect(normalizeCoverQuality('max')).toBe('max')
    expect(normalizeCoverQuality(3)).toBe('3') // numbers never mean max
  })

  it('normalizes integers within bounds', () => {
    expect(normalizeCoverQuality(512)).toBe('512')
    expect(normalizeCoverQuality('1024')).toBe('1024')
    expect(normalizeCoverQuality(' 256 ')).toBe('256')
    expect(normalizeCoverQuality(1)).toBe('1')
    expect(normalizeCoverQuality(4096)).toBe('4096')
  })

  it('falls back to the default outside [1, 4096] or unparsable', () => {
    expect(normalizeCoverQuality(0)).toBe('256')
    expect(normalizeCoverQuality(-5)).toBe('256')
    expect(normalizeCoverQuality(4097)).toBe('256')
    expect(normalizeCoverQuality('')).toBe('256')
    expect(normalizeCoverQuality(undefined)).toBe('256')
    expect(normalizeCoverQuality(null)).toBe('256')
  })

  it('every preset passes normalization unchanged', () => {
    for (const preset of COVER_QUALITY_PRESETS) {
      expect(normalizeCoverQuality(preset)).toBe(preset)
    }
  })
})

describe('readCoverSettings / writeCoverSettings', () => {
  const getConfig = vi.fn()
  const setConfig = vi.fn()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubPlugin(config: Record<string, unknown>) {
    getConfig.mockImplementation(<T>(key: string, defaultValue: T) =>
      key in config ? config[key] : defaultValue,
    )
    vi.stubGlobal('plugin', { getConfig, setConfig })
  }

  it('reads with defaults when config is missing', () => {
    stubPlugin({})
    expect(readCoverSettings()).toEqual({
      coverMode: DEFAULT_COVER_MODE,
      coverQuality: DEFAULT_COVER_QUALITY,
    })
  })

  it('normalizes stored config on read', () => {
    stubPlugin({ coverMode: 'base64url', coverQuality: 512 })
    expect(readCoverSettings()).toEqual({
      coverMode: 'base64url',
      coverQuality: '512',
    })
  })

  it('merges partial writes over current config and persists normalized values', () => {
    stubPlugin({ coverMode: 'url', coverQuality: '256' })

    const next = writeCoverSettings({ coverQuality: '99999' })

    expect(next).toEqual({ coverMode: 'url', coverQuality: '256' }) // invalid quality rejected
    expect(setConfig).toHaveBeenCalledWith('coverMode', 'url')
    expect(setConfig).toHaveBeenCalledWith('coverQuality', '256')
  })

  it('persists a valid mode change', () => {
    stubPlugin({ coverMode: 'url', coverQuality: '256' })

    const next = writeCoverSettings({ coverMode: 'base64url' })

    expect(next.coverMode).toBe('base64url')
    expect(next.coverQuality).toBe('256')
    expect(setConfig).toHaveBeenCalledWith('coverMode', 'base64url')
    expect(setConfig).toHaveBeenCalledWith('coverQuality', '256')
  })
})
