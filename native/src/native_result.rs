use std::cell::RefCell;
use std::ffi::CString;
use std::os::raw::c_char;

use serde::Serialize;

#[derive(Serialize)]
struct NativeResult<T>
where
    T: Serialize,
{
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

pub fn ok<T>(data: T) -> *mut c_char
where
    T: Serialize,
{
    into_c_string(&NativeResult {
        ok: true,
        data: Some(data),
        error: None,
    })
}

pub fn ok_empty() -> *mut c_char {
    into_c_string(&NativeResult::<()> {
        ok: true,
        data: None,
        error: None,
    })
}

pub fn err(error: impl Into<String>) -> *mut c_char {
    into_c_string(&NativeResult::<()> {
        ok: false,
        data: None,
        error: Some(error.into()),
    })
}

fn into_c_string<T>(value: &T) -> *mut c_char
where
    T: Serialize,
{
    let json = serde_json::to_string(value).unwrap_or_else(|error| {
        format!(r#"{{"ok":false,"error":"failed to serialize native result: {error}"}}"#)
    });
    thread_local! {
        static LAST_RESULT: RefCell<CString> = RefCell::new(
            CString::new("{}").expect("static JSON has no nul bytes"),
        );
    }

    LAST_RESULT.with(|last_result| {
        let mut last_result = last_result.borrow_mut();
        *last_result = CString::new(json).unwrap_or_else(|_| {
            CString::new(r#"{"ok":false,"error":"nul byte in result"}"#)
                .expect("static JSON has no nul bytes")
        });
        last_result.as_ptr() as *mut c_char
    })
}
