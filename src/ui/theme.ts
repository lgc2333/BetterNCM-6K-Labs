// NCM theme detection, adapted from InfLink-rs's useNcmTheme.
// v3 stores `currentTheme`, v2 stores `NM_SETTING_SKIN`; both in localStorage.

export type PaletteMode = 'light' | 'dark'

export function getNcmThemeMode(): PaletteMode {
  const v3Theme = localStorage.getItem('currentTheme')
  if (v3Theme) {
    return /^dark/i.test(v3Theme) ? 'dark' : 'light'
  }

  const v2Theme = localStorage.getItem('NM_SETTING_SKIN')
  if (v2Theme) {
    try {
      const selected = JSON.parse(v2Theme)?.selected?.name
      return selected === 'default' ? 'dark' : 'light'
    } catch {
      // malformed v2 config, fall through to default
    }
  }

  return 'light'
}

export function useNcmTheme(): PaletteMode {
  const [mode, setMode] = React.useState<PaletteMode>(getNcmThemeMode)

  React.useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'currentTheme' || ev.key === 'NM_SETTING_SKIN') {
        setMode(getNcmThemeMode())
      }
    }
    // Same-document theme switches never fire `storage`, and the config
    // element is cached forever (never re-mounted), so poll instead.
    const poll = window.setInterval(() => {
      setMode((prev) => {
        const next = getNcmThemeMode()
        return prev === next ? prev : next
      })
    }, 2000)

    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.clearInterval(poll)
    }
  }, [])

  return mode
}
