import { describe, expect, it } from 'vitest'
import { buildSyncConfig, SYNC_LANGUAGE_CODES } from '../src/shared/sync-config'

describe('buildSyncConfig', () => {
  it('sends language_code for official Sync languages', () => {
    expect(buildSyncConfig({ language: 'en', dictionary: [] })).toEqual({ language_code: 'en' })
    expect(SYNC_LANGUAGE_CODES.has('es')).toBe(true)
  })

  it('describes Russian in prompt instead of sending an unsupported language_code', () => {
    const config = buildSyncConfig({ language: 'ru', dictionary: [] })
    expect(config.language_code).toBeUndefined()
    expect(String(config.prompt).toLowerCase()).toContain('russian')
  })

  it('attaches clipped keyterms_prompt from the personal dictionary', () => {
    const config = buildSyncConfig({ language: 'en', dictionary: ['Noketoki', ''] })
    expect(config.keyterms_prompt).toEqual(['Noketoki'])
  })
})
