import { backendSvrManager, StopType } from '../backend'
import { SERVER_PORT, websocketService } from '../service'

export function Config() {
  const [serviceState, setServiceState] = React.useState(websocketService.connected)
  const [serviceStopped, setServiceStopped] = React.useState(websocketService.stopped)
  const [serverState, setServerState] = React.useState(backendSvrManager.running)
  const [serverStopped, setServerStopped] = React.useState(backendSvrManager.stopped)
  const [serverStopType, setServerStopType] = React.useState(backendSvrManager.stopType)

  const handleServiceOpen = React.useCallback(() => {
    setServiceState(true)
    setServiceStopped(websocketService.stopped)
  }, [])

  const handleServiceClose = React.useCallback(() => {
    setServiceState(false)
    setServiceStopped(websocketService.stopped)
  }, [])

  const handleServerRun = React.useCallback(() => {
    setServerState(true)
    setServerStopped(backendSvrManager.stopped)
    setServerStopType(backendSvrManager.stopType)
  }, [])

  const handleServerStop = React.useCallback(() => {
    setServerState(false)
    setServerStopped(backendSvrManager.stopped)
    setServerStopType(backendSvrManager.stopType)
  }, [])

  React.useEffect(() => {
    websocketService.addEventListener('open', handleServiceOpen)
    websocketService.addEventListener('close', handleServiceClose)
    backendSvrManager.addEventListener('started', handleServerRun)
    backendSvrManager.addEventListener('stopped', handleServerStop)

    return () => {
      websocketService.removeEventListener('open', handleServiceOpen)
      websocketService.removeEventListener('close', handleServiceClose)
      backendSvrManager.removeEventListener('started', handleServerRun)
      backendSvrManager.removeEventListener('stopped', handleServerStop)
    }
  }, [handleServiceOpen, handleServiceClose, handleServerRun, handleServerStop])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <h1 style={{ fontSize: '20px' }}>服务状态</h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 0',
          borderBottom: '1px solid rgba(136, 136, 136, 0.333)',
        }}
      >
        <div>后端接口服务</div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: serverState ? 'green' : 'red' }}>
            {serverState
              ? '运行中'
              : serverStopped
                ? serverStopType === StopType.MANUALLY
                  ? '未运行'
                  : '启动失败'
                : '尝试重启中'}
          </span>
          {serverStopped && serverStopType !== StopType.MANUALLY ? (
            <>
              <br />
              <span style={{ color: 'red' }}>
                程序异常退出，请检查是否 {SERVER_PORT} 端口被占用或出现其他问题
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 0',
        }}
      >
        <div>前端信息查询服务</div>
        <div>
          <span style={{ color: serviceState ? 'green' : 'red' }}>
            {serviceState ? '已连接' : serviceStopped ? '已停止' : '重连中'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <a
          className="false u-ibtn5 u-ibtnsz8 cmd-button cmd-button-outlineSec cmd-button-size-m cmd-button-outline-sec button-item"
          style={{ display: 'flex', alignItems: 'center', background: 'transparent' }}
          onClick={() => backendSvrManager.restart()}
        >
          重启服务
        </a>
        <a
          className="false u-ibtn5 u-ibtnsz8 cmd-button cmd-button-outlineSec cmd-button-size-m cmd-button-outline-sec button-item"
          style={{ display: 'flex', alignItems: 'center', background: 'transparent' }}
          onClick={() => backendSvrManager.kill()}
        >
          停止服务
        </a>
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
          登录后进入后台面板，点击 Widgets，再点击 Amuse，之后选择 Youtube Music，复制
          URL 后向 OBS 添加浏览器源即可，你也可以直接在浏览器中打开预览效果
        </p>
        <p>下方 Widget Settings 中还可以修改 Amuse 的样式</p>
      </div>

      <h1 style={{ fontSize: '20px' }}>碎碎念</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p>一些注意事项：</p>
        <p>
          - 由于 BetterNCM API 限制，后端服务无法随网易云关闭，
          如果不停止会一直留在后台，不过资源占用不高，不介意可以不用管它
        </p>
        <p>
          - 因为本废物写的状态管理代码太烂，上面两个重启和停止的按钮最好不要点太快 QAQ
        </p>
        <p>- 后端服务器全部代码都是交给 GitHub Copilot 写的，我不会写 Golang 啊 xwx</p>
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
          - 服务提供：{' '}
          <a
            style={{ textDecoration: '1px solid underline' }}
            onClick={() => betterncm.ncm.openUrl('https://6klabs.com')}
          >
            6K Labs
          </a>
        </p>
        <p>
          - 技术参考：{' '}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p>最后祝各位使用愉快吧~</p>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <a
          className="false u-ibtn5 u-ibtnsz8 cmd-button cmd-button-outlineSec cmd-button-size-m cmd-button-outline-sec button-item"
          style={{ display: 'flex', alignItems: 'center', background: 'transparent' }}
          onClick={() =>
            betterncm.ncm.openUrl('https://github.com/lgc2333/BetterNCM-6K-Labs/issues')
          }
        >
          前往 GitHub Issues 反馈 Bug 或提出建议
        </a>
      </div>
    </div>
  )
}

export function ConfigWrapper() {
  return <Config />
}