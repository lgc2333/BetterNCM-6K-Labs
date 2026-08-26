import type { IInfLinkApi, SongInfo, UpdateStatePayload, VolumeInfo } from './types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nativeBridge } from './native'
import { SourceAdapter } from './source-adapter'

vi.mock('./native', () => ({
  nativeBridge: { dispatch: vi.fn(() => ({ ok: true }) as const) },
}))

// Captured before vi.useFakeTimers() can patch globals; happy-dom FileReader
// callbacks freeze under fake timers, so cover-pipeline drains use this.
const realSetTimeout = globalThis.setTimeout.bind(globalThis) as (
  callback: () => void,
  ms: number,
) => unknown

const dispatchMock = vi.mocked(nativeBridge.dispatch)

const song: SongInfo = {
  songName: 'Song',
  albumName: 'Album',
  authorName: 'Artist',
  cover: { url: 'http://p1.music.126.net/x/a.jpg' },
  ncmId: 42,
}

interface TimelineLike {
  position: number
  duration: number
}

class FakeInfLinkApi extends EventTarget {
  public readonly attached = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(
    public readonly currentSong: SongInfo | undefined = { ...song },
    public readonly version = '1.2.3',
  ) {
    super()
  }

  public getCurrentSong(): SongInfo | undefined {
    return this.currentSong ? { ...this.currentSong } : undefined
  }

  public getPlaybackStatus(): 'Playing' | 'Paused' {
    return 'Playing'
  }

  public getTimeline(): TimelineLike {
    return { position: 3000, duration: 200_000 }
  }

  public getPlayMode(): Record<string, never> {
    return {}
  }

  public getVolume(): VolumeInfo {
    return { volume: 0.5, isMuted: false }
  }

  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ): void {
    let set = this.attached.get(type)
    if (!set) {
      set = new Set()
      this.attached.set(type, set)
    }
    set.add(listener!)
    // forward to the real EventTarget so dispatchEvent actually delivers
    super.addEventListener(type, listener)
  }

  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ): void {
    this.attached.get(type)?.delete(listener!)
    super.removeEventListener(type, listener)
  }

  public emit<T>(type: string, detail: T): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}

function stubPluginConfig(config: Record<string, unknown> = {}) {
  vi.stubGlobal('plugin', {
    getConfig: (key: string, defaultValue: unknown) =>
      key in config ? config[key] : defaultValue,
    setConfig: vi.fn(),
  })
}

function setWindowApi(api: IInfLinkApi | undefined) {
  Reflect.set(window, 'InfLinkApi', api)
}

function updatePayloads(): UpdateStatePayload[] {
  return dispatchMock.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === 'UpdateState')
    .map((message) => (message.type === 'UpdateState' ? message.payload : undefined))
    .filter((payload) => payload !== undefined)
}

