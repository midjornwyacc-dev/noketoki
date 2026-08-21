import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC, MAX_CLIP_MS, MIN_CLIP_MS, SAMPLE_RATE } from '../shared/constants'
import { initialDictationState, reduceDictation, type DictationState } from '../shared/dictation-machine'
import { encodeWav } from '../shared/wav'
import { buildSyncConfig } from '../shared/sync-config'
import type { ClipPayload, PillState } from '../shared/types'
import { cleanupTranscript, transcribeSync, warmSyncConnection } from './assemblyai'
import { recordHistory } from './history-store'
import { getFrontApp, type FrontApp } from './macos'
import { pasteViaClipboard } from './paste'
import { loadApiKey } from './secrets'
import { loadSettings } from './settings-store'
import { playCue } from './sounds'
import { showPillInactive } from './windows'

type ClipWaiter = {
  resolve: (clip: ClipPayload | null) => void
}

export class DictationController {
  private state: DictationState = initialDictationState()
  private session = 0
  private maxTimer: NodeJS.Timeout | null = null
  private clipWaiter: ClipWaiter | null = null
  private frontApp: FrontApp | null = null
  private lastText: string | null = null
  private onHistory?: () => void

  constructor(private readonly pill: BrowserWindow) {
    ipcMain.on(IPC.clipReady, (_event, payload: ClipPayload) => {
      this.clipWaiter?.resolve(payload)
      this.clipWaiter = null
    })
    ipcMain.on(IPC.captureError, (_event, message: string) => {
      this.failCapture(String(message || 'Не удалось включить микрофон.'))
    })
    ipcMain.on(IPC.pillCancel, () => this.cancel())
  }

  setHistoryListener(listener: () => void): void {
    this.onHistory = listener
  }

  getLastText(): string | null {
    return this.lastText
  }

  async beginHold(): Promise<void> {
    const next = reduceDictation(this.state, { type: 'ptt-down' })
    if (next === this.state) return
    if (!loadApiKey()) {
      this.setState({
        ...this.state,
        error: 'Добавьте ключ AssemblyAI в Настройках.'
      })
      this.pushPill({ phase: 'error', error: this.state.error })
      setTimeout(() => this.pushPill({ phase: 'hidden' }), 2400)
      return
    }
    this.state = next
    this.session += 1
    const session = this.session
    this.frontApp = await getFrontApp()
    void warmSyncConnection()
    if (loadSettings().sounds) playCue('start')
    showPillInactive(this.pill)
    this.pushPill({ phase: 'recording', durationMs: 0 })
    this.pill.webContents.send(IPC.startCapture, { sampleRate: SAMPLE_RATE })
    this.maxTimer = setTimeout(() => {
      if (this.session === session) void this.finishHold('max-duration')
    }, MAX_CLIP_MS)
  }

  async finishHold(reason: 'ptt-up' | 'max-duration' = 'ptt-up'): Promise<void> {
    if (this.state.phase !== 'recording') return
    const session = this.session
    if (this.maxTimer) clearTimeout(this.maxTimer)
    this.maxTimer = null
    this.state = reduceDictation(this.state, { type: reason === 'max-duration' ? 'max-duration' : 'ptt-up' })
    if (loadSettings().sounds) playCue('stop')
    this.pushPill({ phase: 'transcribing' })

    const clip = await this.collectClip()
    if (this.session !== session) return
    if (!clip) {
      this.state = reduceDictation(this.state, { type: 'esc' })
      this.pushPill({ phase: 'hidden' })
      return
    }

    const pcm = new Int16Array(clip.pcm)
    const durationMs = Math.round((pcm.length / (clip.sampleRate || SAMPLE_RATE)) * 1000)
    if (durationMs < MIN_CLIP_MS) {
      this.state = reduceDictation(this.state, { type: 'clip-too-short' })
      this.pushPill({ phase: 'error', error: this.state.error })
      setTimeout(() => {
        if (this.state.phase === 'idle') this.pushPill({ phase: 'hidden' })
      }, 1800)
      return
    }

    await this.transcribeAndPaste(pcm, clip.sampleRate || SAMPLE_RATE, session)
  }

