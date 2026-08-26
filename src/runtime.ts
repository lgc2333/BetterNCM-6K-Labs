import { nativeBridge } from './native'
import { sourceAdapter } from './source-adapter'
import { TypedEventTarget } from './utils'

// eslint-disable-next-line ts/consistent-type-definitions
export type SixKLabsRuntimeEventMap = {
  change: CustomEvent<SixKLabsRuntime>
}

export class SixKLabsRuntime extends TypedEventTarget<SixKLabsRuntimeEventMap> {
  public start() {
    nativeBridge.registerServerStatusCallback()
    nativeBridge.initialize()
    sourceAdapter.start()
    this.dispatchCustomEvent('change', { detail: this })
  }

  public restart() {
    sourceAdapter.stop()
    nativeBridge.restart()
    sourceAdapter.start()
    this.dispatchCustomEvent('change', { detail: this })
  }

  public stop() {
    sourceAdapter.stop()
    nativeBridge.terminate()
    this.dispatchCustomEvent('change', { detail: this })
  }
}

export const sixKLabsRuntime = new SixKLabsRuntime()
