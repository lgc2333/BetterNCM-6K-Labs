import type { CoverSettings } from '../settings'
import type { CoverUpdate, SongInfo } from '../types'
import { blobToDataUrl, tryParseUrl } from './common'

export function isNeteaseImageUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return host === 'music.126.net' || host.endsWith('.music.126.net')
}

async function fetchCoverBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`cover fetch failed: HTTP ${response.status}`)
  }
  return response.blob()
}

export function getSelectedCoverUrl(
  coverUrl: string | undefined,
  quality: string,
): string | undefined {
  if (!coverUrl?.startsWith('http')) return undefined

  const url = tryParseUrl(coverUrl)
  if (!url) return undefined
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

  if (!isNeteaseImageUrl(url)) {
    return url.toString()
  }

  const thumbnail = quality === 'max' ? '' : `&thumbnail=${quality}y${quality}`
  return `${url.origin}${url.pathname}?imageView&enlarge=1&type=jpeg&quality=90${thumbnail}`
}

export async function buildCoverUpdate(
  song: SongInfo,
  settings: CoverSettings,
): Promise<CoverUpdate | undefined> {
  const selectedUrl = getSelectedCoverUrl(song.cover?.url, settings.coverQuality)

  if (settings.coverMode === 'url') {
    if (!selectedUrl) return undefined

    return {
      songId: song.ncmId,
      value: selectedUrl,
      mode: 'url',
      quality: settings.coverQuality,
    }
  }

  const blob =
    selectedUrl !== undefined ? await fetchCoverBlob(selectedUrl) : song.cover?.blob
  if (!blob) return undefined

  return {
    songId: song.ncmId,
    value: await blobToDataUrl(blob),
    mode: 'base64url',
    quality: settings.coverQuality,
  }
}
