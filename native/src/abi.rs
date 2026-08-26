use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_void};

use crate::native_result;

#[repr(C)]
#[derive(Clone, Copy)]
#[allow(dead_code)]
pub(crate) enum NativeApiType {
    Int = 0,
    Boolean = 1,
    Double = 2,
    String = 3,
    V8Value = 4,
}

#[repr(C)]
pub struct PluginApi {
    add_native_api: unsafe extern "C" fn(
        args: *mut NativeApiType,
        args_num: c_int,
        identifier: *const c_char,
        function: unsafe extern "C" fn(*mut *mut c_void) -> *mut c_char,
    ) -> c_int,
    _betterncm_version: *const c_char,
    _process_type: c_int,
    _ncm_version: *const [u16; 3],
}

static STRING_ARGS: [NativeApiType; 1] = [NativeApiType::String];
static V8_ARGS: [NativeApiType; 1] = [NativeApiType::V8Value];

type NativeFunction = unsafe extern "C" fn(*mut *mut c_void) -> *mut c_char;

pub unsafe fn register_api(
    api: *mut PluginApi,
    identifier: &str,
    args: &'static [NativeApiType],
    function: NativeFunction,
) -> Result<(), String> {
    let api = unsafe { api.as_mut() }.ok_or_else(|| "missing PluginAPI".to_string())?;
    let identifier =
        CString::new(identifier).map_err(|_| "native API identifier contains nul".to_string())?;
    let (args_ptr, args_len) = if args.is_empty() {
        (std::ptr::null_mut(), 0)
    } else {
        (args.as_ptr() as *mut NativeApiType, args.len() as c_int)
    };

    let result = unsafe { (api.add_native_api)(args_ptr, args_len, identifier.as_ptr(), function) };
    // BetterNCM's addNativeAPI returns true (nonzero) on success; the placeholder stub
    // used outside the renderer process returns false (zero).
    if result != 0 {
        Ok(())
    } else {
        Err(format!("addNativeAPI rejected {identifier:?}"))
    }
}

pub fn string_args() -> &'static [NativeApiType] {
    &STRING_ARGS
}

pub fn v8_args() -> &'static [NativeApiType] {
    &V8_ARGS
}

pub fn no_args() -> &'static [NativeApiType] {
    &[]
}

pub unsafe fn read_string_arg(args: *mut *mut c_void, index: usize) -> Result<String, String> {
    let ptr = unsafe { *args.add(index) as *const c_char };
    if ptr.is_null() {
        return Err(format!("argument {index} is null"));
    }

    unsafe { CStr::from_ptr(ptr) }
        .to_str()
        .map(str::to_string)
        .map_err(|error| format!("argument {index} is not UTF-8: {error}"))
}

pub fn registration_error(error: impl Into<String>) -> c_int {
    let error = error.into();
    let _ = native_result::err(error);
    -1
}
