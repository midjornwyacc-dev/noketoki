import { invoke } from '@tauri-apps/api/core'
import type { HistoryItem } from '../shared/history'
import type { AppSettings, PermissionStatus, PublicSettings } from '../shared/types'

export function platform(): Promise<string> {
  return invoke('platform')
}

export function getSettings(): Promise<PublicSettings> {
  return invoke('get_settings')
}

export function saveSettings(settings: AppSettings): Promise<PublicSettings> {
  return invoke('save_settings', { settings })
}

export function setApiKey(apiKey: string): Promise<boolean> {
  return invoke('set_api_key', { apiKey })
}

export function getApiKey(): Promise<string> {
  return invoke('get_api_key')
}

export function clearApiKey(): Promise<boolean> {
  return invoke('clear_api_key')
}

export function getHistory(): Promise<HistoryItem[]> {
  return invoke('get_history')
}

export function recordHistory(text: string): Promise<HistoryItem[]> {
  return invoke('record_history', { text })
}

export function setLastText(text: string): Promise<void> {
  return invoke('set_last_text', { text })
}

export function pasteText(text: string): Promise<void> {
  return invoke('paste_text', { text })
}

export function pasteLast(): Promise<void> {
  return invoke('paste_last')
}

export function showSettingsWindow(): Promise<void> {
  return invoke('show_settings')
}

export function showPill(): Promise<void> {
  return invoke('show_pill')
}

export function hidePill(): Promise<void> {
  return invoke('hide_pill')
}

export function getPermissions(): Promise<PermissionStatus> {
  return invoke('get_permissions')
}

export function openPrivacy(kind: 'microphone' | 'accessibility'): Promise<void> {
  return invoke('open_privacy', { kind })
}
