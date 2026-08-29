---
status: accepted
---

# Push Source Updates Through One Dispatch Message

JavaScript keeps no playback cache. It subscribes to InfLink-rs, forwards source facts to native code, and uses `Heartbeat` only to prove the adapter is alive.

```ts
import type {
  PlayMode,
  PlaybackStatus,
  SongInfo,
  TimelineInfo,
  VolumeInfo,
} from './inflink-api'

type NativeSongInfo = Omit<SongInfo, 'cover'>

type NativeDispatchMessage =
  { type: 'UpdateState'; payload: UpdateStatePayload } | { type: 'Heartbeat' }

interface UpdateStatePayload {
  song?: NativeSongInfo | null
  playbackStatus?: PlaybackStatus
  timeline?: TimelineInfo | null
  playMode?: PlayMode
  volume?: VolumeInfo
  cover?: CoverUpdate
}

interface CoverUpdate {
  songId: number
  value: string
  mode: 'url' | 'base64url'
  quality: string
}
```

Omitted `UpdateState` fields mean unchanged. `song: null` means no song and clears the native cache to `emptyQuery`, including cover. `Heartbeat` has no payload.

## Considered Options

- Send one `UpdateState` message containing InfLink-rs source facets and keep `Heartbeat` separate.
- Send a different native message type for each playback facet.
- Send a complete 6K Labs Query from JavaScript on every source event.

## Consequences

JavaScript remains a source adapter instead of a second playback cache or query mapper. Rust must merge partial source updates correctly, and `Heartbeat` cannot accidentally become a hidden state transport.
