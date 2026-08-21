export type DictationPhase = 'idle' | 'recording' | 'transcribing' | 'inserting'

export type DictationEvent =
  | { type: 'ptt-down' }
  | { type: 'ptt-up' }
  | { type: 'esc' }
  | { type: 'max-duration' }
  | { type: 'clip-too-short' }
  | { type: 'transcribe-ok'; text: string }
  | { type: 'transcribe-fail'; error: string }
  | { type: 'insert-ok' }
  | { type: 'insert-fail' }

export type DictationState = {
  phase: DictationPhase
  lastText: string | null
  error: string | null
  shouldCapture: boolean
}

export function initialDictationState(): DictationState {
  return { phase: 'idle', lastText: null, error: null, shouldCapture: false }
}

export function reduceDictation(state: DictationState, event: DictationEvent): DictationState {
  switch (event.type) {
    case 'ptt-down':
      if (state.phase !== 'idle') return state
      return { ...state, phase: 'recording', shouldCapture: true, error: null }
    case 'ptt-up':
    case 'max-duration':
      if (state.phase !== 'recording') return state
      return { ...state, phase: 'transcribing', shouldCapture: false, error: null }
    case 'esc':
      if (state.phase === 'idle') return state
      return { ...state, phase: 'idle', shouldCapture: false, error: null }
    case 'clip-too-short':
      if (state.phase !== 'recording' && state.phase !== 'transcribing') return state
      return {
        ...state,
        phase: 'idle',
        shouldCapture: false,
        error: 'Слишком коротко — удерживайте клавишу чуть дольше.'
      }
    case 'transcribe-ok':
      if (state.phase !== 'transcribing') return state
      return {
        ...state,
        phase: 'inserting',
        lastText: event.text,
        error: null
      }
    case 'transcribe-fail':
      if (state.phase !== 'transcribing') return state
      return {
        ...state,
        phase: 'idle',
        error: event.error
      }
    case 'insert-ok':
      if (state.phase !== 'inserting') return state
      return { ...state, phase: 'idle', error: null }
    case 'insert-fail':
      if (state.phase !== 'inserting') return state
      return {
        ...state,
        phase: 'idle',
        error: 'Не удалось вставить текст. Нажмите Control+Shift+V, чтобы вставить последнее.'
      }
    default:
      return state
  }
}
