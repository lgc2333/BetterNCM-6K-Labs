import { backendSvrManager } from './backend'
import { websocketService } from './service'
import { ConfigWrapper } from './ui/config'
import * as utils from './utils'

function devModeFunc() {
  console.log('6K-Labs dev mode enabled')
  globalThis.SixKLabs = {
    utils,
  }
}

plugin.onConfig(() => {
  const element = document.createElement('div')
  ReactDOM.render(ConfigWrapper(), element)
  return element
})

plugin.onLoad(async (selfPlugin) => {
  await utils.removeCmdTmpDir().catch(console.error)

  backendSvrManager.addEventListener('started', () => {
    websocketService.reconnect()
  })
  backendSvrManager.addEventListener('beforeKill', () => {
    websocketService.shutdown()
  })
  backendSvrManager.addEventListener('stopped', () => {
    websocketService.shutdown()
  })
})

plugin.onAllPluginsLoaded(() => {
  backendSvrManager.restart()
  if (loadedPlugins['6k-labs'].devMode) devModeFunc()
})
