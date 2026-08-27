import type { ServerStatus } from '../native'
import type { SourceAdapterState, SourceDiagnostics } from '../source-adapter'

export type StatusTone = 'ok' | 'err' | 'neutral'

export interface StatusView {
  text: string
  tone: StatusTone
}

export function statusValueClass(tone: StatusTone): string {
  return tone === 'neutral' ? 'st-value' : `st-value ${tone}`
}

export function serverStatusView(status: ServerStatus): StatusView {
  if (status.state === 'up') return { text: '运行中', tone: 'ok' }
  switch (status.reason) {
    case 'starting':
      return { text: '启动中', tone: 'neutral' }
    case 'failed':
      return { text: '启动失败', tone: 'err' }
    default:
      return { text: '已停止', tone: 'neutral' }
  }
}

export function infLinkView(diagnostics: SourceDiagnostics): StatusView {
  if (diagnostics.state === 'stopped') return { text: '已断开', tone: 'neutral' }
  if (diagnostics.infLinkAvailable) return { text: '在线', tone: 'ok' }
  if (diagnostics.state === 'failed') return { text: '离线', tone: 'err' }
  return { text: '离线', tone: 'neutral' }
}

const INFLINK_MISSING_DETAIL = '未检测到 InfLink-rs，或版本过低'

export function infLinkDetail(diagnostics: SourceDiagnostics): string | undefined {
  if (diagnostics.state === 'stopped' || diagnostics.infLinkAvailable) {
    return undefined
  }
  return diagnostics.lastError ?? INFLINK_MISSING_DETAIL
}

const ADAPTER_STATE_LABELS: Record<SourceAdapterState, string> = {
  idle: '待机',
  waiting: '连接中',
  running: '运行中',
  stopped: '已停止',
  failed: '失败',
}

export function adapterView(state: SourceAdapterState): StatusView {
  const text = ADAPTER_STATE_LABELS[state]
  if (state === 'running') return { text, tone: 'ok' }
  return { text, tone: state === 'failed' ? 'err' : 'neutral' }
}
