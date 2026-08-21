import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function loadPage(win: BrowserWindow, page: 'pill' | 'settings'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${page}/index.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}/index.html`))
  }
}

export function createPillWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 78,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    hiddenInMissionControl: true,
    roundedCorners: true,
    acceptFirstMouse: true,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(false)
  loadPage(win, 'pill')
  return win
}

export function positionPill(win: BrowserWindow): void {
  const display = screen.getPrimaryDisplay()
  const { width } = win.getBounds()
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + 18)
  win.setPosition(x, y, false)
}

export function showPillInactive(win: BrowserWindow): void {
  positionPill(win)
  win.showInactive()
}

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 480,
    minHeight: 560,
    show: false,
    title: 'Noketoki',
    autoHideMenuBar: true,
    fullscreenable: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('ready-to-show', () => {
    win.webContents.setZoomFactor(1)
  })
  loadPage(win, 'settings')
  return win
}
