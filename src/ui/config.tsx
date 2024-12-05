// TODO UI 不显示

import { backendSvrManager } from '../server'
import { SERVER_PORT, websocketService } from '../service'

export function StateSpan({ state }: { state: boolean }) {
  return (
    <span style={{ color: state ? 'green' : 'red' }}>
      {state ? '运行中' : '已停止'}
    </span>
  )
}

export function Config() {
  const [serviceState, setServiceState] = React.useState(websocketService.connected)
  const [serverState, setServerState] = React.useState(backendSvrManager.running)
  const [serverStopTooSoon, setServerStopTooSoon] = React.useState(
    backendSvrManager.stopTooSoon,
  )

  const handleServiceOpen = () => setServiceState(true)
  const handleServiceClose = () => setServerState(false)
  const handleServerRun = () => setServerState(true)
  const handleServerStop = () => {
    setServerState(false)
    setServerStopTooSoon(backendSvrManager.stopTooSoon)
  }

  React.useEffect(() => {
    websocketService.addEventListener('open', handleServiceOpen)
    websocketService.addEventListener('close', handleServiceClose)
    backendSvrManager.addEventListener('running', handleServerRun)
    backendSvrManager.addEventListener('stopped', handleServerStop)

    return () => {
      websocketService.removeEventListener('open', handleServiceOpen)
      websocketService.removeEventListener('close', handleServiceClose)
      backendSvrManager.removeEventListener('running', handleServerRun)
      backendSvrManager.removeEventListener('stopped', handleServerStop)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <h1 style={{ fontSize: '24px' }}>Plugin Status</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>Service</div>
        <div>
          <StateSpan state={serviceState} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>Server</div>
        <div>
          <StateSpan state={serverState} />
          {serverStopTooSoon && (
            <>
              <br />
              <span style={{ color: 'red' }}>
                （后端服务停止过快，请检查是否 {SERVER_PORT} 端口被占用或出现其他问题）
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
