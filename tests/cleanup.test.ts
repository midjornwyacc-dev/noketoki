import { describe, expect, it } from 'vitest'
import { CLEANUP_SYSTEM_PROMPT, extractCleanupText } from '../src/shared/cleanup'

describe('cleanup prompt', () => {
  it('asks to drop fillers, honor corrections and spoken punctuation, keep language, and avoid em dashes', () => {
    const prompt = CLEANUP_SYSTEM_PROMPT.toLowerCase()
    expect(prompt).toContain('um')
    expect(prompt).toContain('ээ')
    expect(prompt).toContain('scratch that')
    expect(prompt).toContain('нет, стой')
    expect(prompt).toContain('новый абзац')
    expect(prompt).toContain('em dash')
    expect(prompt).toContain('do not invent')
  })

  it('returns the model text when the LLM responds normally', () => {
    expect(
      extractCleanupText(
        {
          choices: [{ message: { content: '  Привет, мир.  ' } }]
        },
        'raw'
      )
    ).toBe('Привет, мир.')
  })

  it('falls back to the raw transcript when the LLM payload is empty or malformed', () => {
    expect(extractCleanupText({}, 'raw dictation')).toBe('raw dictation')
    expect(extractCleanupText({ choices: [{ message: { content: '' } }] }, 'raw dictation')).toBe(
      'raw dictation'
    )
  })
})
