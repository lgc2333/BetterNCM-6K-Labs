import type {
  PlaybackStatus,
  PlayMode,
  SongInfo,
  TimelineInfo,
  VolumeInfo,
} from '../third-party/inflink-api'

export type NativeSongInfo = Omit<SongInfo, 'cover'>

export interface CoverUpdate {
  songId: number
  value: string
  mode: 'url' | 'base64url'
  quality: string
}

export interface UpdateStatePayload {
  song?: NativeSongInfo | null
  playbackStatus?: PlaybackStatus
  timeline?: TimelineInfo | null
  playMode?: PlayMode
  volume?: VolumeInfo
  cover?: CoverUpdate
}

export type NativeDispatchMessage =
  { type: 'UpdateState'; payload: UpdateStatePayload } | { type: 'Heartbeat' }
