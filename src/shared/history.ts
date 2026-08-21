export type HistoryItem = {
  id: string
  text: string
  createdAt: number
}

export function pushHistory(
  items: HistoryItem[],
  item: HistoryItem,
  limit = 50
): HistoryItem[] {
  if (!item.text.trim()) return items
  return [item, ...items].slice(0, limit)
}
