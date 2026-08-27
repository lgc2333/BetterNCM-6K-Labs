import type { ServerStatus } from '../native'

import type { SourceDiagnostics } from '../source-adapter'
import { describe, expect, it } from 'vitest'
import {
  adapterView,
  infLinkDetail,
  infLinkView,
  serverStatusView,
  statusValueClass,
} from './status'

function diagnostics(overrides: Partial<SourceDiagnostics>): SourceDiagnostics {
  return {
    state: 'idle',
    infLinkAvailable: false,
    ...overrides,
  } as SourceDiagnostics
}

describe('statusValueClass', () => {
  it('suffices only non-neutral tones', () => {
    expect(statusValueClass('neutral')).toBe('st-value')
    expect(statusValueClass('ok')).toBe('st-value ok')
    expect(statusValueClass('err')).toBe('st-value err')
  })
})

describe('serverStatusView', () => {
  it('shows 运行中 while up', () => {
    const status: ServerStatus = { state: 'up', reason: 'listening' }
    expect(serverStatusView(status)).toEqual({ text: '运行中', tone: 'ok' })
  })

  it('shows neutral 已停止 while deliberately stopped', () => {
    const status: ServerStatus = { state: 'down', reason: 'stopped' }
    expect(serverStatusView(status)).toEqual({ text: '已停止', tone: 'neutral' })
  })

  it('shows neutral 启动中 while starting', () => {
    const status: ServerStatus = { state: 'down', reason: 'starting' }
    expect(serverStatusView(status)).toEqual({ text: '启动中', tone: 'neutral' })
  })

  it('shows red 启动失败 on failure', () => {
    const status: ServerStatus = { state: 'down', reason: 'failed', detail: 'boom' }
    expect(serverStatusView(status)).toEqual({
      text: '启动失败',
      tone: 'err',
      detail: 'boom',
    })
  })

  it('falls back to the native last error while stopped', () => {
    const status: ServerStatus = { state: 'down', reason: 'stopped' }
    expect(serverStatusView(status, '插件原生模块加载失败')).toEqual({
      text: '已停止',
      tone: 'neutral',
      detail: '插件原生模块加载失败',
    })
  })

  it('prefers the native detail over a stale last error', () => {
    const status: ServerStatus = { state: 'down', reason: 'failed', detail: 'boom' }
    expect(serverStatusView(status, 'stale').detail).toBe('boom')
  })

  it('omits the detail while up', () => {
    const status: ServerStatus = { state: 'up', reason: 'listening' }
    expect(serverStatusView(status, 'ignored').detail).toBeUndefined()
  })
})

describe('infLinkView', () => {
  it('shows the v-prefixed version while online', () => {
    expect(
      infLinkView(diagnostics({ infLinkAvailable: true, infLinkVersion: '1.2.3' })),
    ).toEqual({ text: 'v1.2.3', tone: 'ok' })
    expect(
      infLinkView(diagnostics({ infLinkAvailable: true, infLinkVersion: 'v2.0' })),
    ).toEqual({ text: 'v2.0', tone: 'ok' })
    expect(infLinkView(diagnostics({ infLinkAvailable: true }))).toEqual({
      text: '在线',
      tone: 'ok',
    })
    expect(infLinkView(diagnostics({}))).toEqual({ text: '离线', tone: 'neutral' })
  })

  it('shows neutral 已断开 after a deliberate stop', () => {
    expect(infLinkView(diagnostics({ state: 'stopped' }))).toEqual({
      text: '已断开',
      tone: 'neutral',
    })
  })

  it('shows red 离线 only on adapter failure', () => {
    expect(infLinkView(diagnostics({ state: 'failed' }))).toEqual({
      text: '离线',
      tone: 'err',
    })
  })
})

describe('infLinkDetail', () => {
  it('is undefined while available', () => {
    expect(infLinkDetail(diagnostics({ infLinkAvailable: true }))).toBeUndefined()
  })

  it('is undefined after a deliberate stop', () => {
    expect(infLinkDetail(diagnostics({ state: 'stopped' }))).toBeUndefined()
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
