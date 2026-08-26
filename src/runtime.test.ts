import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SixKLabsRuntime } from './runtime'

const { mockNativeBridge, mockSourceAdapter } = vi.hoisted(() => ({
  mockNativeBridge: {
    registerServerStatusCallback: vi.fn((): { ok: boolean } => ({ ok: true })),
    initialize: vi.fn((): { ok: boolean } => ({ ok: true })),
    restart: vi.fn((): { ok: boolean } => ({ ok: true })),
    terminate: vi.fn((): { ok: boolean } => ({ ok: true })),
  },
  mockSourceAdapter: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}))

vi.mock('./native', () => ({ nativeBridge: mockNativeBridge }))
vi.mock('./source-adapter', () => ({ sourceAdapter: mockSourceAdapter }))

describe('sixKLabsRuntime', () => {
  let runtime: SixKLabsRuntime

  beforeEach(() => {
    vi.clearAllMocks()
    runtime = new SixKLabsRuntime()
  })

  it('start registers callback, initializes native, and starts the adapter once', () => {
    const onChange = vi.fn<(ev: CustomEvent<SixKLabsRuntime>) => void>()
    runtime.addEventListener('change', onChange)

    runtime.start()

    expect(mockNativeBridge.registerServerStatusCallback).toHaveBeenCalledTimes(1)
    expect(mockNativeBridge.initialize).toHaveBeenCalledTimes(1)
    expect(mockSourceAdapter.start).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('restart stops the adapter before restarting native and adapter', () => {
    const order: string[] = []
    mockSourceAdapter.stop.mockImplementation(() => order.push('adapter stop'))
    mockNativeBridge.restart.mockImplementation(() => {
      order.push('native restart')
      return { ok: true }
    })
    mockSourceAdapter.start.mockImplementation(() => order.push('adapter start'))

    runtime.restart()

    expect(order).toEqual(['adapter stop', 'native restart', 'adapter start'])
  })

  it('stop halts the adapter and terminates native, then emits change', () => {
    const onChange = vi.fn<(ev: CustomEvent<SixKLabsRuntime>) => void>()
    runtime.addEventListener('change', onChange)

    runtime.stop()

    expect(mockSourceAdapter.stop).toHaveBeenCalledTimes(1)
    expect(mockNativeBridge.terminate).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
