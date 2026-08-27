use std::net::{Ipv4Addr, SocketAddr, TcpListener};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use tiny_http::Server;

use crate::cache::Cache;
use crate::http::handle_request;
use crate::status::{ServerStatus, StatusStore};

pub const SERVER_PORT: u16 = 9863;
const REQUEST_POLL_TIMEOUT: Duration = Duration::from_millis(250);
const PORT_RELEASE_TIMEOUT: Duration = Duration::from_secs(2);
const PORT_RETRY_INTERVAL: Duration = Duration::from_millis(25);

pub struct ServerHandle {
    running: Arc<AtomicBool>,
    server: Arc<Server>,
    join_handle: Option<JoinHandle<()>>,
}

impl ServerHandle {
    pub fn start(cache: Arc<Cache>, status: StatusStore) -> Result<Self, String> {
        let listener = create_exclusive_listener()?;
        Self::from_listener(listener, cache, status)
    }

    pub fn from_listener(
        listener: TcpListener,
        cache: Arc<Cache>,
        status: StatusStore,
    ) -> Result<Self, String> {
        let server = Server::from_listener(listener, None).map_err(|error| {
            format!("failed to start HTTP server on 127.0.0.1:{SERVER_PORT}: {error}")
        })?;
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

fn create_exclusive_listener() -> Result<TcpListener, String> {
    bind_exclusive(SocketAddr::from((Ipv4Addr::LOCALHOST, SERVER_PORT)))
}

/// Binds the server port after a stop, retrying until the previous tiny_http
/// accept thread releases the listening socket. tiny_http's `Server::drop` only
/// signals that thread to exit; it does not wait for it, so the socket may stay
/// open briefly after `ServerHandle::stop` returns.
pub fn bind_after_stop() -> Result<TcpListener, String> {
    wait_port_released(SocketAddr::from((Ipv4Addr::LOCALHOST, SERVER_PORT)))
}

fn wait_port_released(addr: SocketAddr) -> Result<TcpListener, String> {
    let deadline = Instant::now() + PORT_RELEASE_TIMEOUT;
    loop {
        match bind_exclusive(addr) {
            Ok(listener) => return Ok(listener),
            Err(_error) if Instant::now() < deadline => {
                thread::sleep(PORT_RETRY_INTERVAL);
            }
            Err(error) => return Err(error),
        }
    }
}

fn bind_exclusive(addr: SocketAddr) -> Result<TcpListener, String> {
    let socket = socket2::Socket::new(
        socket2::Domain::for_address(addr),
        socket2::Type::STREAM,
        Some(socket2::Protocol::TCP),
    )
    .map_err(|error| format!("failed to create TCP socket: {error}"))?;

    // Rust's std TcpListener sets SO_REUSEADDR on Windows, which silently allows a
    // second process to double-bind the same port. Bind without it and mark our
    // socket exclusive so port conflicts surface as loud startup failures instead
    // of nondeterministic connection stealing.
    #[cfg(windows)]
    set_exclusive_addr_use(&socket)?;

    socket
        .bind(&addr.into())
        .map_err(|error| format!("端口 {addr} 可能被其他程序占用: {error}"))?;
    socket
        .listen(128)
        .map_err(|error| format!("failed to listen on {addr}: {error}"))?;

    Ok(TcpListener::from(socket))
}

#[cfg(windows)]
fn set_exclusive_addr_use(socket: &socket2::Socket) -> Result<(), String> {
    use std::os::windows::io::AsRawSocket;

    use windows_sys::Win32::Networking::WinSock::{
        SO_EXCLUSIVEADDRUSE, SOL_SOCKET, WSAGetLastError, setsockopt,
    };

    let exclusive: i32 = 1;
    let result = unsafe {
        setsockopt(
            socket.as_raw_socket() as usize,
            SOL_SOCKET,
            SO_EXCLUSIVEADDRUSE,
            (&exclusive as *const i32).cast(),
            size_of::<i32>() as i32,
        )
    };
    if result != 0 {
        let wsa_error = unsafe { WSAGetLastError() };
        return Err(format!(
            "failed to set SO_EXCLUSIVEADDRUSE: WSA error {wsa_error}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_second_bind_on_active_port() {
        let first = bind_exclusive("127.0.0.1:0".parse().unwrap())
            .expect("first exclusive bind should succeed");
        let port = first.local_addr().unwrap().port();

        let second = bind_exclusive(SocketAddr::from(([127, 0, 0, 1], port)));

        assert!(second.is_err(), "second bind on active port must fail");
        assert!(second.unwrap_err().contains("可能被其他程序占用"));
    }

    #[test]
    fn waits_for_port_release() {
        let first = bind_exclusive("127.0.0.1:0".parse().unwrap())
            .expect("first exclusive bind should succeed");
        let addr = first.local_addr().unwrap();
        let releaser = thread::spawn(move || {
            thread::sleep(Duration::from_millis(100));
            drop(first);
        });

        let listener = wait_port_released(addr).expect("port should become bindable");

        releaser.join().unwrap();
        drop(listener);
    }

    #[test]
    fn stop_releases_port_for_rebind() {
        let status = StatusStore::new();
        let listener =
            bind_exclusive("127.0.0.1:0".parse().unwrap()).expect("exclusive bind should succeed");
        let addr = listener.local_addr().unwrap();
        let handle =
            ServerHandle::from_listener(listener, Arc::new(Cache::default()), status.clone())
                .expect("server should start from listener");

        handle.stop(&status);

        let rebound = wait_port_released(addr).expect("port should be rebindable after stop");
        drop(rebound);
    }
}
