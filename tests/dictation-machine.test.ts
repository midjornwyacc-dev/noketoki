import { describe, expect, it } from 'vitest'
import { initialDictationState, reduceDictation } from '../src/shared/dictation-machine'

describe('dictation state machine', () => {
  it('starts recording on PTT down from idle', () => {
    const next = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    expect(next.phase).toBe('recording')
    expect(next.shouldCapture).toBe(true)
    expect(next.error).toBeNull()
  })

  it('moves to transcribing on PTT up and on the 120s cap', () => {
    const recording = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    expect(reduceDictation(recording, { type: 'ptt-up' }).phase).toBe('transcribing')
    expect(reduceDictation(recording, { type: 'max-duration' }).phase).toBe('transcribing')
  })

  it('cancels recording and transcribing on Esc without keeping insert text from this take', () => {
    const recording = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    const cancelled = reduceDictation(recording, { type: 'esc' })
    expect(cancelled.phase).toBe('idle')
    expect(cancelled.shouldCapture).toBe(false)
    expect(cancelled.lastText).toBeNull()

    const transcribing = reduceDictation(recording, { type: 'ptt-up' })
    const cancelledLater = reduceDictation(transcribing, { type: 'esc' })
    expect(cancelledLater.phase).toBe('idle')
    expect(cancelledLater.lastText).toBeNull()
  })

  it('keeps lastText when insert fails so paste-last can retry', () => {
    let state = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    state = reduceDictation(state, { type: 'ptt-up' })
    state = reduceDictation(state, { type: 'transcribe-ok', text: 'hello' })
    expect(state.phase).toBe('inserting')
    state = reduceDictation(state, { type: 'insert-fail' })
    expect(state.phase).toBe('idle')
    expect(state.lastText).toBe('hello')
    expect(state.error).toMatch(/вставить/i)
  })

  it('ignores overlapping PTT while busy and does not transcribe clips that are too short', () => {
    const recording = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    expect(reduceDictation(recording, { type: 'ptt-down' }).phase).toBe('recording')

    const transcribing = reduceDictation(recording, { type: 'ptt-up' })
    expect(reduceDictation(transcribing, { type: 'ptt-down' }).phase).toBe('transcribing')

    const tooShort = reduceDictation(recording, { type: 'clip-too-short' })
    expect(tooShort.phase).toBe('idle')
    expect(tooShort.shouldCapture).toBe(false)
  })
})
