mod assemblyai;
mod commands;
mod history;
mod secrets;
mod settings;
mod state;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
use std::sync::atomic::AtomicBool;
#[cfg(target_os = "macos")]
use std::sync::{Arc, Mutex};
#[cfg(target_os = "macos")]
use tauri::Manager;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::platform,
            commands::get_settings,
            commands::save_settings,
            commands::has_api_key,
            commands::set_api_key,
            commands::get_api_key,
            commands::clear_api_key,
            commands::get_history,
            commands::record_history,
            commands::set_last_text,
            commands::get_last_text,
            commands::paste_text,
            commands::paste_last,
            commands::show_settings,
            commands::show_pill,
            commands::hide_pill,
            commands::get_permissions,
            commands::open_privacy,
            commands::transcribe_sync,
            commands::cleanup_transcript,
            commands::warm_sync
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                create_macos_windows(app.handle())?;
                crate::macos::setup_tray(app.handle())?;
                start_macos_hotkeys(app.handle());
            }
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Noketoki")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            match &event {
                tauri::RunEvent::ExitRequested { api, code, .. } => {
                    // Keep the menu-bar process alive when windows close.
                    // Honor an explicit quit (tray → Выход → app.exit).
                    if code.is_none() {
                        api.prevent_exit();
                    }
                }
                tauri::RunEvent::Exit => {
                    let stop = app
                        .state::<AppState>()
                        .stop_hotkeys
                        .lock()
                        .ok()
                        .and_then(|guard| guard.clone());
                    if let Some(stop) = stop {
                        stop.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
                _ => {}
            }
            let _ = (app, event);
        });
}

#[cfg(target_os = "macos")]
fn create_macos_windows(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let settings = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html?view=settings".into()))
        .title("Noketoki")
        .inner_size(560.0, 760.0)
        .min_inner_size(480.0, 560.0)
        .visible(false)
        .build()?;

    let settings_ref = settings.clone();
    settings.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = settings_ref.hide();
        }
    });

    let _pill = WebviewWindowBuilder::new(app, "pill", WebviewUrl::App("index.html?view=pill".into()))
        .title("Noketoki")
        .inner_size(340.0, 78.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .shadow(false)
        .build()?;

    if secrets::load().ok().unwrap_or_default().is_empty() {
        let _ = settings.show();
        let _ = settings.set_focus();
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn start_macos_hotkeys(app: &tauri::AppHandle) {
    let loaded = crate::settings::load(app);
    let ptt = Arc::new(Mutex::new(loaded.hotkey.clone()));
    let paste = Arc::new(Mutex::new(loaded.paste_last_hotkey.clone()));
    let stop = Arc::new(AtomicBool::new(false));
    let state = app.state::<AppState>();
    if let Ok(mut slot) = state.ptt.lock() {
        *slot = Some(ptt.clone());
    }
    if let Ok(mut slot) = state.paste_last.lock() {
        *slot = Some(paste.clone());
    }
    if let Ok(mut slot) = state.stop_hotkeys.lock() {
        *slot = Some(stop.clone());
    }
    crate::macos::start_hotkey_thread(app.clone(), ptt, paste, stop);
}
