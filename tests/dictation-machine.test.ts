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

  it('returns to idle on Esc from recording or transcribing', () => {
    const recording = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    expect(reduceDictation(recording, { type: 'esc' }).phase).toBe('idle')
    expect(reduceDictation(recording, { type: 'esc' }).shouldCapture).toBe(false)
    const transcribing = reduceDictation(recording, { type: 'ptt-up' })
    expect(reduceDictation(transcribing, { type: 'esc' }).phase).toBe('idle')
  })

  it('keeps a previous lastText when Esc cancels a later take', () => {
    let state = reduceDictation(initialDictationState(), { type: 'ptt-down' })
    state = reduceDictation(state, { type: 'ptt-up' })
    state = reduceDictation(state, { type: 'transcribe-ok', text: 'kept' })
    state = reduceDictation(state, { type: 'insert-ok' })
    state = reduceDictation(state, { type: 'ptt-down' })
    state = reduceDictation(state, { type: 'esc' })
    expect(state.phase).toBe('idle')
    expect(state.lastText).toBe('kept')
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
