---
status: accepted
---

# Use InfLink-rs As The Playback Source

6K-Labs uses InfLink-rs as the authoritative source for current song, playback status, timeline, play mode, and volume. The plugin declares `"loadAfter": ["InfLinkrs"]` and `"requirements": ["InfLinkrs"]`, and still checks `window.InfLinkApi` at runtime because the global API exists only after InfLink-rs initializes successfully.

6K-Labs reuses the public InfLink-rs information types from `packages/frontend/src/types/api.d.ts`: `SongInfo`, `PlaybackStatus`, `TimelineInfo`, `PlayMode`, and `VolumeInfo`. `SongInfo.cover` is always omitted before sending song data to native code; cover is handled by a separate cover update.
