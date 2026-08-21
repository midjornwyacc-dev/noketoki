import { describe, expect, it } from 'vitest'
import { clipKeyterms } from '../src/shared/keyterms'

describe('clipKeyterms', () => {
  it('drops empty terms and keeps order', () => {
    expect(clipKeyterms(['  Noketoki  ', '', 'AssemblyAI', '   '])).toEqual(['Noketoki', 'AssemblyAI'])
  })

  it('caps total characters at 2048', () => {
    const terms = Array.from({ length: 80 }, (_, i) => `term-${String(i).padStart(3, '0')}-xxxx`)
    const clipped = clipKeyterms(terms)
    const total = clipped.reduce((n, t) => n + t.length, 0)
    expect(total).toBeLessThanOrEqual(2048)
    expect(clipped.length).toBeGreaterThan(0)
    expect(clipped[0]).toBe(terms[0])
  })

  it('skips a term that would overflow instead of truncating mid-word', () => {
    const almost = 'a'.repeat(2040)
    expect(clipKeyterms([almost, 'too-big-to-fit'])).toEqual([almost])
  })
})
