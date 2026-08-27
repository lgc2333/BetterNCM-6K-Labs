import type { ReactNode } from 'react'

import type { CoverMode } from '../settings'
import type { SourceDiagnostics } from '../source-adapter'
import type { StatusView } from './status'
import { nativeBridge, QUERY_URL } from '../native'
import { sixKLabsRuntime } from '../runtime'
import {
  COVER_QUALITY_PRESETS,
  readCoverSettings,
  writeCoverSettings,
} from '../settings'
import { sourceAdapter } from '../source-adapter'
import { copyText } from './clipboard'
import { Icon } from './Icon'
import {
  adapterView,
  infLinkDetail,
  infLinkView,
  serverStatusView,
  statusValueClass,
} from './status'
import { useNcmTheme } from './theme'
import { Toast, useToast } from './Toast'
import './Config.css'

const ISSUES_URL = 'https://github.com/lgc2333/BetterNCM-6K-Labs/issues'
const QUALITY_DATALIST_ID = 'sixk-quality-presets'
const TOAST_DURATION_MS = 1800
const STOP_CONFIRM_MS = 2600

function Row(props: {
  icon: string
  title: string
  desc?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="row">
      <div className="r-icon">
        <Icon name={props.icon} />
      </div>
      <div className="r-text">
        <div className="r-title">{props.title}</div>
        {props.desc ? <div className="r-desc">{props.desc}</div> : null}
        {props.children}
      </div>
      {props.action ? <div className="r-action">{props.action}</div> : null}
    </div>
  )
}

function StatusItem(props: {
  icon: string
  label: string
  view: StatusView
  children?: ReactNode
}) {
  return (
    <div className="st-item">
      <div className="r-icon">
        <Icon name={props.icon} />
      </div>
      <div className="r-text">
        <div className="r-title">{props.label}</div>
        {props.children}
      </div>
      <div className={statusValueClass(props.view.tone)}>{props.view.text}</div>
    </div>
  )
}

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

const MODE_OPTIONS: Array<[label: string, value: CoverMode]> = [
  ['URL', 'url'],
  ['Base64', 'base64url'],
]

export function Config() {
  const themeMode = useNcmTheme()
  const [serverStatus, setServerStatus] = React.useState(nativeBridge.status)
  const [sourceDiagnostics, setSourceDiagnostics] = React.useState(
    sourceAdapter.diagnostics,
  )
  const [coverSettings, setCoverSettings] = React.useState(readCoverSettings)
  const [qualityInput, setQualityInput] = React.useState(coverSettings.coverQuality)
  const [stopArmed, setStopArmed] = React.useState(false)
  const stopTimer = React.useRef<number | undefined>(undefined)
  const { toastMessage, showToast } = useToast(TOAST_DURATION_MS)

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
    },
    [],
  )

  const copyQueryUrl = () => {
    copyText(QUERY_URL).then((copied) =>
      showToast(copied ? '已复制查询地址' : `复制失败，请手动选择：${QUERY_URL}`),
    )
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
    setCoverSettings(writeCoverSettings({ coverMode }))
    sourceAdapter.refreshCover()
  }

  const applyCoverQuality = () => {
    const next = writeCoverSettings({ coverQuality: qualityInput })
    setCoverSettings(next)
    setQualityInput(next.coverQuality)
    sourceAdapter.refreshCover()
  }

  return (
    <div className="sixk-config" data-theme={themeMode}>
      <div className="page-head">
        <h1>6K Labs</h1>
      </div>

      <div className="sec-label">服务状态</div>
      <div className="status-card">
        <StatusItem
          icon="lucide:server"
          label="本地 HTTP 服务"
          view={serverStatusView(serverStatus)}
        >
          {serverStatus.state === 'up' ? (
            <div className="st-url">
              <span className="u">{QUERY_URL}</span>
              <button className="icon-btn" title="复制" onClick={copyQueryUrl}>
                <Icon name="lucide:copy" />
              </button>
              <button
                className="icon-btn"
                title="在浏览器打开"
                onClick={() => betterncm.ncm.openUrl(QUERY_URL)}
              >
                <Icon name="lucide:external-link" />
              </button>
            </div>
          ) : null}
        </StatusItem>
        <StatusItem
          icon="lucide:link"
          label="InfLink-rs"
          view={infLinkView(sourceDiagnostics)}
        >
          {infLinkDetail(sourceDiagnostics) ? (
            <div className="st-detail">{infLinkDetail(sourceDiagnostics)}</div>
          ) : null}
        </StatusItem>
        <StatusItem
          icon="lucide:activity"
          label="推送适配器"
          view={adapterView(sourceDiagnostics.state)}
        >
          {(sourceDiagnostics.lastError ?? sourceDiagnostics.lastCoverError) ? (
            <div className="st-detail">
              {sourceDiagnostics.lastError ?? sourceDiagnostics.lastCoverError}
            </div>
          ) : null}
        </StatusItem>
      </div>

      <Row
        icon="lucide:sliders-horizontal"
        title="运维操作"
        action={
          <>
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
          </>
        }
      />

      <div className="sec-label">封面输出</div>
      <Row
        icon="lucide:image"
        title="输出模式"
        action={
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
        }
      />
      <Row
        icon="lucide:ruler"
        title="尺寸"
        desc="预设或 1–4096 任意整数"
        action={
          <>
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
          </>
        }
      />

      <div className="sec-label">帮助</div>
      <Row icon="lucide:book-open" title="使用教程">
        <ol className="c-list">
          <li>
            登录 <LinkItem url="https://6klabs.com">6klabs.com</LinkItem>
            ，进入后台面板
          </li>
          <li>点击 Widgets，再点击 Amuse</li>
          <li>选择 Pear Desktop (YouTube Music)，复制页面 URL</li>
          <li>在 OBS 中添加浏览器源粘贴即可，也可以直接在浏览器中打开预览</li>
        </ol>
      </Row>
      <Row icon="lucide:info" title="关于与鸣谢">
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
      </Row>
      <Row
        icon="lucide:external-link"
        title="反馈问题"
        desc="在 GitHub Issues 提出 Bug 或建议"
        action={
          <button
            className="text-btn accent"
            onClick={() => betterncm.ncm.openUrl(ISSUES_URL)}
          >
            前往 →
          </button>
        }
      />

      <Toast message={toastMessage} />
    </div>
  )
}

export function ConfigWrapper() {
  return <Config />
}
