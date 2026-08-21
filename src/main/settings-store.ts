import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defaultHotkey, defaultPasteLastHotkey, type Hotkey } from '../shared/hotkey'
import type { AppSettings } from '../shared/types'

export function defaultSettings(): AppSettings {
  return {
    hotkey: defaultHotkey(),
    pasteLastHotkey: defaultPasteLastHotkey(),
    language: 'ru',
    smartCleanup: true,
    dictionary: [],
    sounds: true,
    launchAtLogin: false
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const fallback = defaultSettings()
  if (!existsSync(settingsPath())) return fallback
  try {
    const parsed = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<AppSettings>
    return {
      ...fallback,
      ...parsed,
      hotkey: normalizeHotkey(parsed.hotkey, fallback.hotkey),
      pasteLastHotkey: normalizeHotkey(parsed.pasteLastHotkey, fallback.pasteLastHotkey),
      dictionary: Array.isArray(parsed.dictionary)
        ? parsed.dictionary.filter((item) => typeof item === 'string')
        : [],
      language: typeof parsed.language === 'string' ? parsed.language : fallback.language,
      smartCleanup: parsed.smartCleanup !== false,
      sounds: parsed.sounds !== false,
      launchAtLogin: Boolean(parsed.launchAtLogin)
    }
  } catch {
    return fallback
  }
}

export function saveSettings(settings: AppSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const payload: AppSettings = {
    ...settings,
    dictionary: settings.dictionary.map((item) => item.trim()).filter(Boolean)
  }
  writeFileSync(settingsPath(), JSON.stringify(payload, null, 2))
  applyLaunchAtLogin(payload.launchAtLogin)
}

export function applyLaunchAtLogin(enabled: boolean): void {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  } catch {
    // Launch-at-login is optional; ignore when the OS refuses it.
  }
}

function normalizeHotkey(value: unknown, fallback: Hotkey): Hotkey {
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Partial<Hotkey>
  return {
    ctrl: Boolean(raw.ctrl),
    alt: Boolean(raw.alt),
    shift: Boolean(raw.shift),
    meta: Boolean(raw.meta),
    code: typeof raw.code === 'string' ? raw.code : undefined
  }
}
