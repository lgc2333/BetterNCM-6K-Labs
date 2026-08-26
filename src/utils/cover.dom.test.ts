import type { CoverSettings } from '../settings'
import type { SongInfo } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCoverUpdate, getSelectedCoverUrl, isNeteaseImageUrl } from './cover'

const defaultSettings: CoverSettings = { coverMode: 'url', coverQuality: '256' }

function songWithUrl(url: string | undefined): SongInfo {
  return {
    songName: 'song',
    albumName: 'album',
    authorName: 'artist',
    cover: url === undefined ? null : { url },
    ncmId: 42,
    duration: 1000,
  }
}

describe('isNeteaseImageUrl', () => {
  it('accepts the netease image hosts', () => {
    expect(isNeteaseImageUrl(new URL('http://music.126.net/a.jpg'))).toBe(true)
    expect(isNeteaseImageUrl(new URL('http://p1.music.126.net/a.jpg'))).toBe(true)
    expect(isNeteaseImageUrl(new URL('http://P2.MUSIC.126.NET/a.jpg'))).toBe(true)
  })

  it('rejects lookalike and foreign hosts', () => {
    expect(
      isNeteaseImageUrl(new URL('http://evilmusic.126.net.example.com/a.jpg')),
    ).toBe(false)
    expect(isNeteaseImageUrl(new URL('http://example.com/a.jpg'))).toBe(false)
  })
})

describe('getSelectedCoverUrl', () => {
  it.each([[undefined], [''], ['ftp://example.com/a.jpg'], ['/relative/path.jpg']])(
    'rejects %s',
    (input) => {
      expect(getSelectedCoverUrl(input, '256')).toBeUndefined()
    },
  )

  it('passes non-netease URLs through untouched', () => {
    const raw = 'https://cdn.example.com/img.png?w=10'
    expect(getSelectedCoverUrl(raw, '256')).toBe(raw)
  })

  it('rewrites netease URLs with the selected quality thumbnail', () => {
    const rewritten = getSelectedCoverUrl('http://p1.music.126.net/x/abc.jpg', '512')
    expect(rewritten).toBe(
      'http://p1.music.126.net/x/abc.jpg?imageView&enlarge=1&type=jpeg&quality=90&thumbnail=512y512',
    )
  })

  it('keeps the existing query of the original URL out of the rewrite', () => {
    // rewrite uses origin+pathname only; stray query params are dropped
    const rewritten = getSelectedCoverUrl(
      'https://p2.music.126.net/y/def.jpg?param=300y300',
      'max',
    )
    expect(rewritten).toBe(
      'https://p2.music.126.net/y/def.jpg?imageView&enlarge=1&type=jpeg&quality=90',
    )
  })
})

describe('buildCoverUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns a url-mode update without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const update = await buildCoverUpdate(
      songWithUrl('http://p1.music.126.net/x/abc.jpg'),
      defaultSettings,
    )

    expect(update).toEqual({
      songId: 42,
      value:
        'http://p1.music.126.net/x/abc.jpg?imageView&enlarge=1&type=jpeg&quality=90&thumbnail=256y256',
      mode: 'url',
      quality: '256',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gives up in url mode when there is no usable cover URL', async () => {
    await expect(
      buildCoverUpdate(songWithUrl(undefined), defaultSettings),
    ).resolves.toBeUndefined()
  })

  it('fetches the cover in base64url mode and encodes it as data URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['image-bytes'])),
      }),
    )

    const update = await buildCoverUpdate(
      songWithUrl('http://p1.music.126.net/x/abc.jpg'),
      {
        ...defaultSettings,
        coverMode: 'base64url',
      },
    )

    expect(update?.mode).toBe('base64url')
    expect(update?.songId).toBe(42)
    expect(update?.value.startsWith('data:')).toBe(true)
  })

  it('falls back to the inline blob when no URL is available in base64url mode', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const blobSong: SongInfo = {
      ...songWithUrl(undefined),
      cover: { blob: new Blob(['inline-bytes']) },
    }
    const update = await buildCoverUpdate(blobSong, {
      ...defaultSettings,
      coverMode: 'base64url',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(update?.value.startsWith('data:')).toBe(true)
  })

  it('propagates cover fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(
      buildCoverUpdate(songWithUrl('http://p1.music.126.net/x/abc.jpg'), {
        ...defaultSettings,
        coverMode: 'base64url',
      }),
    ).rejects.toThrow('cover fetch failed: HTTP 404')
  })
})
