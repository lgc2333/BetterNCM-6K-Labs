# Handoff: 6K-Labs Native Cache Server

## Next Session Focus

Implement the 6K-Labs native Rust cache server and JavaScript InfLink-rs adapter from the accepted ADRs. Treat the ADRs as the source of truth; older archived handoffs are historical notes only.

## Source Of Truth

- `packages/6K-Labs/docs/adr/0001-local-query-contract.md`
- `packages/6K-Labs/docs/adr/0002-use-inflink-rs-as-playback-source.md`
- `packages/6K-Labs/docs/adr/0003-rust-native-cache-server.md`
- `packages/6K-Labs/docs/adr/0004-native-interface.md`
- `packages/6K-Labs/docs/adr/0005-source-push-messages.md`
- `packages/6K-Labs/docs/adr/0006-cache-freshness-and-mapping.md`
- `packages/6K-Labs/docs/adr/0007-cover-contract.md`

Do not create a separate design document for this plan unless the user asks. If more decisions are needed, add focused ADRs instead of expanding one broad ADR.

## Important References

- InfLink-rs local source: `private/references/inflink-rs`
- InfLink-rs public API types: `private/references/inflink-rs/packages/frontend/src/types/api.d.ts`
- BetterNCM framework reference: `private/references/BetterNCM`
- Current 6K-Labs package: `packages/6K-Labs`

## Current Decisions In Plain Terms

- External query contract is `GET http://127.0.0.1:9863/query`.
- Playback facts come from `window.InfLinkApi`.
- Rust owns the HTTP server and query cache.
- JavaScript only subscribes to InfLink-rs and pushes source facts; it keeps no playback cache.
- `SongInfo.cover` is omitted from song updates; cover is pushed separately.
- `Heartbeat` is a separate dispatch message with no payload.
- Server status is only about the HTTP server; settings-panel diagnostics cover JS and InfLink-rs state.

## Current Workspace Notes

- Root `AGENTS.md` already records `private/references/inflink-rs`.
- `packages/6K-Labs/AGENTS.md` indexes `docs/adr/`.
- `types/src/global.d.ts` has pre-existing local changes; do not touch it unless the implementation requires it.

## Suggested Skills

- `codebase-design`: use when shaping the Rust/JS module interfaces.
- `tdd`: use when implementing mapping, heartbeat expiry, and cache behavior.
- `frontend-design`: use only when rebuilding the settings panel.
- `domain-modeling`: use only if new architectural decisions need new ADRs.
