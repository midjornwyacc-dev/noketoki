import { Menu, Tray, nativeImage, app, type NativeImage } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { APP_NAME } from '../shared/constants'
import { formatHotkey } from '../shared/hotkey'
import type { HistoryItem } from '../shared/history'

type TrayHandlers = {
  openSettings: () => void
  pasteLast: () => void
  pasteHistory: (text: string) => void
  quit: () => void
}

let tray: Tray | null = null

export function createTray(handlers: TrayHandlers): Tray {
  const icon = loadTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  updateTrayMenu([], defaultHotkeyLabel(), handlers)
  return tray
}

export function updateTrayMenu(
  history: HistoryItem[],
  hotkeyLabel: string,
  handlers: TrayHandlers
): void {
  if (!tray) return
  const recent =
    history.length === 0
      ? [{ label: 'Пока пусто', enabled: false }]
      : history.slice(0, 12).map((item) => ({
          label: ellipsize(item.text),
          click: () => handlers.pasteHistory(item.text)
        }))

  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { label: `Диктовка: ${hotkeyLabel}`, enabled: false },
    { type: 'separator' },
    { label: 'Настройки…', click: () => handlers.openSettings() },
    { label: 'Вставить последнее', click: () => handlers.pasteLast() },
    { label: 'Недавние', submenu: recent },
    { type: 'separator' },
    { label: 'Выход', click: () => handlers.quit() }
  ])
  tray.setContextMenu(menu)
}

function defaultHotkeyLabel(): string {
  return formatHotkey({ ctrl: true, alt: true, shift: false, meta: false })
}

function ellipsize(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 48 ? `${compact.slice(0, 47)}…` : compact
}

function loadTrayIcon(): NativeImage {
  const candidates = [
    join(process.resourcesPath, 'resources/trayTemplate.png'),
    join(process.resourcesPath, 'trayTemplate.png'),
    join(__dirname, '../../resources/trayTemplate.png'),
    join(app.getAppPath(), 'resources/trayTemplate.png')
  ]
  for (const file of candidates) {
    if (existsSync(file)) {
      const image = nativeImage.createFromBuffer(readFileSync(file))
      image.setTemplateImage(true)
      return image.resize({ width: 18, height: 18 })
    }
  }
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGElEQVRYR+3BMQEAAADCoPVPbQwfoAAAAAAA4N8BFgAB3q4mYAAAAABJRU5ErkJggg=='
  )
}
