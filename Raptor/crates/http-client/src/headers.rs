use hyperdownload_shared::{HttpAuth, HttpOptions};
use reqwest::header::{
    HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, AUTHORIZATION, CONNECTION, USER_AGENT,
};

pub const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

pub fn build_browser_headers(referer: Option<&str>, cookie: Option<&str>) -> HeaderMap {
    let mut options = HttpOptions::default();
    options.referer = referer.map(|s| s.to_string());
    options.cookies = cookie.map(|s| s.to_string());
    build_headers_from_options(&options)
}

pub fn build_headers_from_options(options: &HttpOptions) -> HeaderMap {
    let mut headers = HeaderMap::new();

    let ua = options
        .user_agent
        .as_deref()
        .unwrap_or(DEFAULT_USER_AGENT);
    if let Ok(val) = HeaderValue::from_str(ua) {
        headers.insert(USER_AGENT, val);
    }

    headers.insert(
        ACCEPT,
        HeaderValue::from_static(
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        ),
    );
    headers.insert(
        ACCEPT_LANGUAGE,
        HeaderValue::from_static("en-US,en;q=0.9,tr;q=0.8"),
    );
    headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));

    if let Some(ref_url) = &options.referer {
        if let Ok(val) = HeaderValue::from_str(ref_url) {
            headers.insert("Referer", val);
            if ref_url.contains("instagram.com") {
                headers.insert("Sec-Fetch-Dest", HeaderValue::from_static("video"));
                headers.insert("Sec-Fetch-Mode", HeaderValue::from_static("no-cors"));
                headers.insert("Sec-Fetch-Site", HeaderValue::from_static("cross-site"));
            }
        }
    }

    if let Some(c) = &options.cookies {
        if let Ok(val) = HeaderValue::from_str(c) {
            headers.insert("Cookie", val);
        }
    }

    if let Some(auth) = &options.auth {
        match auth {
            HttpAuth::Bearer { token } => {
                if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                    headers.insert(AUTHORIZATION, val);
                }
            }
            HttpAuth::Basic { username, password } => {
                let raw = format!("{}:{}", username, password.as_deref().unwrap_or(""));
                let encoded = simple_base64_encode(raw.as_bytes());
                if let Ok(val) = HeaderValue::from_str(&format!("Basic {}", encoded)) {
                    headers.insert(AUTHORIZATION, val);
                }
            }
            HttpAuth::CustomHeader { name, value } => {
                if let (Ok(h_name), Ok(h_val)) = (
                    reqwest::header::HeaderName::from_bytes(name.as_bytes()),
                    HeaderValue::from_str(value),
                ) {
                    headers.insert(h_name, h_val);
                }
            }
        }
    }

    headers
}

fn simple_base64_encode(input: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        out.push(CHARSET[((n >> 18) & 63) as usize] as char);
        out.push(CHARSET[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            out.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }

        if chunk.len() > 2 {
            out.push(CHARSET[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_base64() {
        assert_eq!(simple_base64_encode(b"hello world"), "aGVsbG8gd29ybGQ=");
        assert_eq!(simple_base64_encode(b"admin:secret123"), "YWRtaW46c2VjcmV0MTIz");
    }

    #[test]
    fn test_auth_headers() {
        let mut opts = HttpOptions::default();
        opts.auth = Some(HttpAuth::Basic {
            username: "admin".to_string(),
            password: Some("secret123".to_string()),
        });
        let headers = build_headers_from_options(&opts);
        assert_eq!(
            headers.get(AUTHORIZATION).unwrap().to_str().unwrap(),
            "Basic YWRtaW46c2VjcmV0MTIz"
        );
    }
}
