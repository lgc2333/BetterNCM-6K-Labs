import type {Mock} from 'vitest';
import type { ServerStatus } from './native'
import type { NativeDispatchMessage } from './types'
import { afterEach, beforeEach, describe, expect, it,  vi } from 'vitest'
import { NATIVE_API_IDS, NativeBridge, QUERY_URL, SERVER_PORT } from './native'

interface NativePluginStub {
  call: Mock
  getRegisteredAPIs: Mock
}

function stubNativePlugin(registered: string[] = [...NATIVE_API_IDS]) {
  const plugin = {
    call: vi.fn(() => JSON.stringify({ ok: true })),
    getRegisteredAPIs: vi.fn(() => [...registered]),
  }
  vi.stubGlobal('betterncm_native', { native_plugin: plugin })
  return plugin satisfies NativePluginStub
}

function expectChangeDetail(bridge: NativeBridge) {
  const handler = vi.fn<(ev: CustomEvent<NativeBridge>) => void>()
  bridge.addEventListener('change', handler)
  return handler
}

const upStatus: ServerStatus = { state: 'up', reason: 'listening' }

describe('constants', () => {
  it('exposes the local query endpoint', () => {
    expect(SERVER_PORT).toBe(9863)
    expect(QUERY_URL).toBe('http://127.0.0.1:9863/query')
  })
})

describe('nativeBridge', () => {
  let bridge: NativeBridge

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    bridge = new NativeBridge()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('successful initialize stores the server status and emits change', () => {
    stubNativePlugin().call.mockReturnValue(
      JSON.stringify({ ok: true, data: upStatus }),
    )
    const onChange = expectChangeDetail(bridge)

    const result = bridge.initialize()

    expect(result).toEqual({ ok: true, data: upStatus })
    expect(bridge.status).toEqual(upStatus)
    expect(onChange.mock.calls[0][0].detail).toBe(bridge)
  })

  it('failed calls record the native error message', () => {
    stubNativePlugin().call.mockReturnValue(
      JSON.stringify({ ok: false, error: 'server down' }),
    )

    const result = bridge.terminate()

    expect(result.ok).toBe(false)
    expect(result.error).toBe('server down')
    expect(bridge.lastError).toBe('server down')
  })

  it('dispatch serializes the message body', () => {
    const payload: NativeDispatchMessage = {
      type: 'UpdateState',
      payload: { volume: { volume: 0.5, isMuted: false } },
    }

    bridge.dispatch(payload)

  })

  it('flags structurally invalid results as failed without throwing', () => {
    stubNativePlugin().call.mockReturnValue(JSON.stringify({ ok: 'yes' }))

    const result = bridge.dispatch({ type: 'Heartbeat' })

    expect(result).toEqual({
      ok: false,
      error: 'native result has an invalid shape',
    })
  })

  describe('call failure reporting', () => {
    it('explains when BetterNCM lacks native plugin support', () => {
      // getRegisteredAPIs itself is unusable here
      vi.stubGlobal('betterncm_native', {})

      const result = bridge.initialize()

      expect(result.ok).toBe(false)
      expect(result.error).toBe('当前 BetterNCM 不支持原生插件调用')
      expect(bridge.lastError).toBe('当前 BetterNCM 不支持原生插件调用')
    })

    it('explains when the plugin native module registered nothing', () => {
      const plugin = stubNativePlugin([])
      plugin.call.mockImplementation(() => {
        throw new Error('boom')
      })

      const result = bridge.restart()

      expect(result.error).toBe('插件原生模块加载失败')
    })

    it('detects partial registrations of our APIs', () => {
      const plugin = stubNativePlugin([...NATIVE_API_IDS].slice(0, 3))
      plugin.call.mockImplementation(() => {
        throw new Error('boom')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = bridge.getServerStatus()

      expect(result.error).toBe('插件原生模块加载不完整，请尝试卸载重装本插件')
    })

    it('surfaces the original error when every API is registered', () => {
      const plugin = stubNativePlugin()
      plugin.call.mockImplementation(() => {
        throw new Error('native exploded')
      })

      const result = bridge.getServerStatus()

      expect(result.error).toBe('native exploded')
    })
  })

  describe('status callback', () => {
    function registerCallback(): { applier: (json: string) => void } {
      const plugin = stubNativePlugin()
      expect(bridge.registerServerStatusCallback().ok).toBe(true)

      const calls = plugin.call.mock.calls as unknown as Array<[string, [unknown]]>
      const call = calls.find(
        ([identifier]) => identifier === 'registerServerStatusCallback',
      )
      if (!call) throw new Error('registerServerStatusCallback was not called')

      const applier = call[1][0]
      if (!(typeof applier === 'function')) throw new Error('callback arg missing')
      return { applier: applier as (json: string) => void }
    }

    it('registers a status applier and applies pushed status json', () => {
      const onChange = expectChangeDetail(bridge)
      const { applier } = registerCallback()

      applier(JSON.stringify(upStatus))

      expect(bridge.status).toEqual(upStatus)
      expect(bridge.lastError).toBeUndefined()
      expect(onChange).toHaveBeenCalled()
    })

    it('keeps the previous status when pushed json is malformed', () => {
      const { applier } = registerCallback()

      applier('{broken')

      expect(bridge.status).toEqual({ state: 'down', reason: 'stopped' })
      expect(bridge.lastError).toContain('JSON')
    })
  })

  describe('status polling', () => {
    it('polls getServerStatus every 2 seconds after registering', () => {
      vi.useFakeTimers()
      const plugin = stubNativePlugin()

      bridge.registerServerStatusCallback()
      expect(plugin.call).toHaveBeenCalledWith('registerServerStatusCallback', [
        expect.any(Function),
      ])

      plugin.call.mockClear()
      vi.advanceTimersByTime(2000)
      expect(plugin.call).toHaveBeenCalledTimes(1)
      expect(plugin.call).toHaveBeenCalledWith('getServerStatus', [])

      vi.advanceTimersByTime(4000)
      expect(plugin.call).toHaveBeenCalledTimes(3)

      vi.advanceTimersByTime(1999)
      expect(plugin.call).toHaveBeenCalledTimes(3)
    })

    it('does not stack pollers on repeated registration', () => {
      vi.useFakeTimers()
      const plugin = stubNativePlugin()

      bridge.registerServerStatusCallback()
      bridge.registerServerStatusCallback()

      plugin.call.mockClear()
      vi.advanceTimersByTime(2000)
      expect(plugin.call).toHaveBeenCalledTimes(1)
    })
  })
})
