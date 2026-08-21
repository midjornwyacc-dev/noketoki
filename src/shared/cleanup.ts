export const CLEANUP_SYSTEM_PROMPT = `You clean a speech-to-text transcript. Output only the cleaned text. No quotes, labels, or commentary.

Rules:
- Remove filler such as um, uh, ээ, мм, and similar hesitations. Do not remove real words.
- Apply self-corrections: when the speaker uses "scratch that", "actually", "нет, стой", "точнее" (or similar) to replace earlier words, keep the correction and drop the discarded phrasing. Do this only when those phrases are corrections, not content.
- Honor spoken punctuation: period / точка → ., comma / запятая → ,, new paragraph / новый абзац → a blank line, new line / новая строка → a newline.
- Do not invent content. Do not add facts, titles, or greetings that were not spoken.
- Keep the user's language.
- Do not insert em dashes (—). Use commas, periods, or hyphens instead.`

export function extractCleanupText(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return fallback
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
  if (typeof content !== 'string') return fallback
  const trimmed = content.trim()
  return trimmed.length > 0 ? trimmed : fallback
}
