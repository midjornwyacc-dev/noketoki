import { app, ipcMain, Menu, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC } from '../shared/constants'
import { formatHotkey } from '../shared/hotkey'
import { DictationController } from './dictation-controller'
import { HotkeyMonitor } from './hotkeys'
import { loadHistory } from './history-store'
import { getPermissionStatus, openPermissionSettings, promptAccessibility, requestMicrophone } from './permissions'
import { clearApiKey, hasApiKey, saveApiKey } from './secrets'
import { applyLaunchAtLogin, loadSettings, saveSettings } from './settings-store'
import { prepareSounds } from './sounds'
import { createTray, updateTrayMenu } from './tray'
import { createPillWindow, createSettingsWindow } from './windows'

let quitting = false

app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.noketoki.desktop')
  if (process.platform === 'darwin') app.dock?.hide()

  Menu.setApplicationMenu(null)
  prepareSounds()
  applyLaunchAtLogin(loadSettings().launchAtLogin)

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media'
  })

  const pill = createPillWindow()
  const settings = createSettingsWindow()
  const dictation = new DictationController(pill)

  const refreshTray = (): void => {
    updateTrayMenu(loadHistory(), formatHotkey(loadSettings().hotkey), {
      openSettings: () => showSettings(),
      pasteLast: () => void dictation.pasteLast(),
      pasteHistory: (text) => void dictation.pasteText(text),
      quit: () => {
        quitting = true
        app.quit()
      }
    })
  }

  const tray = createTray({
    openSettings: () => showSettings(),
    pasteLast: () => void dictation.pasteLast(),
    pasteHistory: (text) => void dictation.pasteText(text),
    quit: () => {
      quitting = true
      app.quit()
    }
  })
  void tray
  dictation.setHistoryListener(refreshTray)
  refreshTray()

  const monitor = new HotkeyMonitor(loadSettings().hotkey, loadSettings().pasteLastHotkey, {
    onPttDown: () => void dictation.beginHold(),
    onPttUp: () => void dictation.finishHold('ptt-up'),
    onEscape: () => dictation.cancel(),
    onPasteLast: () => void dictation.pasteLast()
  })
  if (pill.webContents.isLoading()) {
    await Promise.race([
      new Promise<void>((resolve) => pill.webContents.once('did-finish-load', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 8000))
    ])
  }

  monitor.start()

  function showSettings(): void {
    if (process.platform === 'darwin') app.dock?.show()
    if (settings.isMinimized()) settings.restore()
    settings.show()
    settings.focus()
  }

  settings.on('hide', () => {
    if (process.platform === 'darwin') app.dock?.hide()
  })

  ipcMain.handle(IPC.getSettings, () => ({
    ...loadSettings(),
    hasApiKey: hasApiKey()
  }))
  ipcMain.handle(IPC.saveSettings, (_event, patch: Record<string, unknown>) => {
    const current = loadSettings()
    const next = {
      ...current,
      ...patch,
      dictionary: Array.isArray(patch.dictionary)
        ? (patch.dictionary as unknown[]).filter((item): item is string => typeof item === 'string')
        : current.dictionary
    }
    saveSettings(next)
    monitor.setHotkey(next.hotkey)
    monitor.setPasteLastHotkey(next.pasteLastHotkey)
    refreshTray()
    return { ...next, hasApiKey: hasApiKey() }
  })
  ipcMain.handle(IPC.setApiKey, (_event, apiKey: string) => {
    saveApiKey(String(apiKey ?? ''))
    return { hasApiKey: hasApiKey() }
  })
  ipcMain.handle(IPC.clearApiKey, () => {
    clearApiKey()
    return { hasApiKey: false }
  })
  ipcMain.handle(IPC.getHistory, () => loadHistory())
  ipcMain.handle(IPC.getPermissions, () => getPermissionStatus())
  ipcMain.handle(IPC.requestMic, () => requestMicrophone())
  ipcMain.handle(IPC.openPrivacy, (_event, kind: 'microphone' | 'accessibility') => {
    if (kind === 'accessibility') promptAccessibility()
    openPermissionSettings(kind)
  })
  ipcMain.handle(IPC.pasteLast, () => dictation.pasteLast())

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const perms = await getPermissionStatus()
  if (!hasApiKey() || !perms.microphone || !perms.accessibility) showSettings()

  app.on('before-quit', () => {
    quitting = true
    monitor.stop()
    if (!settings.isDestroyed()) settings.removeAllListeners('close')
  })

  settings.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      settings.hide()
    }
  })
})

app.on('window-all-closed', () => {
  // Stay in the menu bar until the user quits from the tray.
})
