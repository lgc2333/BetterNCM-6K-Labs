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
      <h1 style={{ fontSize: '24px' }}>服务状态</h1>

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
    </div>
  )
}

export function ConfigWrapper() {
  return <Config />
}
