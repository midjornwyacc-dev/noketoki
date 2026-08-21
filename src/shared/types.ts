import type { Hotkey } from './hotkey'

export type AppSettings = {
  hotkey: Hotkey
  pasteLastHotkey: Hotkey
  language: string
  smartCleanup: boolean
  dictionary: string[]
  sounds: boolean
  launchAtLogin: boolean
}

export type PublicSettings = AppSettings & {
  hasApiKey: boolean
}

export type PermissionStatus = {
  microphone: boolean
  accessibility: boolean
}

export type PillPhase = 'hidden' | 'recording' | 'transcribing' | 'error'

export type PillState = {
  phase: PillPhase
  error?: string | null
  durationMs?: number
}

export type ClipPayload = {
  pcm: ArrayBuffer
  sampleRate: number
}
