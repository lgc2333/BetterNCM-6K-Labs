# 6K-Labs AGENTS.md

## Project Structure

- `src/main.ts`: plugin entry bundled by esbuild.
- `src/backend.ts`, `src/service.ts`, `src/info-provider.ts`: plugin runtime/service code.
- `src/ui/`: TSX UI, including the config panel.
- `src/utils/`: shared package utilities.
- `backend-server/`: Go backend built into `dist/bncm-6k-labs-server.exe`.
- `manifest.json`: plugin metadata copied into `dist/` after builds.
- `preview.png`: plugin preview copied into `dist/` when present.
- `dist/`: generated build output; do not edit by hand.

## Commands

- `pnpm run build`: build minified plugin JS, build the Go backend, then copy metadata/assets.
- `pnpm run build:dev`: build JS with inline sourcemaps, build the Go backend, then copy metadata/assets.
- `pnpm run build:js`: bundle only `src/main.ts`.
- `pnpm run build:server`: compile `backend-server/` into `dist/bncm-6k-labs-server.exe`.
- `pnpm run check`: run TypeScript project checks.
- `pnpm run analyze`: inspect the bundled JS output.
- `pnpm run apply`: copy `dist/` into the BetterNCM dev plugin directory.

## Rules

To be added
