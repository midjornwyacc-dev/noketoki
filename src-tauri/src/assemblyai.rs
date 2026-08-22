use crate::secrets;
use base64::Engine;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Duration;

const SYNC_TRANSCRIBE_URL: &str = "https://sync.assemblyai.com/transcribe";
const SYNC_WARM_URL: &str = "https://sync.assemblyai.com/warm";
const SYNC_MODEL: &str = "universal-3-5-pro";
const LLM_GATEWAY_URL: &str = "https://llm-gateway.assemblyai.com/v1/chat/completions";
const LLM_MODEL: &str = "qwen3.5-4b-32k-fast";

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn err(kind: &str, status: Option<u16>, detail: Option<&str>) -> String {
    let mut value = json!({ "kind": kind });
    if let Some(code) = status {
        value["status"] = json!(code);
    }
    if let Some(text) = detail {
        value["detail"] = json!(text);
    }
    value.to_string()
}

fn http() -> Result<&'static reqwest::Client, String> {
    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|_| err("network", None, None))?;
    let _ = CLIENT.set(client);
    CLIENT.get().ok_or_else(|| err("network", None, None))
}

fn api_key() -> Result<String, String> {
    let key = secrets::load().map_err(|_| err("key", None, None))?;
    if key.trim().is_empty() {
        return Err(err("key", None, None));
    }
    Ok(key)
}

fn map_reqwest(error: reqwest::Error) -> String {
    if error.is_timeout() {
        err("timeout", None, None)
    } else {
        err("network", None, None)
    }
}

fn decode_wav(wav_base64: &str) -> Result<Vec<u8>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(wav_base64.trim())
        .map_err(|_| err("empty", None, None))?;
    if bytes.is_empty() {
        return Err(err("empty", None, None));
    }
    Ok(bytes)
}

pub async fn transcribe_sync(wav_base64: String, config: Value) -> Result<String, String> {
    let key = api_key()?;
    let wav = decode_wav(&wav_base64)?;
    let config_text = serde_json::to_string(&config).unwrap_or_else(|_| "{}".into());
    let form = reqwest::multipart::Form::new()
        .part(
            "audio",
            reqwest::multipart::Part::bytes(wav)
                .file_name("clip.wav")
                .mime_str("audio/wav")
                .map_err(|_| err("network", None, None))?,
        )
        .part(
            "config",
            reqwest::multipart::Part::text(config_text)
                .mime_str("application/json")
                .map_err(|_| err("network", None, None))?,
        );

    let response = http()?
        .post(SYNC_TRANSCRIBE_URL)
        .header("Authorization", key)
        .header("X-AAI-Model", SYNC_MODEL)
        .multipart(form)
        .send()
        .await
        .map_err(map_reqwest)?;

    let status = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let detail = body
            .get("message")
            .or_else(|| body.get("detail"))
            .and_then(Value::as_str);
        return Err(err("http", Some(status.as_u16()), detail));
    }
    let text = body
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if text.is_empty() {
        return Err(err("empty", None, None));
    }
    Ok(text.to_string())
}

pub async fn cleanup_transcript(text: String, system_prompt: String) -> Result<String, String> {
    let Ok(key) = api_key() else {
        return Ok(text);
    };
    let response = match http()?
        .post(LLM_GATEWAY_URL)
        .header("Authorization", key)
        .header("content-type", "application/json")
        .json(&json!({
            "model": LLM_MODEL,
            "temperature": 0,
            "max_tokens": 2048,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": text }
            ]
        }))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return Ok(text),
    };
    if !response.status().is_success() {
        return Ok(text);
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    Ok(extract_cleanup_text(&body, &text))
}

pub async fn warm_sync() -> bool {
    let Ok(client) = http() else {
        return false;
    };
    match client
        .get(SYNC_WARM_URL)
        .header("X-AAI-Model", SYNC_MODEL)
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

fn extract_cleanup_text(payload: &Value, fallback: &str) -> String {
    payload
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|content| !content.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_reads_choice_content() {
        let payload = json!({
            "choices": [{ "message": { "content": "  Привет.  " } }]
        });
        assert_eq!(extract_cleanup_text(&payload, "raw"), "Привет.");
        assert_eq!(extract_cleanup_text(&json!({}), "raw"), "raw");
    }

    #[test]
    fn error_json_has_kind() {
        let raw = err("http", Some(504), Some("Gateway Timeout"));
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["kind"], "http");
        assert_eq!(value["status"], 504);
    }
}
