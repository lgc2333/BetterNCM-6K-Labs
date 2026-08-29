---
status: accepted
---

# Keep The Native Interface Small

JavaScript talks to native code through a small BetterNCM native interface:

```ts
interface NativeApiMap {
  initialize: (args?: []) => string
  terminate: (args?: []) => string
  restart: (args?: []) => string
  getServerStatus: (args?: []) => string
  registerServerStatusCallback: (
    args: [callback: (statusJson: string) => void],
  ) => string
  dispatch: (args: [messageJson: string]) => string
}
```

String-returning calls return JSON in this shape:

```ts
interface NativeResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
```

Server status describes only the local HTTP server:

```ts
interface ServerStatus {
  state: 'up' | 'down'
  reason: 'starting' | 'listening' | 'stopped' | 'failed'
  detail?: string
}
```

`detail` carries concrete failure text such as bind errors. InfLink-rs availability, JavaScript adapter state, and source update errors belong to the settings panel diagnostics.

## Considered Options

- Keep lifecycle/status methods explicit and put playback updates behind one `dispatch` call.
- Expose one native method for every playback facet update.
- Encode detailed server failure categories as `reason` variants.

## Consequences

The JavaScript-facing native interface stays small, while playback protocol changes remain inside `dispatch` messages. `ServerStatus.reason` stays broad and stable; concrete bind/listen/stop failures are preserved in `detail`.