  cancel(): void {
    if (this.state.phase === 'idle') return
    this.session += 1
    if (this.maxTimer) clearTimeout(this.maxTimer)
    this.maxTimer = null
    this.pill.webContents.send(IPC.stopCapture, { discard: true })
    this.clipWaiter?.resolve(null)
    this.clipWaiter = null
    this.state = reduceDictation(this.state, { type: 'esc' })
    this.pushPill({ phase: 'hidden' })
  }

  async pasteLast(): Promise<void> {
    if (!this.lastText) return
    const target = (await getFrontApp()) ?? this.frontApp
    const ok = await pasteViaClipboard(this.lastText, target, process.pid)
    if (!ok) {
      this.pushPill({
        phase: 'error',
        error: 'Не удалось вставить. Проверьте Универсальный доступ.'
      })
      setTimeout(() => this.pushPill({ phase: 'hidden' }), 2200)
    }
  }

  async pasteText(text: string): Promise<void> {
    this.lastText = text
    await this.pasteLast()
  }

  private async transcribeAndPaste(
    pcm: Int16Array,
    sampleRate: number,
    session: number
  ): Promise<void> {
    const apiKey = loadApiKey()
    if (!apiKey) {
      this.state = reduceDictation(this.state, {
        type: 'transcribe-fail',
        error: 'Добавьте ключ AssemblyAI в Настройках.'
      })
      this.pushPill({ phase: 'error', error: this.state.error })
      return
    }

    try {
      const wav = encodeWav(pcm, sampleRate)
      const settings = loadSettings()
      const raw = await transcribeSync({
        apiKey,
        wav,
        config: buildSyncConfig({ language: settings.language, dictionary: settings.dictionary })
      })
      if (this.session !== session) return
      const text = settings.smartCleanup ? await cleanupTranscript({ apiKey, text: raw }) : raw
      if (this.session !== session) return
      this.state = reduceDictation(this.state, { type: 'transcribe-ok', text })
      this.lastText = text
      recordHistory(text)
      this.onHistory?.()

      const ok = await pasteViaClipboard(text, this.frontApp, process.pid)
      if (this.session !== session) return
      this.state = reduceDictation(this.state, { type: ok ? 'insert-ok' : 'insert-fail' })
      if (!ok) {
        this.pushPill({ phase: 'error', error: this.state.error })
        setTimeout(() => this.pushPill({ phase: 'hidden' }), 2600)
      } else {
        this.pushPill({ phase: 'hidden' })
      }
    } catch (error) {
      if (this.session !== session) return
      const message = error instanceof Error ? error.message : 'Не удалось распознать речь.'
      this.state = reduceDictation(this.state, { type: 'transcribe-fail', error: message })
      this.pushPill({ phase: 'error', error: message })
      setTimeout(() => {
        if (this.state.phase === 'idle') this.pushPill({ phase: 'hidden' })
      }, 2600)
    }
  }

  private collectClip(): Promise<ClipPayload | null> {
    return new Promise((resolve) => {
      this.clipWaiter = { resolve }
      this.pill.webContents.send(IPC.stopCapture, { discard: false })
      setTimeout(() => {
        if (this.clipWaiter) {
          this.clipWaiter.resolve(null)
          this.clipWaiter = null
        }
      }, 2500)
    })
  }

  private failCapture(message: string): void {
    this.session += 1
    if (this.maxTimer) clearTimeout(this.maxTimer)
    this.maxTimer = null
    this.state = {
      phase: 'idle',
      lastText: this.state.lastText,
      error: message,
      shouldCapture: false
    }
    this.pushPill({ phase: 'error', error: message })
    setTimeout(() => this.pushPill({ phase: 'hidden' }), 2400)
  }

  private setState(state: DictationState): void {
    this.state = state
  }

  private pushPill(state: PillState): void {
    if (state.phase === 'hidden') this.pill.hide()
    if (!this.pill.isDestroyed()) this.pill.webContents.send(IPC.pillState, state)
  }
}
