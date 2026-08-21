#[cfg(any(target_os = "macos", target_os = "ios"))]
const SERVICE: &str = "app.noketoki";
#[cfg(any(target_os = "macos", target_os = "ios"))]
const ACCOUNT: &str = "assemblyai-api-key";

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn save(api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    if api_key.trim().is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry.set_password(api_key.trim()).map_err(|e| e.to_string())
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn load() -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(value),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn clear() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn save(_api_key: &str) -> Result<(), String> {
    Err("Ключ хранится в Keychain только на macOS и iOS.".into())
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn load() -> Result<String, String> {
    Ok(String::new())
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn clear() -> Result<(), String> {
    Ok(())
}
