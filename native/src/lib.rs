mod abi;
mod cache;
mod http;
mod native_result;
mod server;
mod status;

use std::os::raw::{c_char, c_int, c_void};
use std::sync::{Arc, Mutex, OnceLock};

use abi::{PluginApi, no_args, read_string_arg, register_api, string_args, v8_args};
use cache::Cache;
use server::{ServerHandle, bind_after_stop};
use status::{ServerStatus, StatusStore};

struct App {
    cache: Arc<Cache>,
    server: Mutex<Option<ServerHandle>>,
    status: StatusStore,
}

impl App {
    fn global() -> &'static Self {
        static APP: OnceLock<App> = OnceLock::new();
        APP.get_or_init(|| App {
            cache: Arc::new(Cache::default()),
            server: Mutex::new(None),
            status: StatusStore::new(),
        })
    }

    fn initialize(&self) -> Result<ServerStatus, String> {
        let mut server = self.server.lock().expect("server lock poisoned");
        if server.as_ref().is_some_and(ServerHandle::is_running) {
            return Ok(self.status.get());
        }

        if let Some(old_server) = server.take() {
            old_server.stop(&self.status);
        }

        self.status.set(ServerStatus::starting());
        match ServerHandle::start(Arc::clone(&self.cache), self.status.clone()) {
            Ok(handle) => {
                *server = Some(handle);
                Ok(self.status.get())
            }
            Err(error) => {
                self.status.set(ServerStatus::failed(error.clone()));
                Err(error)
            }
        }
    }

    fn terminate(&self) -> ServerStatus {
        let mut server = self.server.lock().expect("server lock poisoned");
        if let Some(handle) = server.take() {
            handle.stop(&self.status);
        } else {
            self.status.set(ServerStatus::stopped());
        }
        self.status.get()
    }

    fn restart(&self) -> Result<ServerStatus, String> {
        self.terminate();
        let mut server = self.server.lock().expect("server lock poisoned");
        self.status.set(ServerStatus::starting());
        let listener = bind_after_stop()?;
        match ServerHandle::from_listener(listener, Arc::clone(&self.cache), self.status.clone()) {
            Ok(handle) => {
                *server = Some(handle);
                Ok(self.status.get())
            }
            Err(error) => {
                self.status.set(ServerStatus::failed(error.clone()));
                Err(error)
            }
        }
    }

    fn dispatch(&self, message_json: &str) -> Result<(), String> {
        self.cache.dispatch_json(message_json)
    }

    fn status(&self) -> ServerStatus {
        self.status.get()
    }

    fn register_status_callback(&self) {}
}

/// # Safety
///
/// `api` must be the valid `PluginAPI` pointer provided by BetterNCM while loading the
/// native plugin DLL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn BetterNCMPluginMain(api: *mut PluginApi) -> c_int {
    let result = unsafe {
        register_api(api, "initialize", no_args(), initialize)
            .and_then(|_| register_api(api, "terminate", no_args(), terminate))
            .and_then(|_| register_api(api, "restart", no_args(), restart))
            .and_then(|_| register_api(api, "getServerStatus", no_args(), get_server_status))
            .and_then(|_| {
                register_api(
                    api,
                    "registerServerStatusCallback",
                    v8_args(),
                    register_server_status_callback,
                )
            })
            .and_then(|_| register_api(api, "dispatch", string_args(), dispatch))
    };

    match result {
        Ok(()) => 0,
        Err(error) => abi::registration_error(error),
    }
}

unsafe extern "C" fn initialize(_args: *mut *mut c_void) -> *mut c_char {
    match App::global().initialize() {
        Ok(status) => native_result::ok(status),
        Err(error) => native_result::err(error),
    }
}

unsafe extern "C" fn terminate(_args: *mut *mut c_void) -> *mut c_char {
    native_result::ok(App::global().terminate())
}

unsafe extern "C" fn restart(_args: *mut *mut c_void) -> *mut c_char {
    match App::global().restart() {
        Ok(status) => native_result::ok(status),
        Err(error) => native_result::err(error),
    }
}

unsafe extern "C" fn get_server_status(_args: *mut *mut c_void) -> *mut c_char {
    native_result::ok(App::global().status())
}

unsafe extern "C" fn register_server_status_callback(_args: *mut *mut c_void) -> *mut c_char {
    App::global().register_status_callback();
    native_result::ok_empty()
}

unsafe extern "C" fn dispatch(args: *mut *mut c_void) -> *mut c_char {
    match unsafe { read_string_arg(args, 0) }.and_then(|message| App::global().dispatch(&message)) {
        Ok(()) => native_result::ok_empty(),
        Err(error) => native_result::err(error),
    }
}
