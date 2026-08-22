import { MAX_CLIP_MS, MIN_CLIP_MS, SAMPLE_RATE } from '../shared/constants'
import { initialDictationState, reduceDictation, type DictationState } from '../shared/dictation-machine'
import { buildSyncConfig } from '../shared/sync-config'
import { encodeWav, pcmDurationMs } from '../shared/wav'
import { cleanupTranscript, transcribeSync, warmSyncConnection } from './assemblyai'
import { getSettings, hidePill, pasteText, recordHistory, setLastText, showPill } from './api'
import { MicCapture } from './capture'
import { playCue } from './sounds'

export type DictationTarget = 'macos' | 'ios'

export type DictationHooks = {
  onState: (state: DictationState, extra?: { durationMs?: number }) => void
  onLevel?: (level: number) => void
  onResult?: (text: string) => void
}

export class DictationSession {
  private state = initialDictationState()
  private session = 0
  private maxTimer: number | null = null
  private capture = new MicCapture()
  private target: DictationTarget
  private hooks: DictationHooks

  constructor(target: DictationTarget, hooks: DictationHooks) {
    this.target = target
    this.hooks = hooks
  }

  current(): DictationState {
    return this.state
  }

  async beginHold(): Promise<void> {
    const next = reduceDictation(this.state, { type: 'ptt-down' })
    if (next === this.state) return
    const settings = await getSettings()
    if (!settings.hasApiKey) {
      this.state = { ...this.state, error: 'Добавьте ключ AssemblyAI в Настройках.' }
      if (this.target === 'macos') await showPill()
      this.hooks.onState(this.state)
      return
    }
    this.state = next
    this.session += 1
    const session = this.session
    void warmSyncConnection()
    if (settings.sounds) playCue('start')
    if (this.target === 'macos') await showPill()
    this.hooks.onState(this.state, { durationMs: 0 })
    try {
      await this.capture.start(SAMPLE_RATE, (level) => this.hooks.onLevel?.(level))
    } catch {
      this.fail('Нет доступа к микрофону.')
      return
    }
    this.maxTimer = window.setTimeout(() => {
      if (this.session === session) void this.finishHold('max-duration')
    }, MAX_CLIP_MS)
  }

  async finishHold(reason: 'ptt-up' | 'max-duration' = 'ptt-up'): Promise<void> {
    if (this.state.phase !== 'recording') return
    const session = this.session
    if (this.maxTimer) window.clearTimeout(this.maxTimer)
    this.maxTimer = null
    this.state = reduceDictation(this.state, {
      type: reason === 'max-duration' ? 'max-duration' : 'ptt-up'
    })
    const settings = await getSettings()
    if (settings.sounds) playCue('stop')
    this.hooks.onState(this.state)
    const { pcm, sampleRate } = await this.capture.stop()
    if (this.session !== session) return
    const durationMs = pcmDurationMs(pcm, sampleRate)
    if (durationMs < MIN_CLIP_MS) {
      this.state = reduceDictation(this.state, { type: 'clip-too-short' })
      this.hooks.onState(this.state)
      return
    }
    await this.transcribe(pcm, sampleRate, session)
  }

  cancel(): void {
    if (this.state.phase === 'idle') return
    this.session += 1
    if (this.maxTimer) window.clearTimeout(this.maxTimer)
    this.maxTimer = null
    void this.capture.cancel()
    this.state = reduceDictation(this.state, { type: 'esc' })
    this.hooks.onState(this.state)
    if (this.target === 'macos') void hidePill()
  }

  private async transcribe(pcm: Int16Array, sampleRate: number, session: number): Promise<void> {
    try {
      const settings = await getSettings()
      const raw = await transcribeSync({
        wav: encodeWav(pcm, sampleRate),
        config: buildSyncConfig({ language: settings.language, dictionary: settings.dictionary })
      })
      if (this.session !== session) return
      const text = settings.smartCleanup ? await cleanupTranscript({ text: raw }) : raw
      if (this.session !== session) return
      this.state = reduceDictation(this.state, { type: 'transcribe-ok', text })
      await setLastText(text)
      await recordHistory(text)
      this.hooks.onResult?.(text)
      if (this.target === 'macos') {
        try {
          await pasteText(text)
          this.state = reduceDictation(this.state, { type: 'insert-ok' })
          await hidePill()
        } catch {
          this.state = reduceDictation(this.state, { type: 'insert-fail' })
        }
      } else {
        this.state = reduceDictation(this.state, { type: 'insert-ok' })
      }
      this.hooks.onState(this.state)
    } catch (error) {
      if (this.session !== session) return
      const message = error instanceof Error ? error.message : 'Не удалось распознать речь.'
      this.state = reduceDictation(this.state, { type: 'transcribe-fail', error: message })
      this.hooks.onState(this.state)
    }
  }

  private fail(message: string): void {
    this.session += 1
    if (this.maxTimer) window.clearTimeout(this.maxTimer)
    this.maxTimer = null
    this.state = {
      phase: 'idle',
      lastText: this.state.lastText,
      error: message,
      shouldCapture: false
    }
    if (this.target === 'macos') void showPill()
    this.hooks.onState(this.state)
  }
}
