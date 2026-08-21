import { createRequire } from 'node:module'
import { defaultPasteLastHotkey, isHotkeyHeld, type Hotkey, type ModifierState } from '../shared/hotkey'

const require = createRequire(import.meta.url)

// TODO(hands-free): double-tap PTT to latch recording, then tap again or click
// stop on the pill to finish. Hold-to-talk ships first so the core paste loop
// stays simple.

type Handlers = {
  onPttDown: () => void
  onPttUp: () => void
  onEscape: () => void
  onPasteLast: () => void
}

type MacPoller = {
  keyDown: (code: number) => boolean
}

const MAC_KEYCODES: Record<string, number> = {
  KeyA: 0x00,
  KeyS: 0x01,
  KeyD: 0x02,
  KeyF: 0x03,
  KeyH: 0x04,
  KeyG: 0x05,
  KeyZ: 0x06,
  KeyX: 0x07,
  KeyC: 0x08,
  KeyV: 0x09,
  KeyB: 0x0b,
  KeyQ: 0x0c,
  KeyW: 0x0d,
  KeyE: 0x0e,
  KeyR: 0x0f,
  KeyY: 0x10,
  KeyT: 0x11,
  Digit1: 0x12,
  Digit2: 0x13,
  Digit3: 0x14,
  Digit4: 0x15,
  Digit6: 0x16,
  Digit5: 0x17,
  Equal: 0x18,
  Digit9: 0x19,
  Digit7: 0x1a,
  Minus: 0x1b,
  Digit8: 0x1c,
  Digit0: 0x1d,
  BracketRight: 0x1e,
  KeyO: 0x1f,
  KeyU: 0x20,
  BracketLeft: 0x21,
  KeyI: 0x22,
  KeyP: 0x23,
  Enter: 0x24,
  KeyL: 0x25,
  KeyJ: 0x26,
  Quote: 0x27,
  KeyK: 0x28,
  Semicolon: 0x29,
  Backslash: 0x2a,
  Comma: 0x2b,
  Slash: 0x2c,
  KeyN: 0x2d,
  KeyM: 0x2e,
  Period: 0x2f,
  Tab: 0x30,
  Space: 0x31,
  Backquote: 0x32,
  Backspace: 0x33,
  Escape: 0x35,
  MetaLeft: 0x37,
  ShiftLeft: 0x38,
  CapsLock: 0x39,
  AltLeft: 0x3a,
  ControlLeft: 0x3b,
  ShiftRight: 0x3c,
  AltRight: 0x3d,
  ControlRight: 0x3e,
  MetaRight: 0x36,
  ArrowLeft: 0x7b,
  ArrowRight: 0x7c,
  ArrowDown: 0x7d,
  ArrowUp: 0x7e,
  F1: 0x7a,
  F2: 0x78,
  F3: 0x63,
  F4: 0x76,
  F5: 0x60,
  F6: 0x61,
  F7: 0x62,
  F8: 0x64,
  F9: 0x65,
  F10: 0x6d,
  F11: 0x67,
  F12: 0x6f
}

const LEFT_CONTROL = 0x3b
const RIGHT_CONTROL = 0x3e
const LEFT_OPTION = 0x3a
const RIGHT_OPTION = 0x3d
const LEFT_SHIFT = 0x38
const RIGHT_SHIFT = 0x3c
const LEFT_COMMAND = 0x37
const RIGHT_COMMAND = 0x36
const ESCAPE = 0x35

export class HotkeyMonitor {
  private timer: NodeJS.Timeout | null = null
  private poller: MacPoller | null = null
  private pttHeld = false
  private pasteHeld = false
  private escHeld = false
  private hotkey: Hotkey
  private pasteLast: Hotkey
  private readonly handlers: Handlers

  constructor(hotkey: Hotkey, pasteLast: Hotkey, handlers: Handlers) {
    this.hotkey = hotkey
    this.pasteLast = pasteLast
    this.handlers = handlers
  }

  start(): void {
    this.stop()
    this.poller = loadMacPoller()
    if (!this.poller) {
      console.warn(
        'Noketoki: не удалось открыть HID-состояние клавиш. Удерживание Control+Option работает только на macOS.'
      )
      return
    }
    this.timer = setInterval(() => this.tick(), 16)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.pttHeld = false
    this.pasteHeld = false
    this.escHeld = false
  }

  setHotkey(hotkey: Hotkey): void {
    this.hotkey = hotkey
  }

  setPasteLastHotkey(hotkey: Hotkey): void {
    this.pasteLast = hotkey
  }

  private tick(): void {
    if (!this.poller) return
    const pttState = this.read(this.hotkey)
    const held = isHotkeyHeld(this.hotkey, pttState)
    if (held && !this.pttHeld) this.handlers.onPttDown()
    if (!held && this.pttHeld) this.handlers.onPttUp()
    this.pttHeld = held

    const esc = this.poller.keyDown(ESCAPE)
    if (esc && !this.escHeld) this.handlers.onEscape()
    this.escHeld = esc

    const pasteState = this.read(this.pasteLast.code ? this.pasteLast : defaultPasteLastHotkey())
    const pasteHeld = isHotkeyHeld(this.pasteLast, pasteState)
    if (pasteHeld && !this.pasteHeld) this.handlers.onPasteLast()
    this.pasteHeld = pasteHeld
  }

  private read(hotkey: Hotkey): ModifierState {
    const keyDown = this.poller!.keyDown
    const state: ModifierState = {
      ctrl: keyDown(LEFT_CONTROL) || keyDown(RIGHT_CONTROL),
      alt: keyDown(LEFT_OPTION) || keyDown(RIGHT_OPTION),
      shift: keyDown(LEFT_SHIFT) || keyDown(RIGHT_SHIFT),
      meta: keyDown(LEFT_COMMAND) || keyDown(RIGHT_COMMAND)
    }
    if (hotkey.code) {
      const code = MAC_KEYCODES[hotkey.code]
      if (code !== undefined && keyDown(code)) state.code = hotkey.code
    }
    return state
  }
}

function loadMacPoller(): MacPoller | null {
  if (process.platform !== 'darwin') return null
  try {
    // koffi is resolved at runtime on macOS only.
    const koffi = require('koffi') as {
      load: (path: string) => {
        func: (name: string, ret: string, args: string[]) => (...args: unknown[]) => boolean
      }
    }
    const lib = koffi.load(
      '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
    )
    const CGEventSourceKeyState = lib.func('CGEventSourceKeyState', 'bool', ['int', 'ushort'])
    const HID_STATE = 1
    return {
      keyDown: (code: number) => Boolean(CGEventSourceKeyState(HID_STATE, code))
    }
  } catch (error) {
    console.warn('Noketoki: koffi/HID poller unavailable', error instanceof Error ? error.message : '')
    return null
  }
}

export function describeUnsupportedFn(): string {
  return 'Electron не умеет надёжно перехватывать Fn. Выберите Control+Option или другую комбинацию.'
}
