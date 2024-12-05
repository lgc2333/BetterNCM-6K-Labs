import { backendSvrManager } from './server'
import { websocketService } from './service'
import { Config } from './ui/config'

plugin.onConfig(() => {
  const element = document.createElement('div')
  ReactDOM.render(Config(), element)
  return element
})

plugin.onLoad(() => {
  backendSvrManager.addEventListener('running', () => {
    websocketService.reconnect()
  })
  backendSvrManager.addEventListener('stopped', () => {
    websocketService.shutdown()
  })
  backendSvrManager.start()
})
