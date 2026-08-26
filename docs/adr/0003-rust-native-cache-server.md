---
status: accepted
---

# Use A Rust Native Cache Server

The native DLL owns the local HTTP server and the native 6K Labs Query cache. Rust receives playback information only through JavaScript pushes, serves `/query` from its cache, and does not call InfLink-rs native APIs or pull JavaScript state during HTTP requests.

Rust source lives in `packages/6K-Labs/native/`, the crate is named `better_ncm_6k_labs_native`, the built DLL is copied to `dist/6k-labs-native.dll`, and `manifest.json` declares `"native_plugin": "6k-labs-native.dll"`.
