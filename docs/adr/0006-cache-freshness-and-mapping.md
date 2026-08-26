---
status: accepted
---

# Let Rust Own Cache Freshness And Query Mapping

JavaScript sends an initial full `UpdateState` after `window.InfLinkApi` is available, forwards `songChange`, `playStateChange`, `timelineUpdate`, `playModeChange`, and `volumeChange`, and sends `Heartbeat` every 5 seconds. Rust serves `emptyQuery` before the cache is ready or after 15 seconds without heartbeat.

Rust converts InfLink-rs source facts to the 6K Labs Query shape: milliseconds become seconds plus human strings, `VolumeInfo.volume` becomes `0..100`, `PlaybackStatus` becomes `isPaused`, and `PlayMode.repeatMode` maps `None -> NONE`, `List -> ALL`, `Track -> ONE`, `AI -> NONE`. Missing 6K-only fields use defaults: `likeStatus=INDIFFERENT`, `inLibrary=false`, `isVideo=false`, and `isAdvertisement=false`.

Rust may interpolate timeline between `timelineUpdate` events by storing `currentMs`, `totalMs`, `isPaused`, and update time. Interpolation stops while paused.
