import type { ReactNode } from 'react'

import type { ServerStatus } from '../native'
import type { CoverMode } from '../settings'
import type { SourceAdapterState, SourceDiagnostics } from '../source-adapter'
import { nativeBridge, QUERY_URL, SERVER_PORT } from '../native'
import { sixKLabsRuntime } from '../runtime'
import {
  COVER_QUALITY_PRESETS,
  readCoverSettings,
  writeCoverSettings,
} from '../settings'
import { sourceAdapter } from '../source-adapter'
import { useNcmTheme } from './theme'

const ISSUES_URL = 'https://github.com/lgc2333/BetterNCM-6K-Labs/issues'
const STYLE_ELEMENT_ID = 'sixk-config-style'
const QUALITY_DATALIST_ID = 'sixk-quality-presets'
const TOAST_DURATION_MS = 1800
const STOP_CONFIRM_MS = 2600

type IconName =
  | 'book'
  | 'copy'
  | 'heart'
  | 'image'
  | 'info'
  | 'link'
  | 'open'
  | 'pulse'
  | 'ruler'
  | 'server'
  | 'sliders'

const ICONS: Record<IconName, string> = {
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`,
  pulse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  ruler: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-6.6-6.6a1 1 0 0 1 0-1.4L13.3.7a1 1 0 0 1 1.4 0l6.6 6.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/></svg>`,
  server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>`,
}

function Icon(props: { name: IconName }) {
  return (
    <span
      className="sixk-icon"
      dangerouslySetInnerHTML={{ __html: ICONS[props.name] }}
    />
  )
}

const CONFIG_CSS = `
.sixk-config,
.sixk-config * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sixk-config {
  --sixk-tx1: rgba(0, 0, 0, 0.88);
  --sixk-tx2: rgba(0, 0, 0, 0.55);
  --sixk-tx3: rgba(0, 0, 0, 0.38);
  --sixk-line: rgba(0, 0, 0, 0.1);
  --sixk-glass: rgba(255, 255, 255, 0.55);
  --sixk-ctl: rgba(0, 0, 0, 0.05);
  --sixk-ctl-hover: rgba(0, 0, 0, 0.09);
  --sixk-ok: #14935c;
  --sixk-err: #c93a52;
  --sixk-accent: #c20c0c;
  --sixk-on-accent: #ffffff;
  --sixk-seg-active: rgba(0, 0, 0, 0.1);

  max-width: 660px;
  margin: 0 auto;
  font-size: 14px;
  color: var(--sixk-tx1);
}

.sixk-config[data-theme='dark'] {
  --sixk-tx1: rgba(255, 255, 255, 0.94);
  --sixk-tx2: rgba(255, 255, 255, 0.62);
  --sixk-tx3: rgba(255, 255, 255, 0.4);
  --sixk-line: rgba(255, 255, 255, 0.12);
  --sixk-glass: rgba(255, 255, 255, 0.07);
  --sixk-ctl: rgba(255, 255, 255, 0.08);
  --sixk-ctl-hover: rgba(255, 255, 255, 0.14);
  --sixk-ok: #3ecf8e;
  --sixk-err: #ff8091;
  --sixk-accent: #ff5c5c;
  --sixk-on-accent: #ffffff;
  --sixk-seg-active: rgba(255, 255, 255, 0.14);
}



.sixk-config a,
.sixk-config button,
.sixk-config input {
  font: inherit;
  color: inherit;
}
.sixk-config button {
  cursor: pointer;
  border: none;
  background: transparent;
}
.sixk-config :focus-visible {
  outline: 2px solid var(--sixk-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

.sixk-config .page-head {
  margin-bottom: 26px;
}
.sixk-config .page-head h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--sixk-tx1);
}
.sixk-config .page-head p {
  margin-top: 6px;
  font-size: 13px;
  color: var(--sixk-tx2);
}
.sixk-config .sec-label {
  margin: 26px 0 10px;
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.14em;
  color: var(--sixk-tx3);
}

.sixk-config .status-card {
  margin-bottom: 10px;
  padding: 13px 15px;
  background: var(--sixk-glass);
  border: 1px solid var(--sixk-line);
  border-radius: 14px;
  backdrop-filter: blur(24px);
}
.sixk-config .status-card .st-item + .st-item {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--sixk-line);
}
.sixk-config .st-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sixk-config .st-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sixk-tx3);
}
.sixk-config .st-label .sixk-icon svg {
  width: 15px;
  height: 15px;
}
.sixk-config .st-value {
  flex: none;
  font-size: 15px;
  font-weight: 600;
}
.sixk-config .st-value.ok {
  color: var(--sixk-ok);
}
.sixk-config .st-value.err {
  color: var(--sixk-err);
}
.sixk-config .st-url {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.sixk-config .st-url .u {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 11.5px;
  color: var(--sixk-tx2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sixk-config .st-meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding-left: 10px;
  font-size: 12px;
  color: var(--sixk-tx2);
}
.sixk-config .st-meta .sixk-icon svg {
  width: 13px;
  height: 13px;
  opacity: 0.75;
}
.sixk-config .st-detail {
  margin-top: 6px;
  font-size: 12px;
  color: var(--sixk-tx2);
  line-height: 1.5;
}
.sixk-config .icon-btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  color: var(--sixk-tx2);
  transition: background 0.15s, color 0.15s;
}
.sixk-config .icon-btn:hover {
  background: var(--sixk-ctl-hover);
  color: var(--sixk-tx1);
}
.sixk-config .st-url .icon-btn svg {
  width: 13px;
  height: 13px;
}

.sixk-config .row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--sixk-glass);
  border: 1px solid var(--sixk-line);
  border-radius: 14px;
  backdrop-filter: blur(24px);
}
.sixk-config .row + .row {
  margin-top: 10px;
}
.sixk-config .r-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--sixk-ctl);
  border-radius: 10px;
  color: var(--sixk-tx2);
}
.sixk-config .r-icon .sixk-icon svg {
  width: 17px;
  height: 17px;
}
.sixk-config .r-text {
  flex: 1;
  min-width: 0;
}
.sixk-config .r-title {
  font-size: 14px;
  font-weight: 550;
  color: var(--sixk-tx1);
}
.sixk-config .r-desc {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--sixk-tx2);
  line-height: 1.45;
}
.sixk-config .r-action {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.sixk-config .text-btn {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--sixk-tx2);
  transition: background 0.15s, color 0.15s;
}
.sixk-config .text-btn:hover {
  background: var(--sixk-ctl-hover);
  color: var(--sixk-tx1);
}
.sixk-config .text-btn.danger:hover {
  color: var(--sixk-err);
}
.sixk-config .text-btn.accent {
  color: var(--sixk-accent);
}
.sixk-config .text-btn.armed {
  background: var(--sixk-err);
  color: var(--sixk-on-accent);
}

