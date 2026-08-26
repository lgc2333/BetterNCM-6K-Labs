use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Deserialize)]
struct NativeSongInfo {
    #[serde(rename = "songName")]
    song_name: String,
    #[serde(rename = "albumName")]
    album_name: String,
    #[serde(rename = "authorName")]
    author_name: String,
    #[serde(rename = "ncmId")]
    ncm_id: i64,
    duration: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
enum PlaybackStatus {
    Playing,
    Paused,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct TimelineInfo {
    #[serde(rename = "currentTime")]
    current_time: u64,
    #[serde(rename = "totalTime")]
    total_time: u64,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct VolumeInfo {
    volume: f64,
    #[serde(rename = "isMuted")]
    _is_muted: bool,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct PlayMode {
    #[serde(rename = "isShuffling")]
    _is_shuffling: bool,
    #[serde(rename = "repeatMode")]
    repeat_mode: RepeatMode,
}

#[derive(Debug, Clone, Copy, Deserialize)]
enum RepeatMode {
    None,
    Track,
    List,
    AI,
}

#[derive(Debug, Clone, Deserialize)]
struct CoverUpdate {
    #[serde(rename = "songId")]
    song_id: i64,
    value: String,
    #[serde(rename = "mode")]
    _mode: String,
    #[serde(rename = "quality")]
    _quality: String,
}

#[derive(Debug, Clone, Copy)]
struct TimelineSnapshot {
    current_ms: u64,
    total_ms: u64,
    updated_at: Instant,
}

#[derive(Debug, Default)]
struct CacheInner {
    song_received: bool,
    song: Option<NativeSongInfo>,
    playback_status: Option<PlaybackStatus>,
    timeline: Option<TimelineSnapshot>,
    play_mode: Option<PlayMode>,
    volume: Option<VolumeInfo>,
    cover: Option<String>,
    last_heartbeat: Option<Instant>,
}

#[derive(Default)]
pub struct Cache {
    inner: Mutex<CacheInner>,
}

impl Cache {
    pub fn dispatch_json(&self, message_json: &str) -> Result<(), String> {
        let value = serde_json::from_str::<Value>(message_json)
            .map_err(|error| format!("invalid dispatch JSON: {error}"))?;
        let message_type = value
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| "dispatch message missing type".to_string())?;

        match message_type {
            "Heartbeat" => {
                self.inner
                    .lock()
                    .expect("cache lock poisoned")
                    .last_heartbeat = Some(Instant::now());
                Ok(())
            }
            "UpdateState" => {
                let payload = value
                    .get("payload")
                    .ok_or_else(|| "UpdateState missing payload".to_string())?;
                self.apply_update(payload)
            }
            other => Err(format!("unknown dispatch message type: {other}")),
        }
    }

    pub fn query_json(&self) -> String {
        serde_json::to_string(&self.query()).expect("query serialization should not fail")
    }

    fn query(&self) -> Query {
        let now = Instant::now();
        let inner = self.inner.lock().expect("cache lock poisoned");
        inner.query(now)
    }

    fn apply_update(&self, payload: &Value) -> Result<(), String> {
        let mut inner = self.inner.lock().expect("cache lock poisoned");
        let now = Instant::now();

        if let Some(value) = payload.get("playbackStatus") {
            let status = parse_field::<PlaybackStatus>("playbackStatus", value)?;
            inner.set_playback_status(status, now);
        }

        if let Some(value) = payload.get("song") {
            inner.song_received = true;
            if value.is_null() {
                inner.song = None;
                inner.timeline = None;
                inner.cover = None;
            } else {
                inner.song = Some(parse_field::<NativeSongInfo>("song", value)?);
            }
        }

        if let Some(value) = payload.get("timeline") {
            if value.is_null() {
                inner.timeline = None;
            } else {
                let timeline = parse_field::<TimelineInfo>("timeline", value)?;
                inner.timeline = Some(TimelineSnapshot {
                    current_ms: timeline.current_time,
                    total_ms: timeline.total_time,
                    updated_at: now,
                });
            }
        }

        if let Some(value) = payload.get("playMode") {
            inner.play_mode = Some(parse_field::<PlayMode>("playMode", value)?);
        }

        if let Some(value) = payload.get("volume") {
            inner.volume = Some(parse_field::<VolumeInfo>("volume", value)?);
        }

        if let Some(value) = payload.get("cover") {
            let cover = parse_field::<CoverUpdate>("cover", value)?;
            inner.apply_cover(cover);
        }

        Ok(())
    }
}

impl CacheInner {
    fn query(&self, now: Instant) -> Query {
        if !self.is_heartbeat_fresh(now) || !self.is_ready() {
            return Query::empty();
        }

        let Some(song) = &self.song else {
            return Query::empty();
        };

        let playback_status = self
            .playback_status
            .expect("ready cache has playback status");
        let timeline = self.current_timeline(now, playback_status);
        let volume = self.volume.expect("ready cache has volume");
        let play_mode = self.play_mode.expect("ready cache has play mode");

        let duration_ms = song
            .duration
            .unwrap_or(timeline.total_ms)
            .max(timeline.total_ms);
        let current_ms = timeline.current_ms.min(duration_ms);
        let duration_seconds = millis_to_seconds(duration_ms);
        let current_seconds = millis_to_seconds(current_ms);
        let state_percent = if duration_ms == 0 {
            0.0
        } else {
            (current_ms as f64 / duration_ms as f64).clamp(0.0, 1.0)
        };
        let volume_percent = (volume.volume.clamp(0.0, 1.0) * 100.0).clamp(0.0, 100.0);
        let id = song.ncm_id.to_string();

        Query {
            player: PlayerInfo {
                has_song: true,
                is_paused: playback_status != PlaybackStatus::Playing,
                volume_percent,
                seekbar_current_position: current_seconds,
                seekbar_current_position_human: format_seconds(current_seconds),
                state_percent,
                like_status: "INDIFFERENT".to_string(),
                repeat_type: repeat_type(play_mode.repeat_mode).to_string(),
            },
            track: TrackInfo {
                author: song.author_name.clone(),
                title: song.song_name.clone(),
                album: song.album_name.clone(),
                cover: self.cover.clone().unwrap_or_default(),
                duration: duration_seconds,
                duration_human: format_seconds(duration_seconds),
                url: format!("https://music.163.com/song?id={id}"),
                id,
                is_video: false,
                is_advertisement: false,
                in_library: false,
            },
        }
    }

    fn is_heartbeat_fresh(&self, now: Instant) -> bool {
        self.last_heartbeat
            .is_some_and(|last| now.duration_since(last) <= HEARTBEAT_TIMEOUT)
    }

    fn is_ready(&self) -> bool {
        self.song_received
            && (self.song.is_none()
                || (self.playback_status.is_some()
                    && self.timeline.is_some()
                    && self.play_mode.is_some()
                    && self.volume.is_some()))
    }

    fn set_playback_status(&mut self, status: PlaybackStatus, now: Instant) {
        if let (Some(previous_status), Some(timeline)) = (self.playback_status, self.timeline) {
            self.timeline = Some(interpolated_timeline(timeline, previous_status, now));
        }
        self.playback_status = Some(status);
    }

    fn current_timeline(&self, now: Instant, playback_status: PlaybackStatus) -> TimelineSnapshot {
        interpolated_timeline(
            self.timeline.expect("ready cache has timeline"),
            playback_status,
            now,
        )
    }

    fn apply_cover(&mut self, cover: CoverUpdate) {
        if self
            .song
            .as_ref()
            .is_some_and(|song| song.ncm_id == cover.song_id)
        {
            self.cover = Some(cover.value);
        }
    }
}

fn parse_field<T>(name: &str, value: &Value) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_value(value.clone()).map_err(|error| format!("invalid {name}: {error}"))
}

fn interpolated_timeline(
    timeline: TimelineSnapshot,
    playback_status: PlaybackStatus,
    now: Instant,
) -> TimelineSnapshot {
    if playback_status != PlaybackStatus::Playing {
        return TimelineSnapshot {
            updated_at: now,
            ..timeline
        };
    }

    let elapsed_ms = now.duration_since(timeline.updated_at).as_millis();
    let elapsed_ms = u64::try_from(elapsed_ms).unwrap_or(u64::MAX);
    TimelineSnapshot {
        current_ms: timeline
            .current_ms
            .saturating_add(elapsed_ms)
            .min(timeline.total_ms),
        updated_at: now,
        ..timeline
    }
}

fn repeat_type(repeat_mode: RepeatMode) -> &'static str {
    match repeat_mode {
        RepeatMode::None | RepeatMode::AI => "NONE",
        RepeatMode::List => "ALL",
        RepeatMode::Track => "ONE",
    }
}

fn millis_to_seconds(ms: u64) -> u64 {
    ms / 1000
}

fn format_seconds(total_seconds: u64) -> String {
    let seconds = total_seconds % 60;
    let minutes = (total_seconds / 60) % 60;
    let hours = total_seconds / 3600;

    if hours == 0 {
        format!("{minutes}:{seconds:02}")
    } else {
        format!("{hours}:{minutes:02}:{seconds:02}")
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct Query {
    player: PlayerInfo,
    track: TrackInfo,
}

impl Query {
    fn empty() -> Self {
        Self {
            player: PlayerInfo {
                has_song: false,
                is_paused: true,
                volume_percent: 0.0,
                seekbar_current_position: 0,
                seekbar_current_position_human: "0:00".to_string(),
                state_percent: 0.0,
                like_status: "INDIFFERENT".to_string(),
                repeat_type: "NONE".to_string(),
            },
            track: TrackInfo {
                author: String::new(),
                title: String::new(),
                album: String::new(),
                cover: String::new(),
                duration: 0,
                duration_human: "0:00".to_string(),
                url: String::new(),
                id: String::new(),
                is_video: false,
                is_advertisement: false,
                in_library: false,
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct PlayerInfo {
    #[serde(rename = "hasSong")]
    has_song: bool,
    #[serde(rename = "isPaused")]
    is_paused: bool,
    #[serde(rename = "volumePercent")]
    volume_percent: f64,
    #[serde(rename = "seekbarCurrentPosition")]
    seekbar_current_position: u64,
    #[serde(rename = "seekbarCurrentPositionHuman")]
    seekbar_current_position_human: String,
    #[serde(rename = "statePercent")]
    state_percent: f64,
    #[serde(rename = "likeStatus")]
    like_status: String,
    #[serde(rename = "repeatType")]
    repeat_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
struct TrackInfo {
    author: String,
    title: String,
    album: String,
    cover: String,
    duration: u64,
    #[serde(rename = "durationHuman")]
    duration_human: String,
    url: String,
    id: String,
    #[serde(rename = "isVideo")]
    is_video: bool,
    #[serde(rename = "isAdvertisement")]
    is_advertisement: bool,
    #[serde(rename = "inLibrary")]
    in_library: bool,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn full_update() -> String {
        json!({
            "type": "UpdateState",
            "payload": {
                "song": {
                    "songName": "Title",
                    "albumName": "Album",
                    "authorName": "Artist",
                    "ncmId": 42,
                    "duration": 125000
                },
                "playbackStatus": "Paused",
                "timeline": {
                    "currentTime": 61000,
                    "totalTime": 125000
                },
                "playMode": {
                    "isShuffling": false,
                    "repeatMode": "Track"
                },
                "volume": {
                    "volume": 0.42,
                    "isMuted": false
                }
            }
        })
        .to_string()
    }

    #[test]
    fn returns_empty_before_heartbeat() {
        let cache = Cache::default();
        cache.dispatch_json(&full_update()).unwrap();

        let query = cache.query();

        assert!(!query.player.has_song);
    }

    #[test]
    fn maps_ready_cache_to_query() {
        let cache = Cache::default();
        cache
            .dispatch_json(r#"{"type":"Heartbeat"}"#)
            .expect("heartbeat should parse");
        cache.dispatch_json(&full_update()).unwrap();
        cache
            .dispatch_json(
                r#"{"type":"UpdateState","payload":{"cover":{"songId":42,"value":"https://p1.music.126.net/a.jpg?imageView&enlarge=1&type=jpeg&quality=90&thumbnail=256y256","mode":"url","quality":"256"}}}"#,
            )
            .unwrap();

        let query = cache.query();

        assert!(query.player.has_song);
        assert!(query.player.is_paused);
        assert_eq!(query.player.volume_percent, 42.0);
        assert_eq!(query.player.seekbar_current_position, 61);
        assert_eq!(query.player.seekbar_current_position_human, "1:01");
        assert_eq!(query.player.repeat_type, "ONE");
        assert_eq!(query.track.title, "Title");
        assert_eq!(query.track.author, "Artist");
        assert_eq!(query.track.album, "Album");
        assert_eq!(query.track.id, "42");
        assert_eq!(query.track.duration, 125);
        assert_eq!(query.track.duration_human, "2:05");
        assert!(
            query
                .track
                .cover
                .starts_with("https://p1.music.126.net/a.jpg")
        );
    }

    #[test]
    fn clears_query_when_song_is_null() {
        let cache = Cache::default();
        cache.dispatch_json(r#"{"type":"Heartbeat"}"#).unwrap();
        cache.dispatch_json(&full_update()).unwrap();
        cache
            .dispatch_json(r#"{"type":"UpdateState","payload":{"song":null}}"#)
            .unwrap();

        let query = cache.query();

        assert!(!query.player.has_song);
        assert_eq!(query.track.cover, "");
    }

    #[test]
    fn ignores_cover_for_a_different_song() {
        let cache = Cache::default();
        cache.dispatch_json(r#"{"type":"Heartbeat"}"#).unwrap();
        cache.dispatch_json(&full_update()).unwrap();
        cache
            .dispatch_json(
                r#"{"type":"UpdateState","payload":{"cover":{"songId":42,"value":"old","mode":"url","quality":"256"}}}"#,
            )
            .unwrap();
        cache
            .dispatch_json(
                r#"{"type":"UpdateState","payload":{"song":{"songName":"Next","albumName":"Album","authorName":"Artist","ncmId":43,"duration":120000}}}"#,
            )
            .unwrap();
        cache
            .dispatch_json(
                r#"{"type":"UpdateState","payload":{"cover":{"songId":42,"value":"late","mode":"url","quality":"256"}}}"#,
            )
            .unwrap();

        let query = cache.query();

        assert_eq!(query.track.id, "43");
        assert_eq!(query.track.cover, "old");
    }
}
