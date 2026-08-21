use crate::settings::Hotkey;
#[cfg(target_os = "macos")]
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct AppState {
    pub last_text: Mutex<Option<String>>,
    pub ptt: Mutex<Option<Arc<Mutex<Hotkey>>>>,
    pub paste_last: Mutex<Option<Arc<Mutex<Hotkey>>>>,
    #[cfg(target_os = "macos")]
    pub stop_hotkeys: Mutex<Option<Arc<AtomicBool>>>,
}