.sixk-config .seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--sixk-ctl);
  border-radius: 10px;
}
.sixk-config .seg button {
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--sixk-tx2);
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.sixk-config .seg button:hover {
  color: var(--sixk-tx1);
}
.sixk-config .seg button.on {
  background: var(--sixk-seg-active);
  color: var(--sixk-tx1);
  font-weight: 600;
}

.sixk-config .quality-input {
  width: 110px;
  padding: 7px 10px;
  background: var(--sixk-ctl);
  border: 1px solid var(--sixk-line);
  border-radius: 9px;
  color: var(--sixk-tx1);
  font-size: 13px;
}
.sixk-config .quality-input:focus {
  border-color: var(--sixk-accent);
  outline: none;
}

.sixk-config .c-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--sixk-tx2);
  line-height: 1.8;
}
.sixk-config .c-list a {
  color: var(--sixk-accent);
  text-decoration: none;
}
.sixk-config .c-list a:hover {
  text-decoration: underline;
}
.sixk-config .credits {
  margin: 8px 0 0;
  list-style: none;
  font-size: 13px;
  color: var(--sixk-tx2);
  line-height: 2;
}
.sixk-config .credits a {
  color: var(--sixk-accent);
  text-decoration: none;
}
.sixk-config .credits a:hover {
  text-decoration: underline;
}

