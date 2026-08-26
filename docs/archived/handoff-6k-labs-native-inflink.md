# Handoff: BetterNCM 6K-Labs Native Backend + InfLink-rs Source

## Next Session Focus

Continue designing or implementing `packages/6K-Labs` so it no longer launches an external Go server process. The preferred direction is a BetterNCM native Rust DLL backend plus a JS-side dependency on InfLink-rs for playback information.

## Workspace

- Workspace root: `D:\Coding\BetterNCM-Workspace`
- Main package: `D:\Coding\BetterNCM-Workspace\packages\6K-Labs`
- Current local package files of interest:
  - `packages/6K-Labs/src/backend.ts`: current external exe lifecycle manager.
  - `packages/6K-Labs/src/service.ts`: current WebSocket client that answers backend queries.
  - `packages/6K-Labs/src/info-provider.ts`: current DOM-based provider and 6K Labs query shape.
  - `packages/6K-Labs/src/globalThis.d.ts`: active editor file; likely type work in progress.
  - `packages/6K-Labs/backend-server/index.go`: current Go HTTP + WebSocket bridge.
  - `packages/6K-Labs/AGENTS.md`: package notes.
- BetterNCM framework reference is already present at `D:\Coding\BetterNCM-Workspace\private\references\BetterNCM`.

## Current Findings

The existing 6K-Labs design starts `bncm-6k-labs-server.exe` from TS, then the plugin connects back over WebSocket. This makes lifecycle hard because BetterNCM appears to expose `onLoad`, `onConfig`, and `onAllPluginsLoaded`, but no reliable plugin `onUnload` hook.

BetterNCM native plugins are loaded by `Plugin::loadNativePluginDll` in `private/references/BetterNCM/src/PluginManager.cpp`. The loader uses `LoadLibrary`, then looks for an exported `BetterNCMPluginMain`. Native APIs are registered through `addNativeAPI`; in non-Renderer processes `addNativeAPI` is an empty implementation. This means JS-callable native APIs are effectively Renderer-side.

BetterNCM exposes native plugin APIs to JS through `betterncm_native.native_plugin.call(identifier, args)` and `getRegisteredAPIs` in `private/references/BetterNCM/src/v8NativeCalls.cpp`.

## InfLink-rs Research

InfLink-rs public plugin API is JS-level, not native ABI-level.

Important links:

- InfLink-rs API docs: https://github.com/apoint123/inflink-rs/blob/main/docs/inflink-api.md
- Global API implementation: https://github.com/apoint123/inflink-rs/blob/main/packages/frontend/src/hooks/useGlobalApi.ts
- API type definition: https://github.com/apoint123/inflink-rs/blob/main/packages/frontend/src/types/api.d.ts
- Native bridge implementation: https://github.com/apoint123/inflink-rs/blob/main/packages/frontend/src/services/NativeBackend.ts
- Rust FFI registration: https://github.com/apoint123/inflink-rs/blob/main/packages/backend/src/ffi.rs

InfLink-rs exposes `window.InfLinkApi` after it initializes. Public methods include:

- `getCurrentSong()`
- `getPlaybackStatus()`
- `getTimeline()`
- `getPlayMode()`
- `getVolume()`
- playback controls like `play`, `pause`, `next`, `previous`, `seekTo`
- event subscription via `addEventListener` / `removeEventListener` for `songChange`, `playStateChange`, `timelineUpdate`, `rawTimelineUpdate`, `playModeChange`, `volumeChange`, and `audioDataUpdate`.

InfLink-rs docs recommend dependents add this to manifest:

```json
{
  "loadAfter": ["InfLinkrs"],
  "requirements": ["InfLinkrs"]
}
```

Local `external/js-framework` types include `loadAfter/loadBefore`; local BetterNCM plugin schema from GitHub also includes `requirements`. Runtime should still check `window.InfLinkApi` because docs say the API exists only after successful initialization.

InfLink-rs native APIs (`inflink.initialize`, `inflink.terminate`, `inflink.dispatch`, etc.) are intended for its own frontend-to-backend bridge. `dispatch` accepts update/control messages such as `UpdateMetadata`, `UpdateTimeline`, `EnableSmtc`, `EnableDiscord`; it is not a public query API for current playback state. Direct native-to-native calls into InfLink-rs are not recommended.

## Recommended Architecture

