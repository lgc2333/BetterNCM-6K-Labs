# 6K-Labs AGENTS.md

Note: This package is intended to work within the `lgc2333/BetterNCM-Workspace` repository, as it relies on additional agent rules, configurations, and scripts contained therein. If you have not received any indication that you are operating under this repository, please stop now and notify the user.

## Project Structure

- `src`
  - `main.ts`: plugin entry bundled by esbuild.
  - `native.ts`: BetterNCM native call adapter.
  - `source-adapter.ts`: InfLink-rs subscription and native dispatch adapter.
  - `cover.ts`, `settings.ts`, `inflink-api.ts`: cover contract, plugin config, and InfLink-rs public types.
  - `ui/`: TSX UI, including the config panel.
  - `utils/`: shared package utilities.
- `native/`: Rust `cdylib` crate `better_ncm_6k_labs_native`.
- `dist/`: generated build output.
- `docs/`
  - `adr/`: accepted architecture decisions for this package.
  - `archived/`: archived handoffs and research notes; ADRs win on conflicts.
- `manifest.json`, `preview.png`: plugin metadata and preview copied into `dist/` after builds.

## Commands

- `pnpm run build`: build minified plugin JS, build the Rust native DLL, then copy metadata/assets.
- `pnpm run build:dev`: build JS with inline sourcemaps, build the Rust native DLL, then copy metadata/assets.
- `pnpm run build:native`: compile `native/` for i686 + x86_64 MSVC via `scripts/build-native.ts`, then copy metadata/assets via `scripts/post-build.ts`. Output DLLs follow BetterNCM naming: `6k-labs-native.dll` (ia32) and `6k-labs-native.dll.x64.dll` (x64 fallback).
- `pnpm test` (workspace) / `pnpm vitest run` (package): run Vitest unit tests. Pure tests use `*.test.ts` (node project); DOM-dependent ones `*.dom.test.ts` (happy-dom project). Native bridge, source adapter, and cover pipeline require DOM globals; adapter's FileReader-drain helper needs a module-load-captured real `setTimeout` because fake timers freeze happy-dom events.
- `pnpm run analyze`: inspect the bundled JS output.
- `pnpm run apply`: copy `dist/` into the BetterNCM dev plugin directory.

## Rules

- ADRs in `docs/adr/` are the source of truth; archived docs are historical.
- Keep JavaScript as a push adapter only; Rust owns cache freshness, HTTP, and query mapping.
