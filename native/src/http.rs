use std::sync::Arc;

use tiny_http::{Header, Method, Request, Response, ResponseBox, StatusCode};

use crate::cache::Cache;

pub fn handle_request(request: Request, cache: Arc<Cache>) {
    let response = response_for(&request, &cache);
    let _ = request.respond(response);
}

fn response_for(request: &Request, cache: &Cache) -> ResponseBox {
    let path = request.url().split('?').next().unwrap_or(request.url());

    if request.method() == &Method::Options {
        return with_cors(Response::empty(StatusCode(204))).boxed();
    }

    if path != "/query" {
        return text_response(404, "not found");
    }

    if request.method() != &Method::Get {
        return text_response(405, "method not allowed");
    }

    with_cors(
        Response::from_string(cache.query_json())
            .with_header(header("Content-Type", "application/json; charset=utf-8")),
    )
    .boxed()
}

fn text_response(status_code: u16, body: &str) -> ResponseBox {
    with_cors(
        Response::from_string(body)
            .with_status_code(StatusCode(status_code))
            .with_header(header("Content-Type", "text/plain; charset=utf-8")),
    )
    .boxed()
}

fn with_cors<R>(response: Response<R>) -> Response<R>
where
    R: std::io::Read,
{
    response
        .with_header(header("Access-Control-Allow-Origin", "*"))
        .with_header(header("Access-Control-Allow-Methods", "GET, OPTIONS"))
        .with_header(header("Access-Control-Allow-Headers", "Content-Type"))
        .with_header(header("Access-Control-Max-Age", "3600"))
}

fn header(field: &str, value: &str) -> Header {
    Header::from_bytes(field.as_bytes(), value.as_bytes()).expect("static HTTP header is valid")
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use tiny_http::TestRequest;

    use super::*;

    #[test]
    fn returns_query_json() {
        let cache = Cache::default();
        let request = request(Method::Get, "/query?unused=1");

        let response = response_for(&request, &cache);

        assert_eq!(response.status_code(), StatusCode(200));
        assert_header(&response, "Content-Type", "application/json; charset=utf-8");
        assert_header(&response, "Access-Control-Allow-Origin", "*");
        assert!(body(response).contains(r#""hasSong":false"#));
    }

    #[test]
    fn handles_cors_preflight_on_any_path() {
        let cache = Cache::default();
        let request = request(Method::Options, "/anything");

        let response = response_for(&request, &cache);

        assert_eq!(response.status_code(), StatusCode(204));
        assert_header(&response, "Access-Control-Allow-Methods", "GET, OPTIONS");
    }

    #[test]
    fn rejects_unknown_paths() {
        let cache = Cache::default();
        let request = request(Method::Get, "/nope");

        let response = response_for(&request, &cache);

        assert_eq!(response.status_code(), StatusCode(404));
        assert_eq!(body(response), "not found");
    }

    #[test]
    fn rejects_non_get_query_requests() {
        let cache = Cache::default();
        let request = request(Method::Post, "/query");

        let response = response_for(&request, &cache);

        assert_eq!(response.status_code(), StatusCode(405));
        assert_eq!(body(response), "method not allowed");
    }

    fn request(method: Method, path: &str) -> Request {
        TestRequest::new()
            .with_method(method)
            .with_path(path)
            .into()
    }

    fn assert_header(response: &ResponseBox, field: &str, value: &str) {
        assert!(
            response.headers().iter().any(|header| header
                .field
                .as_str()
                .as_str()
                .eq_ignore_ascii_case(field)
                && header.value.as_str() == value),
            "missing header {field}: {value}",
        );
    }

    fn body(response: ResponseBox) -> String {
        let mut body = String::new();
        response.into_reader().read_to_string(&mut body).unwrap();
        body
    }
}