Use InfLink-rs as the information source in JS, and keep the 6K-Labs native Rust backend as a dumb HTTP snapshot server.

Proposed flow:

```text
InfLink-rs JS adapter -> window.InfLinkApi
6K-Labs JS -> reads/subscribes to window.InfLinkApi -> converts to 6K Labs query JSON
6K-Labs JS -> betterncm_native.native_plugin.call("6klabs.updateSnapshot", [json])
6K-Labs Rust native DLL -> stores latest snapshot in Arc/RwLock
6K-Labs Rust native DLL -> serves 127.0.0.1:9863/query from cached snapshot
```

This avoids calling V8 callbacks from an HTTP server thread. Native code only handles HTTP, lifecycle, and a JSON string cache.

Suggested registered native APIs for 6K-Labs:

- `6klabs.initialize`: start server if not running.
- `6klabs.terminate`: stop server, for reload/beforeunload cleanup.
- `6klabs.updateSnapshot`: replace cached query JSON string.
- `6klabs.health`: optional diagnostics, returns JSON status.

## Implementation Notes

1. Add a Rust native backend, likely under `packages/6K-Labs/backend-rs` or `packages/6K-Labs/native`.
2. Build as a Windows `cdylib` named `backend.dll` or similar.
3. Update `packages/6K-Labs/manifest.json` with `native_plugin`, `loadAfter`, and `requirements`.
4. Replace old Go sidecar build in `packages/6K-Labs/package.json` with Rust build commands.
5. Replace `backend.ts`/`service.ts` responsibilities with a thin native bridge client and an InfLink provider/cache.
6. Preserve `info-provider.ts` query shape; map InfLink-rs fields into existing 6K Labs response format.
7. Keep DOMProvider only as a dev fallback if useful; default should be InfLink-rs.
8. Eventually remove `backend-server/` and process-killing PowerShell code.

## Mapping Hints

Current 6K Labs `Query` shape lives in `packages/6K-Labs/src/info-provider.ts`:

- `player.hasSong`: `InfLinkApi.getCurrentSong() !== null`
- `player.isPaused`: `InfLinkApi.getPlaybackStatus() !== "Playing"`
- `player.volumePercent`: `InfLinkApi.getVolume().volume * 100`
- `player.seekbarCurrentPosition`: likely seconds; current DOM provider parses `m:ss` to seconds.
- `player.statePercent`: `currentTime / totalTime` from `InfLinkApi.getTimeline()`.
- `track.title`: `song.songName`
- `track.author`: `song.authorName`
- `track.album`: `song.albumName`
- `track.cover`: prefer `song.cover?.url`; blob would need object URL/base64 if 6K Labs requires reachable URL.
- `track.duration`: likely seconds; InfLink-rs duration is milliseconds.
- `track.url`: `https://music.163.com/song?id=${song.ncmId}`
- `track.id`: stringified `song.ncmId`

Double-check 6K Labs expected units before finalizing. Existing code uses seconds for parsed timeline/duration while InfLink-rs uses milliseconds.

## Risks / Questions

- InfLink-rs availability: `window.InfLinkApi` may not exist immediately even with `loadAfter`; implement retry or degraded UI state.
- Cover handling: InfLink-rs can provide a Blob and/or URL. 6K Labs may need a public URL; confirm behavior.
- Native process choice: Renderer-side native APIs are simplest. Main-process HTTP server would have better lifecycle but needs IPC to Renderer; not recommended for first pass.
- Port conflicts: keep `127.0.0.1:9863`; add clear health/status error if occupied.
- Rust toolchain: user asked about rustup profile. Suggested: minimal profile plus `rustfmt` and `clippy`; use `RUSTUP_HOME`/`CARGO_HOME` to install outside C drive.

## Suggested Skills

- `openai-docs`: only if questions arise about Codex/app behavior, not needed for implementation.
- `domain-modeling`: useful if recording an ADR for the architectural shift from sidecar exe to native DLL snapshot server.
- `tdd`: useful if writing tests for InfLink-to-6K mapping and snapshot-server behavior.

## Important Local Instructions

- On this Windows host, use explicit UTF-8 encoding for text operations.
- Use PowerShell syntax; Bash is not installed.
- Prefer `pnpm run <script>` and `pnpm exec <bin>`.
- Do not use global npm installs.
- Keep `AGENTS.md` files concise and update them if project structure/commands change.
