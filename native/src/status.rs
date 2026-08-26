use std::sync::{Arc, RwLock};

use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerState {
    Up,
    Down,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerReason {
    Starting,
    Listening,
    Stopped,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ServerStatus {
    pub state: ServerState,
    pub reason: ServerReason,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl ServerStatus {
    pub fn starting() -> Self {
        Self {
            state: ServerState::Down,
            reason: ServerReason::Starting,
            detail: None,
        }
    }

    pub fn listening() -> Self {
        Self {
            state: ServerState::Up,
            reason: ServerReason::Listening,
            detail: None,
        }
    }

    pub fn stopped() -> Self {
        Self {
            state: ServerState::Down,
            reason: ServerReason::Stopped,
            detail: None,
        }
    }

    pub fn failed(detail: impl Into<String>) -> Self {
        Self {
            state: ServerState::Down,
            reason: ServerReason::Failed,
            detail: Some(detail.into()),
        }
    }
}

#[derive(Clone)]
pub struct StatusStore {
    status: Arc<RwLock<ServerStatus>>,
}

impl StatusStore {
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(ServerStatus::stopped())),
        }
    }

    pub fn get(&self) -> ServerStatus {
        self.status.read().expect("status lock poisoned").clone()
    }

    pub fn set(&self, status: ServerStatus) {
        *self.status.write().expect("status lock poisoned") = status;
    }
}

impl Default for StatusStore {
    fn default() -> Self {
        Self::new()
    }
}
