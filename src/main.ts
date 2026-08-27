import { nativeBridge } from './native'
import { sixKLabsRuntime } from './runtime'
import { sourceAdapter } from './source-adapter'
import { ConfigWrapper } from './ui/Config'
import * as utils from './utils'

declare global {
  interface SixKLabsDev {
    nativeBridge: typeof import('./native').nativeBridge
    runtime: typeof import('./runtime').sixKLabsRuntime
    sourceAdapter: typeof import('./source-adapter').sourceAdapter
    utils: typeof import('./utils')
  }

  // eslint-disable-next-line vars-on-top
  var SixKLabs: SixKLabsDev | undefined
}

function setupDevMode() {
  console.log('6K-Labs dev mode enabled')
  globalThis.SixKLabs = {
    nativeBridge,
    runtime: sixKLabsRuntime,
    sourceAdapter,
    utils,
  }
}

plugin.onConfig(() => {
  const element = document.createElement('div')
  ReactDOM.render(ConfigWrapper(), element)
  return element
})

plugin.onLoad(async (_selfPlugin) => {
  window.addEventListener('beforeunload', () => {
    sixKLabsRuntime.stop()
  })
})

plugin.onAllPluginsLoaded(() => {
  sixKLabsRuntime.start()
  if (loadedPlugins['6k-labs'].devMode) setupDevMode()
})
