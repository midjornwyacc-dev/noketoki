use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub text: String,
    pub created_at: u64,
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("history.json"))
}

pub fn load(app: &AppHandle) -> Vec<HistoryItem> {
    let Ok(path) = history_path(app) else {
        return Vec::new();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn push(app: &AppHandle, text: String) -> Result<Vec<HistoryItem>, String> {
    if text.trim().is_empty() {
        return Ok(load(app));
    }
    let mut items = load(app);
    items.insert(
        0,
        HistoryItem {
            id: format!("{}-{:x}", now_ms(), now_ms().wrapping_mul(31)),
            text,
            created_at: now_ms(),
        },
    );
    items.truncate(50);
    let path = history_path(app)?;
    fs::write(path, serde_json::to_string_pretty(&items).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(items)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