describe('sourceAdapter', () => {
  let adapter: SourceAdapter

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubPluginConfig({ coverMode: 'url' })
    adapter = new SourceAdapter()
  })

  afterEach(() => {
    adapter.stop()
    setWindowApi(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('waits and retries while InfLinkApi is absent', () => {
    const onChange = vi.fn<(ev: CustomEvent<SourceAdapter['diagnostics']>) => void>()
    adapter.addEventListener('change', onChange)

    adapter.start()

    expect(adapter.diagnostics.state).toBe('waiting')
    expect(adapter.diagnostics.infLinkAvailable).toBe(false)

    vi.advanceTimersByTime(1500)

    expect(adapter.diagnostics.state).toBe('waiting')
    expect(adapter.diagnostics.infLinkAvailable).toBe(false)
    expect(onChange.mock.calls.length).toBeGreaterThan(1) // every wait retry emits change
  })

  it('attaches once InfLinkApi appears during the wait loop', () => {
    adapter.start()
    expect(adapter.diagnostics.state).toBe('waiting')

    const api = setWindowApiAttached()
    vi.advanceTimersByTime(600)

    expect(adapter.diagnostics.state).toBe('running')
    expect(adapter.diagnostics.infLinkVersion).toBe('1.2.3')
    for (const eventName of [
      'songChange',
      'playStateChange',
      'timelineUpdate',
      'playModeChange',
      'volumeChange',
    ]) {
      expect(api.attached.get(eventName)?.size).toBe(1)
    }
  })

  function setWindowApiAttached() {
    const api = new FakeInfLinkApi()
    setWindowApi(api as unknown as IInfLinkApi)
    return api
  }

  it('pushes heartbeat, full state (without cover field), and cover on attach', () => {
    setWindowApiAttached()

    adapter.start()

    const kinds = dispatchMock.mock.calls.map(([message]) => message.type)
    expect(kinds[0]).toBe('Heartbeat')

    const payloads = updatePayloads()
    const fullState = payloads[0] as Record<string, unknown>
    expect(fullState.song).toMatchObject({ ncmId: 42 })
    expect(fullState.song).not.toHaveProperty('cover')
    expect(fullState.playbackStatus).toBe('Playing')
    expect(fullState.timeline).toEqual({ position: 3000, duration: 200_000 })
    expect(fullState.volume).toEqual({ volume: 0.5, isMuted: false })
  })

  it('relays playback/timeline/play-mode/volume events to native dispatch', () => {
    setWindowApiAttached()
    adapter.start()
    dispatchMock.mockClear()

    const api = window.InfLinkApi! as unknown as FakeInfLinkApi
    api.emit('playStateChange', 'Paused')
    api.emit('timelineUpdate', { position: 4000, duration: 200_000 })
    api.emit('playModeChange', {})
    api.emit('volumeChange', { volume: 0.3, isMuted: true })

    const payloads = updatePayloads()
    expect(payloads[0]).toEqual({
      playbackStatus: 'Paused',
      timeline: { position: 3000, duration: 200_000 },
    })
    expect(payloads[1]).toEqual({ timeline: { position: 4000, duration: 200_000 } })
    expect(payloads[2]).toEqual({ playMode: {} })
    expect(payloads[3]).toEqual({ volume: { volume: 0.3, isMuted: true } })
  })

  it('marks the adapter failed when native dispatch rejects the heartbeat', () => {
    setWindowApiAttached()
    adapter.start()
    expect(adapter.diagnostics.state).toBe('running')
    dispatchMock.mockReturnValueOnce({ ok: false, error: 'native gone' })
    vi.advanceTimersByTime(5000)

    expect(adapter.diagnostics.state).toBe('failed')
    expect(adapter.diagnostics.lastError).toBe('native gone')
  })

  it('reattaches to a replaced InfLinkApi instance detected by the heartbeat', () => {
    setWindowApiAttached()
    adapter.start()
    const oldApi = window.InfLinkApi as unknown as FakeInfLinkApi

    const nextApi = new FakeInfLinkApi()
    setWindowApi(nextApi as unknown as IInfLinkApi)
    vi.advanceTimersByTime(5000)

    expect(oldApi.attached.get('songChange')?.size).toBe(0)
    expect(nextApi.attached.get('songChange')?.size).toBeGreaterThanOrEqual(1)
    expect(adapter.diagnostics.state).toBe('running')
  })

  it('detaches everything on stop', () => {
    setWindowApiAttached()
    adapter.start()
    const api = window.InfLinkApi as unknown as FakeInfLinkApi

    adapter.stop()

    expect(adapter.diagnostics.state).toBe('stopped')
    expect(adapter.diagnostics.infLinkAvailable).toBe(false)
    for (const listeners of api.attached.values()) {
      expect(listeners.size).toBe(0)
    }

    dispatchMock.mockClear()
    vi.advanceTimersByTime(20_000) // no heartbeats / retries after stop
    api.emit('playStateChange', 'Paused') // no relays after stop
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('restart recovers a failed adapter', () => {
    setWindowApiAttached()
    adapter.start()
    adapter.stop()

    adapter.restart()

    expect(adapter.diagnostics.state).toBe('running')
  })

  describe('cover pushes', () => {
    interface BlobResponse {
      ok: boolean
      blob: () => Promise<Blob>
    }

    function stubDeferredFetch() {
      const resolvers: Array<(response: BlobResponse) => void> = []
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<BlobResponse>((resolve) => {
              resolvers.push(resolve)
            }),
        ),
      )
      return { get: (index: number) => resolvers[index]! }
    }
    const blobResponse = (): BlobResponse => ({
      ok: true,
      blob: () => Promise.resolve(new Blob(['x'])),
    })

    // happy-dom's FileReader resolves on the real event loop, which freezes
    async function drainCoverPipeline(): Promise<void> {
      await new Promise<void>((resolve) => realSetTimeout(resolve, 0))
      await Promise.resolve()
    }

    it('skips stale cover results after stop', async () => {
      stubPluginConfig({ coverMode: 'base64url' })
      const resolvers = stubDeferredFetch()

      setWindowApiAttached()
      adapter.start()
      dispatchMock.mockClear()

      adapter.refreshCover()
      adapter.stop() // cover request becomes stale before its fetch resolves
      resolvers.get(0)(blobResponse())
      await drainCoverPipeline()

      expect(updatePayloads()).toHaveLength(0)
      expect(adapter.diagnostics.lastCoverUpdateAt).toBeUndefined()
    })

    it('bumps the request id per refresh so older fetches cannot win', async () => {
      stubPluginConfig({ coverMode: 'base64url' })
      const resolvers = stubDeferredFetch()

      setWindowApiAttached()
      adapter.start()
      dispatchMock.mockClear()

      adapter.refreshCover() // request 1 -> slow
      await Promise.resolve()
      adapter.refreshCover() // request 2 -> fast

      // resolve the older (slow) fetch first; it must not dispatch anything
      resolvers.get(0)(blobResponse())
      await drainCoverPipeline()
      expect(updatePayloads()).toHaveLength(0)

      resolvers.get(1)(blobResponse())
      await drainCoverPipeline()
      const payloads = updatePayloads()
      expect(payloads).toHaveLength(1)
      expect(payloads.some((payload) => 'cover' in payload)).toBe(true)
    })
  })
})