.sixk-toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  padding: 9px 16px;
  background: rgba(20, 20, 24, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 13px;
  color: #ffffff;
  z-index: 9999;
  pointer-events: none;
}
`

function ensureStyles() {
  if (document.getElementById(STYLE_ELEMENT_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = CONFIG_CSS
  document.head.appendChild(style)
}

type StatusTone = 'ok' | 'err' | 'neutral'

interface StatusView {
  text: string
  tone: StatusTone
}

function statusValueClass(tone: StatusTone): string {
  return tone === 'neutral' ? 'st-value' : `st-value ${tone}`
}

function serverStatusView(status: ServerStatus): StatusView {
  return status.state === 'up'
    ? { text: `运行中 · ${SERVER_PORT}`, tone: 'ok' }
    : { text: '未运行', tone: 'err' }
}

function infLinkView(diagnostics: SourceDiagnostics): StatusView {
  return diagnostics.infLinkAvailable
    ? { text: '在线', tone: 'ok' }
    : { text: '离线', tone: 'err' }
}

const INFLINK_MISSING_DETAIL =
  '未检测到 InfLink-rs：请确认已在 BetterNCM 中安装并启用，或版本过低（需要 ≥ 1.x）'

function infLinkDetail(diagnostics: SourceDiagnostics): string | undefined {
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

function adapterView(state: SourceAdapterState): StatusView {
  const text = ADAPTER_STATE_LABELS[state]
  if (state === 'running') return { text, tone: 'ok' }
  return { text, tone: state === 'failed' ? 'err' : 'neutral' }
}

function formatHeartbeat(timestamp: number | undefined): string {
  if (!timestamp) return '暂无'

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds} 秒前`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`

  return `${Math.floor(minutes / 60)} 小时前`
}

const MODE_OPTIONS: Array<[label: string, value: CoverMode]> = [
  ['URL', 'url'],
  ['Base64', 'base64url'],
]

function LinkItem(props: { url: string; children: ReactNode }) {
  return (
    <a
      href={props.url}
      onClick={(ev) => {
        ev.preventDefault()
        betterncm.ncm.openUrl(props.url)
      }}
    >
      {props.children}
    </a>
  )
}

function fallbackCopy(text: string, onCopied: () => void, onFailed: () => void) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    onCopied()
  } catch {
    onFailed()
  }
  textarea.remove()
}

export function Config() {
  ensureStyles()

  const themeMode = useNcmTheme()
  const [serverStatus, setServerStatus] = React.useState(nativeBridge.status)
  const [sourceDiagnostics, setSourceDiagnostics] = React.useState(
    sourceAdapter.diagnostics,
  )
  const [coverSettings, setCoverSettings] = React.useState(readCoverSettings)
  const [qualityInput, setQualityInput] = React.useState(coverSettings.coverQuality)
  const [stopArmed, setStopArmed] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState('')
  const stopTimer = React.useRef<number | undefined>(undefined)
  const toastTimer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => {
    const handleNativeChange = () => {
      setServerStatus(nativeBridge.status)
    }
    const handleSourceChange = (ev: CustomEvent<SourceDiagnostics>) => {
      setSourceDiagnostics(ev.detail)
    }

    nativeBridge.addEventListener('change', handleNativeChange)
    sourceAdapter.addEventListener('change', handleSourceChange)
    nativeBridge.getServerStatus()

    return () => {
      nativeBridge.removeEventListener('change', handleNativeChange)
      sourceAdapter.removeEventListener('change', handleSourceChange)
    }
  }, [])

  React.useEffect(
    () => () => {
      window.clearTimeout(stopTimer.current)
      window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const showToast = (message: string) => {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(setToastMessage, TOAST_DURATION_MS, '')
  }

  const copyQueryUrl = () => {
    const onCopied = () => showToast('已复制查询地址')
    const onFailed = () => showToast(`复制失败，请手动选择：${QUERY_URL}`)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(QUERY_URL).then(onCopied, () => {
        fallbackCopy(QUERY_URL, onCopied, onFailed)
      })
    } else {
      fallbackCopy(QUERY_URL, onCopied, onFailed)
    }
  }

  const handleStopClick = () => {
    if (!stopArmed) {
      setStopArmed(true)
      window.clearTimeout(stopTimer.current)
      stopTimer.current = window.setTimeout(setStopArmed, STOP_CONFIRM_MS, false)
      return
    }

    window.clearTimeout(stopTimer.current)
    setStopArmed(false)
    sixKLabsRuntime.stop()
  }

  const applyCoverMode = (coverMode: CoverMode) => {
    const next = writeCoverSettings({ coverMode })
    setCoverSettings(next)
    sourceAdapter.refreshCover()
  }

  const applyCoverQuality = () => {
    const next = writeCoverSettings({ coverQuality: qualityInput })
    setCoverSettings(next)
    setQualityInput(next.coverQuality)
    sourceAdapter.refreshCover()
  }

  const server = serverStatusView(serverStatus)
  const infLink = infLinkView(sourceDiagnostics)
  const adapter = adapterView(sourceDiagnostics.state)

  return (
    <div className="sixk-config" data-theme={themeMode}>
      <div className="page-head">
        <h1>6K Labs</h1>
        <p>把网易云的播放状态推送给 6klabs.com 的小组件</p>
      </div>

      <div className="sec-label">服务状态</div>
      <div className="status-card">
        <div className="st-item">
          <div className="st-head">
            <div className="st-label">
              <Icon name="server" />
              本地 HTTP 服务
            </div>
            <div className={statusValueClass(server.tone)}>{server.text}</div>
          </div>
          {serverStatus.state === 'up' ? (
            <div className="st-url">
              <span className="u">{QUERY_URL}</span>
              <button className="icon-btn" title="复制" onClick={copyQueryUrl}>
                <Icon name="copy" />
              </button>
              <button
                className="icon-btn"
                title="在浏览器打开"
                onClick={() => betterncm.ncm.openUrl(QUERY_URL)}
              >
                <Icon name="open" />
              </button>
              <div className="st-meta">
                <Icon name="heart" />
                心跳 {formatHeartbeat(sourceDiagnostics.lastHeartbeatAt)}
              </div>
            </div>
          ) : null}
        </div>
        <div className="st-item">
          <div className="st-head">
            <div className="st-label">
              <Icon name="link" />
              InfLink-rs
            </div>
            <div className={statusValueClass(infLink.tone)}>{infLink.text}</div>
          </div>
          {infLinkDetail(sourceDiagnostics) ? (
            <div className="st-detail">{infLinkDetail(sourceDiagnostics)}</div>
          ) : null}
        </div>
        <div className="st-item">
          <div className="st-head">
            <div className="st-label">
              <Icon name="pulse" />
              推送适配器
            </div>
            <div className={statusValueClass(adapter.tone)}>{adapter.text}</div>
          </div>
          {(sourceDiagnostics.lastError ?? sourceDiagnostics.lastCoverError) ? (
            <div className="st-detail">
              {sourceDiagnostics.lastError ?? sourceDiagnostics.lastCoverError}
            </div>
          ) : null}
        </div>
      </div>

      <div className="row">
        <div className="r-icon">
          <Icon name="sliders" />
        </div>
        <div className="r-text">
          <div className="r-title">运维操作</div>
        </div>
        <div className="r-action">
          <button className="text-btn" onClick={() => sixKLabsRuntime.restart()}>
            重启
          </button>
          <button
            className={`text-btn danger${stopArmed ? ' armed' : ''}`}
            onClick={handleStopClick}
          >
            {stopArmed ? '确认停止？' : '停止'}
          </button>
          <button className="text-btn" onClick={() => sourceAdapter.refresh()}>
            刷新
          </button>
        </div>
      </div>

      <div className="sec-label">封面输出</div>
      <div className="row">
        <div className="r-icon">
          <Icon name="image" />
        </div>
        <div className="r-text">
          <div className="r-title">输出模式</div>
        </div>
        <div className="r-action">
          <div className="seg">
            {MODE_OPTIONS.map(([label, value]) => (
              <button
                key={value}
                className={coverSettings.coverMode === value ? 'on' : ''}
                onClick={() => applyCoverMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="row">
        <div className="r-icon">
          <Icon name="ruler" />
        </div>
        <div className="r-text">
          <div className="r-title">尺寸</div>
          <div className="r-desc">预设或 1–4096 任意整数</div>
        </div>
        <div className="r-action">
          <input
            className="quality-input"
            list={QUALITY_DATALIST_ID}
            value={qualityInput}
            onChange={(ev) => setQualityInput(ev.currentTarget.value)}
            onBlur={applyCoverQuality}
          />
          <datalist id={QUALITY_DATALIST_ID}>
            {COVER_QUALITY_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="sec-label">帮助</div>
      <div className="row">
        <div className="r-icon">
          <Icon name="book" />
        </div>
        <div className="r-text">
          <div className="r-title">使用教程</div>
          <ol className="c-list">
            <li>
              登录 <LinkItem url="https://6klabs.com">6klabs.com</LinkItem>
              ，进入后台面板
            </li>
            <li>点击 Widgets，再点击 Amuse</li>
            <li>选择 Pear Desktop (YouTube Music)，复制页面 URL</li>
            <li>在 OBS 中添加浏览器源粘贴即可，也可以直接在浏览器中打开预览</li>
          </ol>
        </div>
      </div>
      <div className="row">
        <div className="r-icon">
          <Icon name="info" />
        </div>
        <div className="r-text">
          <div className="r-title">关于与鸣谢</div>
          <ul className="credits">
            <li>
              灵感来源：
              <LinkItem url="https://github.com/Widdit/now-playing-service">
                Widdit/now-playing-service
              </LinkItem>
            </li>
            <li>
              数据来源：
              <LinkItem url="https://github.com/apoint123/inflink-rs">
                InfLink-rs
              </LinkItem>
            </li>
            <li>
              服务提供：
              <LinkItem url="https://6klabs.com">6K Labs</LinkItem>
            </li>
            <li>
              旧版参考：
              <LinkItem url="https://github.com/BetterNCM/InfinityLink">
                InfinityLink
              </LinkItem>
              {' & '}
              <LinkItem url="https://github.com/std-microblock/LiveSongPlayer-MKII">
                LiveSongPlayer-MKII
              </LinkItem>
            </li>
          </ul>
        </div>
      </div>
      <div className="row">
        <div className="r-icon">
          <Icon name="open" />
        </div>
        <div className="r-text">
          <div className="r-title">反馈问题</div>
          <div className="r-desc">在 GitHub Issues 提出 Bug 或建议</div>
        </div>
        <div className="r-action">
          <button
            className="text-btn accent"
            onClick={() => betterncm.ncm.openUrl(ISSUES_URL)}
          >
            前往 →
          </button>
        </div>
      </div>

      {toastMessage ? <div className="sixk-toast">{toastMessage}</div> : null}
    </div>
  )
}

export function ConfigWrapper() {
  return <Config />
}
