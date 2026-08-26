---
status: accepted
---

# Serve The 6K Labs Query Contract Over Local HTTP

6K-Labs exposes playback state through `GET http://127.0.0.1:9863/query`. The endpoint returns the 6K Labs `Query` JSON shape, uses the established 6K Labs field names and units, enables browser access through CORS, and does not include diagnostic fields.

When playback data is unavailable, the native cache is not ready, or the JavaScript adapter heartbeat is stale, `/query` returns `emptyQuery`.
