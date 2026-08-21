#![cfg(target_os = "macos")]

use crate::settings::Hotkey;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const LEFT_CONTROL: u16 = 0x3b;
const RIGHT_CONTROL: u16 = 0x3e;
const LEFT_OPTION: u16 = 0x3a;
const RIGHT_OPTION: u16 = 0x3d;
const LEFT_SHIFT: u16 = 0x38;
const RIGHT_SHIFT: u16 = 0x3c;
const LEFT_COMMAND: u16 = 0x37;
const RIGHT_COMMAND: u16 = 0x36;
const ESCAPE: u16 = 0x35;
const HID_STATE: u32 = 1;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn CGEventSourceKeyState(state_id: u32, key: u16) -> bool;
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
}

fn key_down(code: u16) -> bool {
    unsafe { CGEventSourceKeyState(HID_STATE, code) }
}

fn mac_code(code: &str) -> Option<u16> {
    Some(match code {
        "KeyA" => 0x00,
        "KeyS" => 0x01,
        "KeyD" => 0x02,
        "KeyF" => 0x03,
        "KeyH" => 0x04,
        "KeyG" => 0x05,
        "KeyZ" => 0x06,
        "KeyX" => 0x07,
        "KeyC" => 0x08,
        "KeyV" => 0x09,
        "KeyB" => 0x0b,
        "KeyQ" => 0x0c,
        "KeyW" => 0x0d,
        "KeyE" => 0x0e,
        "KeyR" => 0x0f,
        "KeyY" => 0x10,
        "KeyT" => 0x11,
        "Digit1" => 0x12,
        "Digit2" => 0x13,
        "Digit3" => 0x14,
        "Digit4" => 0x15,
        "Digit6" => 0x16,
        "Digit5" => 0x17,
        "Equal" => 0x18,
        "Digit9" => 0x19,
        "Digit7" => 0x1a,
        "Minus" => 0x1b,
        "Digit8" => 0x1c,
        "Digit0" => 0x1d,
        "KeyO" => 0x1f,
        "KeyU" => 0x20,
        "KeyI" => 0x22,
        "KeyP" => 0x23,
        "KeyL" => 0x25,
        "KeyJ" => 0x26,
        "KeyK" => 0x28,
        "KeyN" => 0x2d,
        "KeyM" => 0x2e,
        "Space" => 0x31,
        "Escape" => 0x35,
        _ => return None,
    })
}

fn matches(hotkey: &Hotkey) -> bool {
    let ctrl = key_down(LEFT_CONTROL) || key_down(RIGHT_CONTROL);
    let alt = key_down(LEFT_OPTION) || key_down(RIGHT_OPTION);
    let shift = key_down(LEFT_SHIFT) || key_down(RIGHT_SHIFT);
    let meta = key_down(LEFT_COMMAND) || key_down(RIGHT_COMMAND);
    if hotkey.ctrl != ctrl || hotkey.alt != alt || hotkey.shift != shift || hotkey.meta != meta {
        return false;
    }
    if let Some(code) = &hotkey.code {
        return mac_code(code).is_some_and(key_down);
    }
    true
}

// TODO(hands-free): double-tap PTT to latch recording. Hold-to-talk ships first.

pub fn start_hotkey_thread(
    app: AppHandle,
    ptt: Arc<Mutex<Hotkey>>,
    paste_last: Arc<Mutex<Hotkey>>,
    stop: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let mut ptt_held = false;
        let mut paste_held = false;
        let mut esc_held = false;
        while !stop.load(Ordering::Relaxed) {
            let ptt_now = ptt.lock().ok().is_some_and(|h| matches(&h));
            if ptt_now && !ptt_held {
                let _ = app.emit("ptt-down", ());
            }
            if !ptt_now && ptt_held {
                let _ = app.emit("ptt-up", ());
            }
            ptt_held = ptt_now;

            let esc = key_down(ESCAPE);
            if esc && !esc_held {
                let _ = app.emit("escape", ());
            }
            esc_held = esc;

            let paste_now = paste_last.lock().ok().is_some_and(|h| matches(&h));
            if paste_now && !paste_held {
                let _ = app.emit("paste-last", ());
            }
            paste_held = paste_now;

            thread::sleep(Duration::from_millis(16));
        }
    });
}

pub fn paste_text(text: &str) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let previous = clipboard.get_text().unwrap_or_default();
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    thread::sleep(Duration::from_millis(50));
    let status = Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to keystroke \"v\" using command down",
        ])
        .status()
        .map_err(|e| e.to_string())?;
    thread::sleep(Duration::from_millis(220));
    let _ = clipboard.set_text(previous);
    if status.success() {
        Ok(())
    } else {
        Err("Не удалось нажать Cmd+V. Проверьте Универсальный доступ.".into())
    }
}

pub fn is_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

pub fn prompt_accessibility() {
    unsafe {
        AXIsProcessTrustedWithOptions(std::ptr::null());
    }
}

pub fn open_privacy(kind: &str) {
    let url = match kind {
        "microphone" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
        _ => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    };
    let _ = Command::new("open").arg(url).status();
}

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    use tauri::image::Image;
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;

    let settings = MenuItemBuilder::with_id("settings", "Настройки…")
        .build(app)
        .map_err(|e| e.to_string())?;
    let paste = MenuItemBuilder::with_id("paste-last", "Вставить последнее")
        .build(app)
        .map_err(|e| e.to_string())?;
    let quit = MenuItemBuilder::with_id("quit", "Выход")
        .build(app)
        .map_err(|e| e.to_string())?;
    let menu = MenuBuilder::new(app)
        .item(&settings)
        .item(&paste)
        .separator()
        .item(&quit)
        .build()
        .map_err(|e| e.to_string())?;

    let icon_bytes = include_bytes!("../icons/trayTemplate.png");
    let icon = Image::from_bytes(icon_bytes).map_err(|e| e.to_string())?;

    TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Noketoki")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "settings" => {
                let _ = show_settings(app);
            }
            "paste-last" => {
                let _ = app.emit("paste-last", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn show_settings(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

pub fn show_pill(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("pill") {
        let _ = win.show();
    }
    Ok(())
}

pub fn hide_pill(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("pill") {
        let _ = win.hide();
    }
    Ok(())
}
