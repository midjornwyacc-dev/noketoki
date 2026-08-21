export type Hotkey = {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  code?: string
}

export type ModifierState = {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  code?: string
}

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight'
])

export function defaultHotkey(): Hotkey {
  return { ctrl: true, alt: true, shift: false, meta: false }
}

export function defaultPasteLastHotkey(): Hotkey {
  return { ctrl: true, alt: false, shift: true, meta: false, code: 'KeyV' }
}

export function parseHotkey(value: string): Hotkey {
  const parts = value.split('+').map((p) => p.trim()).filter(Boolean)
  const hotkey: Hotkey = { ctrl: false, alt: false, shift: false, meta: false }
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'control' || lower === 'ctrl') hotkey.ctrl = true
    else if (lower === 'alt' || lower === 'option') hotkey.alt = true
    else if (lower === 'shift') hotkey.shift = true
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') {
      hotkey.meta = true
    } else {
      hotkey.code = part
    }
  }
  return hotkey
}

export function formatHotkey(hotkey: Hotkey): string {
  const parts: string[] = []
  if (hotkey.ctrl) parts.push('Control')
  if (hotkey.alt) parts.push('Option')
  if (hotkey.shift) parts.push('Shift')
  if (hotkey.meta) parts.push('Command')
  if (hotkey.code) parts.push(humanCode(hotkey.code))
  return parts.join(' + ') || 'не задано'
}

export function hotkeyFromBrowserEvent(event: {
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  code: string
}): Hotkey {
  const hotkey: Hotkey = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  }
  if (!MODIFIER_CODES.has(event.code)) hotkey.code = event.code
  return hotkey
}

export function isHotkeyHeld(hotkey: Hotkey, pressed: ModifierState): boolean {
  if (Boolean(hotkey.ctrl) !== Boolean(pressed.ctrl)) return false
  if (Boolean(hotkey.alt) !== Boolean(pressed.alt)) return false
  if (Boolean(hotkey.shift) !== Boolean(pressed.shift)) return false
  if (Boolean(hotkey.meta) !== Boolean(pressed.meta)) return false
  if (hotkey.code) return pressed.code === hotkey.code
  return true
}

export function isEscape(code?: string): boolean {
  return code === 'Escape'
}

function humanCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'Space') return 'Space'
  return code
}
