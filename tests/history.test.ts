import { describe, expect, it } from 'vitest'
import { pushHistory, type HistoryItem } from '../src/shared/history'

describe('history', () => {
  it('prepends items and caps the list', () => {
    const items: HistoryItem[] = []
    let next = items
    for (let i = 0; i < 60; i++) {
      next = pushHistory(next, { id: String(i), text: `t${i}`, createdAt: i }, 50)
    }
    expect(next).toHaveLength(50)
    expect(next[0].id).toBe('59')
    expect(next[49].id).toBe('10')
  })

  it('ignores empty transcripts', () => {
    expect(pushHistory([], { id: '1', text: '   ', createdAt: 1 }, 50)).toEqual([])
  })
})
