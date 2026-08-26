# 6K-Labs

Bridges NCM's player runtime to an owned Rust query cache consumed by external
clients. The JavaScript side is a push adapter; the native side owns freshness
and mapping.

## Language

### Ordering & Playback Facets

**Track Change**:
Switching from one playable song to another. All player facets become stale
until fresh values are pushed.
_Avoid_: song switch, next song

**Full State Push**:
One update carrying every player facet sampled from the source at that
moment. Emitted on Track Change.
_Avoid_: init push, reset

**Incremental Update**:
An update carrying any subset of player facets when one of them moves.
_Avoid_: partial update

### Position

**Timeline Report**:
The source's statement of playback position (current) and duration (total)
at sampling time.

**Extrapolation**:
Advancing the last authoritative position by elapsed wall clock while the
source stays silent and reports Playing. Always anchored to the latest
Timeline Report.
_Avoid_: smoothing, prediction

**Zero Progress**:
A Timeline Report whose current position is exactly 0. Treated as a
position-unknown signal, never as genuine playback at offset 0.
_Avoid_: progress reset, rewind

**Track Load Window**:
The span after a Track Change where the source claims Playing but audio has
not started; position may hold at Zero Progress for seconds or bounce back to
it.

**Zero-Progress Hold**:
During Zero Progress, publish the literal position without Extrapolation;
Extrapolation resumes on the first non-zero authoritative report inside the
window and everywhere else afterwards.
_Avoid_: freeze mode, stall guard

**Ghost Progress**:
Position data from the previous track's audio pipeline arriving after a
Track Change, attributed to the new track. The source cannot currently
distinguish it; the plugin consumes it verbatim and shows it briefly until
the first authoritative report for the new track.
_Avoid_: stale position, leaked progress
