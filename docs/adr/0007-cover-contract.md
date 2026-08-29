---
status: accepted
---

# Handle Cover As A Separate Contract

Cover is configured with `coverMode: 'url' | 'base64url'` and `coverQuality`. Quality presets are `128`, `256`, `512`, `1024`, and `max`; the default is `256`; custom quality accepts integers from `1` to `4096` or `max`; JPEG quality is fixed at `90`.

URL mode returns only externally reachable URLs that start with `http`. For NetEase image URLs, the plugin removes the existing query and appends `?imageView&enlarge=1&type=jpeg&quality=90&thumbnail={size}y{size}`; `max` omits `thumbnail`.

Base64 mode fetches the selected image in JavaScript and sends a complete `data:image/...;base64,...` value through `CoverUpdate`. New song metadata is pushed before cover processing, and the previous cover remains until a matching new cover arrives or the player has no song.

## Considered Options

- Push cover separately from song updates.
- Include `SongInfo.cover` in normal song updates.
- Encode fetched cover bytes in Rust.
- Return internal or non-HTTP cover URLs in URL mode.

## Consequences

Song updates are not blocked by image fetching, and slow cover work cannot overwrite a newer track because `CoverUpdate` carries `songId`. Base64 conversion stays in JavaScript to avoid adding binary V8 argument handling to native code, while URL mode remains usable by external clients.
