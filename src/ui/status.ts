import type { ServerStatus } from '../native'
import type { SourceAdapterState, SourceDiagnostics } from '../source-adapter'
import { SERVER_PORT } from '../native'

export type StatusTone = 'ok' | 'err' | 'neutral'

export interface StatusView {
  text: string
  tone: StatusTone
}

export function statusValueClass(tone: StatusTone): string {
  return tone === 'neutral' ? 'st-value' : `st-value ${tone}`
}

export function serverStatusView(status: ServerStatus): StatusView {
  return status.state === 'up'
    ? { text: `运行中 · ${SERVER_PORT}`, tone: 'ok' }
    : { text: '未运行', tone: 'err' }
}

export function infLinkView(diagnostics: SourceDiagnostics): StatusView {
  return diagnostics.infLinkAvailable
    ? { text: '在线', tone: 'ok' }
    : { text: '离线', tone: 'err' }
}

const INFLINK_MISSING_DETAIL =
  '未检测到 InfLink-rs：请确认已在 BetterNCM 中安装并启用，或版本过低（需要 ≥ 1.x）'

export function infLinkDetail(diagnostics: SourceDiagnostics): string | undefined {
  if (diagnostics.infLinkAvailable) return undefined
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

export function formatHeartbeat(timestamp: number | undefined): string {
  if (!timestamp) return '暂无'

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds} 秒前`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`

  return `${Math.floor(minutes / 60)} 小时前`
}
