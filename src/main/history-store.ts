import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pushHistory, type HistoryItem } from '../shared/history'

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function loadHistory(): HistoryItem[] {
  if (!existsSync(historyPath())) return []
  try {
    const parsed = JSON.parse(readFileSync(historyPath(), 'utf8')) as HistoryItem[]
    return Array.isArray(parsed) ? parsed.slice(0, 50) : []
  } catch {
    return []
  }
}

export function recordHistory(text: string): HistoryItem[] {
  const items = pushHistory(loadHistory(), {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    createdAt: Date.now()
  })
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(historyPath(), JSON.stringify(items, null, 2))
  return items
}
