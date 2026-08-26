use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

use crate::cache::Cache;

const REQUEST_READ_TIMEOUT: Duration = Duration::from_secs(2);

pub fn handle_connection(mut stream: TcpStream, cache: Arc<Cache>) {
    let _ = stream.set_read_timeout(Some(REQUEST_READ_TIMEOUT));

    let mut buffer = [0_u8; 8192];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(0) => return,
        Ok(bytes_read) => bytes_read,
        Err(error) => {
            let _ = write_response(
                &mut stream,
                400,
                "Bad Request",
                "text/plain; charset=utf-8",
                &format!("failed to read request: {error}"),
            );
            return;
        }
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let Some(request_line) = request.lines().next() else {
        let _ = write_response(
            &mut stream,
            400,
            "Bad Request",
            "text/plain; charset=utf-8",
            "missing request line",
        );
        return;
    };

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();
    let path = target.split('?').next().unwrap_or(target);

    if method == "OPTIONS" {
        let _ = write_response(&mut stream, 204, "No Content", "text/plain", "");
        return;
    }

    if path != "/query" {
        let _ = write_response(
            &mut stream,
            404,
            "Not Found",
            "text/plain; charset=utf-8",
            "not found",
        );
        return;
    }

    if method != "GET" {
        let _ = write_response(
            &mut stream,
            405,
            "Method Not Allowed",
            "text/plain; charset=utf-8",
            "method not allowed",
        );
        return;
    }

    let body = cache.query_json();
    let _ = write_response(
        &mut stream,
        200,
        "OK",
        "application/json; charset=utf-8",
        &body,
    );
}

fn write_response(
    stream: &mut TcpStream,
    status_code: u16,
    reason: &str,
    content_type: &str,
    body: &str,
) -> std::io::Result<()> {
    let headers = format!(
        "HTTP/1.1 {status_code} {reason}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type\r\n\
         Access-Control-Max-Age: 3600\r\n\
         Content-Type: {content_type}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n",
        body.len()
    );
    stream.write_all(headers.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}
