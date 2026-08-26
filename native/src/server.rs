use std::net::Ipv4Addr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use tiny_http::Server;

use crate::cache::Cache;
use crate::http::handle_request;
use crate::status::{ServerStatus, StatusStore};

pub const SERVER_PORT: u16 = 9863;
const REQUEST_POLL_TIMEOUT: Duration = Duration::from_millis(250);

pub struct ServerHandle {
    running: Arc<AtomicBool>,
    server: Arc<Server>,
    join_handle: Option<JoinHandle<()>>,
}

impl ServerHandle {
    pub fn start(cache: Arc<Cache>, status: StatusStore) -> Result<Self, String> {
        let server = Server::http((Ipv4Addr::LOCALHOST, SERVER_PORT))
            .map_err(|error| format!("failed to bind 127.0.0.1:{SERVER_PORT}: {error}"))?;
        let server = Arc::new(server);

        let running = Arc::new(AtomicBool::new(true));
        let thread_running = Arc::clone(&running);
        let thread_server = Arc::clone(&server);
        let thread_status = status.clone();

        let join_handle = thread::Builder::new()
            .name("6k-labs-native-cache-server".to_string())
            .spawn(move || serve_loop(thread_server, cache, thread_status, thread_running))
            .map_err(|error| format!("failed to spawn HTTP server thread: {error}"))?;

        status.set(ServerStatus::listening());

        Ok(Self {
            running,
            server,
            join_handle: Some(join_handle),
        })
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn stop(mut self, status: &StatusStore) {
        self.running.store(false, Ordering::SeqCst);
        self.server.unblock();
        if let Some(join_handle) = self.join_handle.take() {
            let _ = join_handle.join();
        }
        status.set(ServerStatus::stopped());
    }
}

fn serve_loop(
    server: Arc<Server>,
    cache: Arc<Cache>,
    status: StatusStore,
    running: Arc<AtomicBool>,
) {
    while running.load(Ordering::SeqCst) {
        match server.recv_timeout(REQUEST_POLL_TIMEOUT) {
            Ok(Some(request)) => handle_request(request, Arc::clone(&cache)),
            Ok(None) => {}
            Err(error) => {
                running.store(false, Ordering::SeqCst);
                status.set(ServerStatus::failed(format!("HTTP server failed: {error}")));
                return;
            }
        }
    }
}
