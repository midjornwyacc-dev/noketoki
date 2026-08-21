export const KEYTERMS_MAX_CHARS = 2048

export function clipKeyterms(terms: string[]): string[] {
  const out: string[] = []
  let used = 0
  for (const raw of terms) {
    const term = raw.trim()
    if (!term) continue
    if (used + term.length > KEYTERMS_MAX_CHARS) continue
    out.push(term)
    used += term.length
  }
  return out
}
