# 6K-Labs AGENTS.md

Note: This package is intended to work within the `lgc2333/BetterNCM-Workspace` repository, as it relies on additional agent rules, configurations, and scripts contained therein. If you have not received any indication that you are operating under this repository, please stop now and notify the user.

## Project Structure

- `src`
  - `main.ts`: plugin entry bundled by Vite.
  - `native.ts`: BetterNCM native call adapter.
  - `source-adapter.ts`: InfLink-rs subscription and native dispatch adapter.
  - `cover.ts`, `settings.ts`, `inflink-api.ts`: cover contract, plugin config, and InfLink-rs public types.
  - `ui/`: TSX UI: config panel (`Config.tsx` orchestration + JSX only; presentation helpers `status.ts` (pure view-model, node-tested), `Icon.tsx` (Iconify adapter, lucide set, loads from Iconify API at runtime), `Toast.tsx` (`useToast`/`Toast`), NCM theme detection (`theme.ts`)). Styles live in `Config.css`, bundled into JS and injected as a scoped `<style>` by `vite-plugin-css-injected-by-js`; rendered through the page-global React with the `h` JSX factory (React never bundled — externalized to the `React` global in `vite.config.mts`).
  - `utils/`: shared package utilities (`clipboard.ts`: `copyText` with `execCommand` fallback).
- `native/`: Rust `cdylib` crate `better_ncm_6k_labs_native`.
- `dist/`: generated build output.
- `docs/`
  - `adr/`: accepted architecture decisions for this package.
  - `archived/`: archived handoffs and research notes; ADRs win on conflicts.
- `DESIGN.md`: design token spec (design-md format) for the settings page; UI work must follow it, including the no-`font-family` rule.
- `manifest.json`, `preview.png`: plugin metadata and preview copied into `dist/` after builds.

## Commands

- `pnpm run build`: build minified plugin JS, build the Rust native DLL, then copy metadata/assets.
- `pnpm run build:dev`: build JS with inline sourcemaps, build the Rust native DLL, then copy metadata/assets.
- `pnpm run build:native`: compile `native/` for i686 + x86_64 MSVC via `scripts/build-native.ts`, then copy metadata/assets via `scripts/post-build.ts`. Output DLLs follow BetterNCM naming: `6k-labs-native.dll` (ia32) and `6k-labs-native.dll.x64.dll` (x64 fallback).
- `pnpm test` (workspace) / `pnpm vitest run` (package): run Vitest unit tests. Pure tests use `*.test.ts` (node project); DOM-dependent ones `*.dom.test.ts` (happy-dom project). Native bridge, source adapter, and cover pipeline require DOM globals; adapter's FileReader-drain helper needs a module-load-captured real `setTimeout` because fake timers freeze happy-dom events.
- `pnpm run apply`: copy `dist/` into the BetterNCM dev plugin directory.

## Rules

- Keep JavaScript as a push adapter only; Rust owns cache freshness, HTTP, and query mapping.
