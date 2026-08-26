import type {
  IInfLinkApi,
  NativeSongInfo,
  PlaybackStatus,
  PlayMode,
  SongInfo,
  TimelineInfo,
  UpdateStatePayload,
  VolumeInfo,
} from './types'
import { nativeBridge } from './native'
import { readCoverSettings } from './settings'
import { TypedEventTarget } from './utils'
import { buildCoverUpdate } from './utils/cover'

const HEARTBEAT_INTERVAL = 5000
const INFLINK_RETRY_INTERVAL = 500

export type SourceAdapterState = 'idle' | 'waiting' | 'running' | 'stopped' | 'failed'

export interface SourceDiagnostics {
  state: SourceAdapterState
  infLinkAvailable: boolean
  infLinkVersion?: string
  lastError?: string
  lastSourceUpdateAt?: number
  lastHeartbeatAt?: number
  lastCoverUpdateAt?: number
  lastCoverError?: string
}

// eslint-disable-next-line ts/consistent-type-definitions
export type SourceAdapterEventMap = {
  change: CustomEvent<SourceDiagnostics>
}

export class SourceAdapter extends TypedEventTarget<SourceAdapterEventMap> {
  private api: IInfLinkApi | undefined
  private stopped = true
  private heartbeatTimer: number | undefined
  private waitTimer: number | undefined
  private coverRequestId = 0

  public diagnostics: SourceDiagnostics = {
    state: 'idle',
    infLinkAvailable: false,
  }

  private readonly onSongChange = () => {
    this.pushFullState()
  }

  private readonly onPlayStateChange = (ev: CustomEvent<PlaybackStatus>) => {
    this.pushUpdate({
      playbackStatus: ev.detail,
      timeline: this.api?.getTimeline() ?? null,
    })
  }

  private readonly onTimelineUpdate = (ev: CustomEvent<TimelineInfo>) => {
    this.pushUpdate({ timeline: ev.detail })
  }

  private readonly onPlayModeChange = (ev: CustomEvent<PlayMode>) => {
    this.pushUpdate({ playMode: ev.detail })
  }

  private readonly onVolumeChange = (ev: CustomEvent<VolumeInfo>) => {
    this.pushUpdate({ volume: ev.detail })
  }

  public start() {
    if (!this.stopped) return

    this.stopped = false
    this.setDiagnostics({ state: 'waiting', lastError: undefined })
    this.attachWhenAvailable()
  }

  public stop() {
    this.stopped = true
    this.detachApi()
    this.clearWaitTimer()
    this.coverRequestId += 1
    this.setDiagnostics({ state: 'stopped', infLinkAvailable: false })
  }

  public restart() {
    this.stop()
    this.start()
  }

  public refresh() {
    if (!this.api) {
      this.attachWhenAvailable()
      return
    }

    this.pushFullState()
  }

  public refreshCover() {
    const song = this.api?.getCurrentSong()
    if (song) {
      this.pushCover(song)
    }
  }

  private attachWhenAvailable() {
    if (this.stopped) return

    const api = window.InfLinkApi
    if (api) {
      this.attachApi(api)
      return
    }

    this.setDiagnostics({
      state: 'waiting',
      infLinkAvailable: false,
      infLinkVersion: undefined,
    })
    this.clearWaitTimer()
    this.waitTimer = window.setTimeout(
      () => this.attachWhenAvailable(),
      INFLINK_RETRY_INTERVAL,
    )
  }

  private attachApi(api: IInfLinkApi) {
    this.detachApi()
    this.api = api
    api.addEventListener('songChange', this.onSongChange)
    api.addEventListener('playStateChange', this.onPlayStateChange)
    api.addEventListener('timelineUpdate', this.onTimelineUpdate)
    api.addEventListener('playModeChange', this.onPlayModeChange)
    api.addEventListener('volumeChange', this.onVolumeChange)

    this.setDiagnostics({
      state: 'running',
      infLinkAvailable: true,
      infLinkVersion: api.version,
      lastError: undefined,
    })

    this.sendHeartbeat()
    this.pushFullState()
    this.startHeartbeat()
  }

  private detachApi() {
    if (!this.api) return

    this.api.removeEventListener('songChange', this.onSongChange)
    this.api.removeEventListener('playStateChange', this.onPlayStateChange)
    this.api.removeEventListener('timelineUpdate', this.onTimelineUpdate)
    this.api.removeEventListener('playModeChange', this.onPlayModeChange)
    this.api.removeEventListener('volumeChange', this.onVolumeChange)
    this.api = undefined
    this.clearHeartbeat()
  }

  private startHeartbeat() {
    this.clearHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (window.InfLinkApi !== this.api) {
        this.detachApi()
        this.attachWhenAvailable()
        return
      }

      this.sendHeartbeat()
    }, HEARTBEAT_INTERVAL)
  }

  private sendHeartbeat() {
    const result = nativeBridge.dispatch({ type: 'Heartbeat' })
    if (result.ok) {
      this.setDiagnostics({ lastHeartbeatAt: Date.now(), lastError: undefined })
    } else {
      this.setDiagnostics({
        state: 'failed',
        lastError: result.error ?? 'heartbeat dispatch failed',
      })
    }
  }

  private pushFullState() {
    const api = this.api
    if (!api) return

    const song = api.getCurrentSong()
    this.pushUpdate({
      song: song ? omitCover(song) : null,
      playbackStatus: api.getPlaybackStatus(),
      timeline: api.getTimeline(),
      playMode: api.getPlayMode(),
      volume: api.getVolume(),
    })

    this.coverRequestId += 1
    if (song) {
      this.pushCover(song)
    }
  }

  private pushUpdate(payload: UpdateStatePayload) {
    const result = nativeBridge.dispatch({ type: 'UpdateState', payload })
    if (result.ok) {
      this.setDiagnostics({
        state: this.api ? 'running' : this.diagnostics.state,
        lastSourceUpdateAt: Date.now(),
        lastError: undefined,
      })
    } else {
      this.setDiagnostics({
        state: 'failed',
        lastError: result.error ?? 'source update dispatch failed',
      })
    }
  }

  private async pushCover(song: SongInfo) {
    const requestId = this.coverRequestId

    try {
      const cover = await buildCoverUpdate(song, readCoverSettings())
      if (this.stopped || requestId !== this.coverRequestId || !cover) return

      const result = nativeBridge.dispatch({
        type: 'UpdateState',
        payload: { cover },
      })
      if (result.ok) {
        this.setDiagnostics({
          lastCoverUpdateAt: Date.now(),
          lastCoverError: undefined,
        })
      } else {
        this.setDiagnostics({
          lastCoverError: result.error ?? 'cover dispatch failed',
        })
      }
    } catch (error) {
      if (requestId === this.coverRequestId) {
        this.setDiagnostics({ lastCoverError: errorMessage(error) })
      }
    }
  }

  private setDiagnostics(patch: Partial<SourceDiagnostics>) {
    this.diagnostics = {
      ...this.diagnostics,
      ...patch,
    }
    this.dispatchCustomEvent('change', { detail: this.diagnostics })
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer !== undefined) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  private clearWaitTimer() {
    if (this.waitTimer !== undefined) {
      window.clearTimeout(this.waitTimer)
      this.waitTimer = undefined
    }
  }
}

export const sourceAdapter = new SourceAdapter()

function omitCover(song: SongInfo): NativeSongInfo {
  const { cover: _cover, ...nativeSong } = song
  return nativeSong
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`
}
