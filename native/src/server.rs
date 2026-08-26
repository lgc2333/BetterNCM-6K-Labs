use std::io::ErrorKind;
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::cache::Cache;
use crate::http::handle_connection;
use crate::status::{ServerStatus, StatusStore};

pub const SERVER_PORT: u16 = 9863;

pub struct ServerHandle {
    running: Arc<AtomicBool>,
    join_handle: Option<JoinHandle<()>>,
}

impl ServerHandle {
    pub fn start(cache: Arc<Cache>, status: StatusStore) -> Result<Self, String> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, SERVER_PORT))
            .map_err(|error| format!("failed to bind 127.0.0.1:{SERVER_PORT}: {error}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|error| format!("failed to configure HTTP listener: {error}"))?;

        let running = Arc::new(AtomicBool::new(true));
        let thread_running = Arc::clone(&running);
        let thread_status = status.clone();

        let join_handle = thread::Builder::new()
            .name("6k-labs-native-cache-server".to_string())
            .spawn(move || serve_loop(listener, cache, thread_status, thread_running))
            .map_err(|error| format!("failed to spawn HTTP server thread: {error}"))?;

        status.set(ServerStatus::listening());

        Ok(Self {
            running,
            join_handle: Some(join_handle),
        })
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn stop(mut self, status: &StatusStore) {
        self.running.store(false, Ordering::SeqCst);
        let _ = TcpStream::connect((Ipv4Addr::LOCALHOST, SERVER_PORT));
        if let Some(join_handle) = self.join_handle.take() {
            let _ = join_handle.join();
        }
        status.set(ServerStatus::stopped());
    }
}

fn serve_loop(
    listener: TcpListener,
    cache: Arc<Cache>,
    status: StatusStore,
    running: Arc<AtomicBool>,
) {
    while running.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => handle_connection(stream, Arc::clone(&cache)),
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                running.store(false, Ordering::SeqCst);
                status.set(ServerStatus::failed(format!(
                    "HTTP listener failed: {error}"
                )));
                return;
            }
        }
    }
}
