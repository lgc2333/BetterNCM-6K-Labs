import { describe, expect, it } from 'vitest'
import { errorMessage, tryParseUrl } from './common'

describe('tryParseUrl', () => {
  it('parses valid URLs', () => {
    const url = tryParseUrl('http://p1.music.126.net/abc/img.jpg?imageView')
    expect(url).toBeInstanceOf(URL)
    expect(url?.hostname).toBe('p1.music.126.net')
  })

  it('returns undefined for invalid input', () => {
    expect(tryParseUrl('not a url')).toBeUndefined()
    expect(tryParseUrl('')).toBeUndefined()
  })
})

describe('errorMessage', () => {
  it('uses the message of Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(new TypeError('bad type'))).toBe('bad type')
  })

  it('stringifies non-error values', () => {
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
    expect(errorMessage(undefined)).toBe('undefined')
  })
})
