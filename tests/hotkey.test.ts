import { describe, expect, it } from 'vitest'
import {
  defaultHotkey,
  formatHotkey,
  hotkeyFromBrowserEvent,
  isHotkeyHeld,
  parseHotkey
} from '../src/shared/hotkey'

describe('hotkey', () => {
  it('defaults to Control+Option without a non-modifier key', () => {
    const hotkey = defaultHotkey()
    expect(hotkey.ctrl).toBe(true)
    expect(hotkey.alt).toBe(true)
    expect(hotkey.shift).toBe(false)
    expect(hotkey.meta).toBe(false)
    expect(hotkey.code).toBeUndefined()
    expect(formatHotkey(hotkey)).toBe('Control + Option')
  })

  it('matches when required modifiers are held, including extra modifiers', () => {
    const hotkey = parseHotkey('Control+Alt')
    expect(isHotkeyHeld(hotkey, { ctrl: true, alt: true, shift: false, meta: false })).toBe(true)
    expect(isHotkeyHeld(hotkey, { ctrl: true, alt: true, shift: true, meta: false })).toBe(false)
    expect(isHotkeyHeld(hotkey, { ctrl: true, alt: false, shift: false, meta: false })).toBe(false)
  })

  it('requires the recorded non-modifier key when one is set', () => {
    const hotkey = parseHotkey('Control+Shift+KeyV')
    expect(
      isHotkeyHeld(hotkey, { ctrl: true, alt: false, shift: true, meta: false, code: 'KeyV' })
    ).toBe(true)
    expect(
      isHotkeyHeld(hotkey, { ctrl: true, alt: false, shift: true, meta: false, code: 'KeyC' })
    ).toBe(false)
  })

  it('records modifier-only combos from browser events', () => {
    const event = {
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      code: 'AltLeft'
    }
    const hotkey = hotkeyFromBrowserEvent(event)
    expect(hotkey.code).toBeUndefined()
    expect(hotkey.alt).toBe(true)
    expect(hotkey.ctrl).toBe(true)
  })
})
