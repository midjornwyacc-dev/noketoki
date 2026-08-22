use crate::history::{self, HistoryItem};
use crate::secrets;
use crate::settings::{self, AppSettings};
use crate::state::AppState;
use tauri::{AppHandle, State};
#[cfg(not(target_os = "macos"))]
use tauri::Manager;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSettings {
    #[serde(flatten)]
    pub settings: AppSettings,
    pub has_api_key: bool,
}

#[derive(serde::Serialize)]
pub struct PermissionStatus {
    pub microphone: bool,
    pub accessibility: bool,
}

#[tauri::command]
pub fn platform() -> &'static str {
    #[cfg(target_os = "ios")]
    {
        "ios"
    }
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(not(any(target_os = "ios", target_os = "macos")))]
    {
        "other"
    }
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<PublicSettings, String> {
    Ok(PublicSettings {
        settings: settings::load(&app),
        has_api_key: !secrets::load()?.is_empty(),
    })
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<AppState>,
    settings: AppSettings,
) -> Result<PublicSettings, String> {
    settings::save(&app, &settings)?;
    if let Ok(guard) = state.ptt.lock() {
        if let Some(ptt) = guard.as_ref() {
            if let Ok(mut current) = ptt.lock() {
                *current = settings.hotkey.clone();
            }
        }
    }
    if let Ok(guard) = state.paste_last.lock() {
        if let Some(paste) = guard.as_ref() {
            if let Ok(mut current) = paste.lock() {
                *current = settings.paste_last_hotkey.clone();
            }
        }
    }
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        let _ = if settings.launch_at_login {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        };
    }
    Ok(PublicSettings {
        settings,
        has_api_key: !secrets::load()?.is_empty(),
    })
}

#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    Ok(!secrets::load()?.is_empty())
}

#[tauri::command]
pub fn set_api_key(api_key: String) -> Result<bool, String> {
    secrets::save(&api_key)?;
    Ok(!api_key.trim().is_empty())
}

#[tauri::command]
pub fn get_api_key() -> Result<String, String> {
    secrets::load()
}

#[tauri::command]
pub fn clear_api_key() -> Result<bool, String> {
    secrets::clear()?;
    Ok(false)
}

#[tauri::command]
pub fn get_history(app: AppHandle) -> Vec<HistoryItem> {
    history::load(&app)
}

#[tauri::command]
pub fn record_history(app: AppHandle, text: String) -> Result<Vec<HistoryItem>, String> {
    history::push(&app, text)
}

#[tauri::command]
pub fn set_last_text(state: State<AppState>, text: String) {
    if let Ok(mut last) = state.last_text.lock() {
        *last = if text.is_empty() { None } else { Some(text) };
    }
}

#[tauri::command]
pub fn get_last_text(state: State<AppState>) -> Option<String> {
    state.last_text.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn paste_text(text: String, state: State<AppState>) -> Result<(), String> {
    if let Ok(mut last) = state.last_text.lock() {
        *last = Some(text.clone());
    }
    #[cfg(target_os = "macos")]
    {
        return crate::macos::paste_text(&text);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("Вставка в другое приложение есть только на macOS.".into())
    }
}

#[tauri::command]
pub fn paste_last(state: State<AppState>) -> Result<(), String> {
    let text = state
        .last_text
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .ok_or_else(|| "Нет сохранённого текста.".to_string())?;
    paste_text(text, state)
}

#[tauri::command]
pub fn show_settings(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return crate::macos::show_settings(&app);
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
        }
        Ok(())
    }
}

#[tauri::command]
pub fn show_pill(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::macos::show_pill(&app)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
pub fn hide_pill(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::macos::hide_pill(&app)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
pub fn get_permissions() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        PermissionStatus {
            microphone: true,
            accessibility: crate::macos::is_trusted(),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        PermissionStatus {
            microphone: true,
            accessibility: true,
        }
    }
}

#[tauri::command]
pub async fn transcribe_sync(
    wav_base64: String,
    config: serde_json::Value,
) -> Result<String, String> {
    crate::assemblyai::transcribe_sync(wav_base64, config).await
}

#[tauri::command]
pub async fn cleanup_transcript(text: String, system_prompt: String) -> Result<String, String> {
    crate::assemblyai::cleanup_transcript(text, system_prompt).await
}

#[tauri::command]
pub async fn warm_sync() -> bool {
    crate::assemblyai::warm_sync().await
}

#[tauri::command]
pub fn open_privacy(kind: String) {
    #[cfg(target_os = "macos")]
    {
        if kind == "accessibility" {
            crate::macos::prompt_accessibility();
        }
        crate::macos::open_privacy(&kind);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = kind;
    }
}
