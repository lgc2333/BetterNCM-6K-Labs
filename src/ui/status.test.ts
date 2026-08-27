import type { ServerStatus } from '../native'

import type { SourceDiagnostics } from '../source-adapter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adapterView,
  formatHeartbeat,
  infLinkDetail,
  infLinkView,
  serverStatusView,
  statusValueClass,
} from './status'

function diagnostics (overrides: Partial<SourceDiagnostics>): SourceDiagnostics {
  return ({
    state: 'idle',
    infLinkAvailable: false,
    ...overrides,
  }) as SourceDiagnostics
}

describe('statusValueClass', () => {
  it('suffices only non-neutral tones', () => {
    expect(statusValueClass('neutral')).toBe('st-value')
    expect(statusValueClass('ok')).toBe('st-value ok')
    expect(statusValueClass('err')).toBe('st-value err')
  })
})

describe('serverStatusView', () => {
  it('shows the port while up', () => {
    const status: ServerStatus = { state: 'up', reason: 'listening' }
    expect(serverStatusView(status)).toEqual({ text: '运行中 · 9863', tone: 'ok' })
  })

  it('shows 未运行 while down', () => {
    const status: ServerStatus = { state: 'down', reason: 'stopped' }
    expect(serverStatusView(status)).toEqual({ text: '未运行', tone: 'err' })
  })
})

describe('infLinkView', () => {
  it('maps availability to 在线/离线', () => {
    expect(infLinkView(diagnostics({ infLinkAvailable: true }))).toEqual({
      text: '在线',
      tone: 'ok',
    })
    expect(infLinkView(diagnostics({}))).toEqual({ text: '离线', tone: 'err' })
  })
})

describe('infLinkDetail', () => {
  it('is undefined while available', () => {
    expect(infLinkDetail(diagnostics({ infLinkAvailable: true }))).toBeUndefined()
  })

  it('prefers the last error over the generic hint', () => {
    const view = infLinkDetail(diagnostics({ lastError: 'boom' }))
    expect(view).toBe('boom')
  })

  it('falls back to the missing-plugin hint', () => {
    const view = infLinkDetail(diagnostics({}))
    expect(view).toContain('未检测到 InfLink-rs')
  })
})

describe('adapterView', () => {
  it('labels each state with the right tone', () => {
    expect(adapterView('running')).toEqual({ text: '运行中', tone: 'ok' })
    expect(adapterView('failed')).toEqual({ text: '失败', tone: 'err' })
    expect(adapterView('idle')).toEqual({ text: '待机', tone: 'neutral' })
    expect(adapterView('waiting')).toEqual({ text: '连接中', tone: 'neutral' })
    expect(adapterView('stopped')).toEqual({ text: '已停止', tone: 'neutral' })
  })
})

describe('formatHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('handles a missing timestamp', () => {
    expect(formatHeartbeat(undefined)).toBe('暂无')
  })

  it('formats seconds below a minute', () => {
    expect(formatHeartbeat(Date.now() - 30_000)).toBe('30 秒前')
  })

  it('formats minutes below an hour', () => {
    expect(formatHeartbeat(Date.now() - 120_000)).toBe('2 分钟前')
  })

  it('formats hours beyond an hour', () => {
    expect(formatHeartbeat(Date.now() - 7_200_000)).toBe('2 小时前')
  })
})
