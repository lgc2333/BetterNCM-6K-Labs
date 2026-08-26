import type { NativeDispatchMessage } from './native-dispatch'
import { TypedEventTarget } from './utils'

declare global {
  interface BetterNCMNative {
    native_plugin: {
      call: (identifier: string, args: unknown[]) => string
      getRegisteredAPIs: () => string[]
    }
  }
}

export const SERVER_PORT = 9863
export const QUERY_URL = `http://127.0.0.1:${SERVER_PORT}/query`

export interface NativeResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface ServerStatus {
  state: 'up' | 'down'
  reason: 'starting' | 'listening' | 'stopped' | 'failed'
  detail?: string
}

// eslint-disable-next-line ts/consistent-type-definitions
export type NativeBridgeEventMap = {
  change: CustomEvent<NativeBridge>
}

export class NativeBridge extends TypedEventTarget<NativeBridgeEventMap> {
  public status: ServerStatus = { state: 'down', reason: 'stopped' }
  public lastError: string | undefined
  private statusPollingTimer: number | undefined

  public initialize(): NativeResult<ServerStatus> {
    return this.callStatusApi('initialize', [])
  }

  public terminate(): NativeResult<ServerStatus> {
    return this.callStatusApi('terminate', [])
  }

  public restart(): NativeResult<ServerStatus> {
    return this.callStatusApi('restart', [])
  }

  public getServerStatus(): NativeResult<ServerStatus> {
    return this.callStatusApi('getServerStatus', [])
  }

  public registerServerStatusCallback(): NativeResult {
    const result = this.callNative('registerServerStatusCallback', [
      (statusJson: string) => this.applyStatusJson(statusJson),
    ])
    this.applyResultError(result)
    if (result.ok) {
      this.startStatusPolling()
    }
    return result
  }

  public dispatch(message: NativeDispatchMessage): NativeResult {
    const result = this.callNative('dispatch', [JSON.stringify(message)])
    this.applyResultError(result)
    return result
  }

  private callStatusApi(
    identifier: 'initialize' | 'terminate' | 'restart' | 'getServerStatus',
    args: unknown[],
  ): NativeResult<ServerStatus> {
    const result = this.callNative<ServerStatus>(identifier, args)
    if (result.ok && result.data) {
      this.status = result.data
      this.lastError = undefined
    } else {
      this.applyResultError(result)
    }
    this.dispatchCustomEvent('change', { detail: this })
    return result
  }

  private callNative<T = unknown>(
    identifier: string,
    args: unknown[],
  ): NativeResult<T> {
    try {
      const raw = betterncm_native.native_plugin.call(identifier, args)
      return parseNativeResult<T>(raw)
    } catch (error) {
      return { ok: false, error: errorMessage(error) }
    }
  }

  private applyStatusJson(statusJson: string) {
    try {
      this.status = JSON.parse(statusJson) as ServerStatus
      this.lastError = undefined
    } catch (error) {
      this.lastError = errorMessage(error)
    }
    this.dispatchCustomEvent('change', { detail: this })
  }

  private applyResultError(result: NativeResult) {
    this.lastError = result.ok ? undefined : (result.error ?? 'native call failed')
    this.dispatchCustomEvent('change', { detail: this })
  }

  private startStatusPolling() {
    if (this.statusPollingTimer !== undefined) return

    this.statusPollingTimer = window.setInterval(() => {
      this.getServerStatus()
    }, 2000)
  }
}

export const nativeBridge = new NativeBridge()

function parseNativeResult<T>(raw: string): NativeResult<T> {
  const value = JSON.parse(raw) as NativeResult<T>
  if (typeof value !== 'object' || value === null || typeof value.ok !== 'boolean') {
    return { ok: false, error: 'native result has an invalid shape' }
  }
  return value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`
}
