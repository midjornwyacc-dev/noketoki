import { emit, listen } from '@tauri-apps/api/event'
import { hidePill, pasteLast } from './api'
import { DictationSession } from './dictation'
import { fillBars, formatTime, paintBars, resetBars } from '../views/bars'
import type { DictationState } from '../shared/dictation-machine'

type PillUi = {
  phase: DictationState['phase']
  error: string | null
  durationMs?: number
}

/**
 * Settings webview owns the macOS PTT session (it is created first and stays alive).
 * The pill window is a display surface: it paints meter/status from these events.
 */
export function bindMacosSession(): DictationSession {
  const session = new DictationSession('macos', {
    onState(state) {
      void emit('pill-ui', {
        phase: state.phase,
        error: state.error
      } satisfies PillUi)
    },
    onLevel(level) {
      void emit('pill-level', level)
    }
  })

  void listen('ptt-down', () => void session.beginHold())
  void listen('ptt-up', () => void session.finishHold('ptt-up'))
  void listen('escape', () => session.cancel())
  void listen('paste-last', () => void pasteLast())
  void listen('pill-cancel', () => session.cancel())
  return session
}

export function bindPillView(): void {
  const status = document.getElementById('pill-status') as HTMLSpanElement | null
  const time = document.getElementById('pill-time') as HTMLSpanElement | null
  const barsHost = document.getElementById('pill-bars')
  const bars = barsHost ? fillBars(barsHost) : []
  let startedAt = 0
  let clock = 0
  let hideTimer = 0

  function stopTick(): void {
    if (clock) window.clearTimeout(clock)
    clock = 0
  }

  function tick(): void {
    stopTick()
    const step = (): void => {
      if (time) time.textContent = formatTime(performance.now() - startedAt)
      clock = window.setTimeout(step, 200)
    }
    step()
  }

  void listen<PillUi>('pill-ui', (event) => {
    const state = event.payload
    if (hideTimer) window.clearTimeout(hideTimer)
    if (state.phase === 'idle' && !state.error) {
      resetBars(bars)
      stopTick()
      void hidePill()
      return
    }
    if (state.phase === 'recording') {
      if (status) status.textContent = 'слушаю'
      startedAt = performance.now()
      tick()
    } else if (state.phase === 'transcribing') {
      if (status) status.textContent = 'разбираю'
      stopTick()
    } else if (state.error) {
      if (status) status.textContent = state.error
      stopTick()
      hideTimer = window.setTimeout(() => {
        void hidePill()
      }, 2400)
    }
  })
  void listen<number>('pill-level', (event) => paintBars(bars, event.payload))
  document.getElementById('pill-cancel')?.addEventListener('click', () => {
    void emit('pill-cancel')
  })
}