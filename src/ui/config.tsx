import type { CSSProperties, ReactNode } from 'react'

import type { ServerStatus } from '../native'
import type { CoverMode } from '../settings'
import type { SourceAdapterState, SourceDiagnostics } from '../source-adapter'
import { nativeBridge, QUERY_URL } from '../native'
import { sixKLabsRuntime } from '../runtime'
import {
  COVER_QUALITY_PRESETS,
  readCoverSettings,
  writeCoverSettings,
} from '../settings'
import { sourceAdapter } from '../source-adapter'

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '6px 0',
  borderBottom: '1px solid rgba(136, 136, 136, 0.333)',
} satisfies CSSProperties

const buttonStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
} satisfies CSSProperties

export function Config() {
  const [serverStatus, setServerStatus] = React.useState(nativeBridge.status)
  const [nativeError, setNativeError] = React.useState(nativeBridge.lastError)
  const [sourceDiagnostics, setSourceDiagnostics] = React.useState(
    sourceAdapter.diagnostics,
  )
  const [coverSettings, setCoverSettings] = React.useState(readCoverSettings)
  const [qualityInput, setQualityInput] = React.useState(coverSettings.coverQuality)

  React.useEffect(() => {
    const handleNativeChange = () => {
      setServerStatus(nativeBridge.status)
      setNativeError(nativeBridge.lastError)
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

  const applyCoverMode = (coverMode: CoverMode) => {
    const next = writeCoverSettings({ coverMode })
    setCoverSettings(next)
    setQualityInput(next.coverQuality)
    sourceAdapter.refreshCover()
  }

  const applyCoverQuality = (coverQuality: string) => {
    const next = writeCoverSettings({ coverQuality })
    setCoverSettings(next)
    setQualityInput(next.coverQuality)
    sourceAdapter.refreshCover()
  }

  const presetValue = COVER_QUALITY_PRESETS.includes(
    coverSettings.coverQuality as (typeof COVER_QUALITY_PRESETS)[number],
  )
    ? coverSettings.coverQuality
    : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <h1 style={{ fontSize: '20px' }}>服务状态</h1>

      <StatusRow
        label="本地 HTTP 服务"
        value={serverStatusLabel(serverStatus)}
        tone={serverStatusTone(serverStatus)}
        detail={
          serverStatus.state === 'up' ? undefined : (serverStatus.detail ?? nativeError)
        }
      />
      <StatusRow
        label="InfLink-rs"
        value={infLinkLabel(sourceDiagnostics)}
        tone={infLinkTone(sourceDiagnostics)}
      />
      <StatusRow
        label="JS 推送适配器"
        value={sourceStateLabel(sourceDiagnostics.state)}
        tone={sourceStateTone(sourceDiagnostics.state)}
        detail={sourceDiagnostics.lastError ?? sourceDiagnostics.lastCoverError}
      />
      <StatusRow
        label="最近心跳"
        value={formatTimestamp(sourceDiagnostics.lastHeartbeatAt)}
        tone={sourceDiagnostics.lastHeartbeatAt ? 'ok' : 'neutral'}
      />
      <div style={rowStyle}>
        <div>查询地址</div>
        <a
          style={{ textDecoration: '1px solid underline', textAlign: 'right' }}
          onClick={() => betterncm.ncm.openUrl(QUERY_URL)}
        >
          {QUERY_URL}
        </a>
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <CommandButton onClick={() => sixKLabsRuntime.restart()}>
          重启服务
        </CommandButton>
        <CommandButton onClick={() => sixKLabsRuntime.stop()}>停止服务</CommandButton>
        <CommandButton onClick={() => sourceAdapter.refresh()}>刷新状态</CommandButton>
      </div>

      <h1 style={{ fontSize: '20px' }}>封面</h1>
      <div style={rowStyle}>
        <label>输出模式</label>
        <select
          className="u-txt sc-flag"
          value={coverSettings.coverMode}
          onChange={(ev) => applyCoverMode(ev.currentTarget.value as CoverMode)}
        >
          <option value="url">URL</option>
          <option value="base64url">Base64 Data URL</option>
        </select>
      </div>
      <div style={rowStyle}>
        <label>尺寸</label>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <select
            className="u-txt sc-flag"
            value={presetValue}
            onChange={(ev) => {
              if (ev.currentTarget.value) {
                applyCoverQuality(ev.currentTarget.value)
              }
            }}
          >
            <option value="">自定义</option>
            {COVER_QUALITY_PRESETS.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
          <input
            className="u-txt sc-flag"
            style={{ width: '84px' }}
            value={qualityInput}
            onChange={(ev) => setQualityInput(ev.currentTarget.value)}
            onBlur={() => applyCoverQuality(qualityInput)}
          />
        </div>
      </div>

      <h1 style={{ fontSize: '20px' }}>使用方式</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p>
          搭配{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() => betterncm.ncm.openUrl('https://6klabs.com')}
          >
            6klabs.com
          </a>{' '}
          使用
        </p>
        <p>
          登录后进入后台面板，点击 Widgets，再点击 Amuse，之后选择 Pear Desktop (YouTube
          Music)，复制 URL 后向 OBS 添加浏览器源即可，也可以直接在浏览器中打开预览效果。
        </p>
      </div>

      <h1 style={{ fontSize: '20px' }}>鸣谢</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p>
          - 灵感来源：{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() =>
              betterncm.ncm.openUrl('https://github.com/Widdit/now-playing-service')
            }
          >
            Widdit/now-playing-service
          </a>
        </p>
        <p>
          - 数据来源：{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() =>
              betterncm.ncm.openUrl('https://github.com/apoint123/inflink-rs')
            }
          >
            InfLink-rs
          </a>
        </p>
        <p>
          - 服务提供：{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() => betterncm.ncm.openUrl('https://6klabs.com')}
          >
            6K Labs
          </a>
        </p>
        <p>
          - 旧版本技术参考：{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() =>
              betterncm.ncm.openUrl('https://github.com/BetterNCM/InfinityLink')
            }
          >
            BetterNCM/InfinityLink
          </a>{' '}
          &{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() =>
              betterncm.ncm.openUrl(
                'https://github.com/std-microblock/LiveSongPlayer-MKII',
              )
            }
          >
            std-microblock/LiveSongPlayer-MKII
          </a>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <CommandButton
          onClick={() =>
            betterncm.ncm.openUrl('https://github.com/lgc2333/BetterNCM-6K-Labs/issues')
          }
        >
          前往 GitHub Issues 反馈 Bug 或提出建议
        </CommandButton>
      </div>
    </div>
  )
}

export function ConfigWrapper() {
  return <Config />
}

type StatusTone = 'ok' | 'error' | 'neutral'

function StatusRow(props: {
  label: string
  value: string
  tone: StatusTone
  detail?: string
}) {
  const color = props.tone === 'ok' ? 'green' : props.tone === 'error' ? 'red' : 'gray'
  return (
    <div style={rowStyle}>
      <div>{props.label}</div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ color }}>{props.value}</span>
        {props.detail ? (
          <>
            <br />
            <span style={{ color: 'red' }}>{props.detail}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function CommandButton(props: { children: ReactNode; onClick: () => void }) {
  return (
    <a
      className="false u-ibtn5 u-ibtnsz8 cmd-button cmd-button-outlineSec cmd-button-size-m cmd-button-outline-sec button-item"
      style={buttonStyle}
      onClick={props.onClick}
    >
      {props.children}
    </a>
  )
}

function serverStatusLabel(status: ServerStatus): string {
  if (status.state === 'up') return '运行中'

  return {
    starting: '启动中',
    listening: '运行中',
    stopped: '已停止',
    failed: '启动失败',
  }[status.reason]
}

function sourceStateLabel(state: SourceAdapterState): string {
  return {
    idle: '未启动',
    waiting: '等待 InfLink-rs',
    running: '运行中',
    stopped: '已停止',
    failed: '推送失败',
  }[state]
}

function serverStatusTone(status: ServerStatus): StatusTone {
  if (status.state === 'up') return 'ok'
  return status.reason === 'failed' ? 'error' : 'neutral'
}

function infLinkLabel(diagnostics: SourceDiagnostics): string {
  if (diagnostics.state === 'stopped') return '已断开'
  if (diagnostics.infLinkAvailable) {
    return `已连接 ${diagnostics.infLinkVersion ?? ''}`.trim()
  }
  return '等待中'
}

function infLinkTone(diagnostics: SourceDiagnostics): StatusTone {
  if (diagnostics.state === 'failed') return 'error'
  return diagnostics.infLinkAvailable ? 'ok' : 'neutral'
}

function sourceStateTone(state: SourceAdapterState): StatusTone {
  if (state === 'running') return 'ok'
  return state === 'failed' ? 'error' : 'neutral'
}

function formatTimestamp(timestamp: number | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleTimeString() : '暂无'
}
