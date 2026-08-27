import { beforeEach, describe, expect, it } from 'vitest'

import { getNcmThemeMode } from './theme'

describe('getNcmThemeMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to light when no theme is stored', () => {
    expect(getNcmThemeMode()).toBe('light')
  })

  it('reads the v3 currentTheme key and takes precedence over v2', () => {
    localStorage.setItem(
      'NM_SETTING_SKIN',
      JSON.stringify({ selected: { name: 'default' } }),
    )
    localStorage.setItem('currentTheme', 'theme-light')
    expect(getNcmThemeMode()).toBe('light')

    localStorage.setItem('currentTheme', 'DARK_green')
    expect(getNcmThemeMode()).toBe('dark')
  })

  it('maps the v2 default skin to dark', () => {
    localStorage.setItem(
      'NM_SETTING_SKIN',
      JSON.stringify({ selected: { name: 'default' } }),
    )
    expect(getNcmThemeMode()).toBe('dark')
  })

  it('maps any other v2 skin to light', () => {
    localStorage.setItem(
      'NM_SETTING_SKIN',
      JSON.stringify({ selected: { name: 'midnightBlue' } }),
    )
    expect(getNcmThemeMode()).toBe('light')
  })

  it('falls back to light on malformed v2 JSON', () => {
    localStorage.setItem('NM_SETTING_SKIN', '{not json')
    expect(getNcmThemeMode()).toBe('light')
  })

  it('falls back to light when the v2 payload lacks a selected name', () => {
    localStorage.setItem('NM_SETTING_SKIN', JSON.stringify({ selected: null }))
    expect(getNcmThemeMode()).toBe('light')
  })
})
