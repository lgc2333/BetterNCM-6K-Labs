import { backendSvrManager } from './backend'
import { websocketService } from './service'
import { ConfigWrapper } from './ui/config'

plugin.onConfig(() => {
  const element = document.createElement('div')
  ReactDOM.render(ConfigWrapper(), element)
  return element
})

plugin.onLoad(() => {
  backendSvrManager.addEventListener('started', () => {
    websocketService.reconnect()
  })
  backendSvrManager.addEventListener('beforeKill', () => {
    websocketService.shutdown()
  })
  backendSvrManager.addEventListener('stopped', () => {
    websocketService.shutdown()
  })
  backendSvrManager.restart()
})

// not working
// window.addEventListener('beforeunload', () => {
//   backendSvrManager.kill()
// })
