import { CLEANUP_SYSTEM_PROMPT, extractCleanupText } from '../shared/cleanup'
import {
  LLM_GATEWAY_URL,
  LLM_MODEL,
  SYNC_MODEL,
  SYNC_TRANSCRIBE_URL,
  SYNC_WARM_URL
} from '../shared/constants'
import type { SyncConfig } from '../shared/sync-config'

export class AssemblyError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'AssemblyError'
  }
}

export async function warmSyncConnection(): Promise<boolean> {
  try {
    const response = await fetch(SYNC_WARM_URL, {
      method: 'GET',
      headers: { 'X-AAI-Model': SYNC_MODEL }
    })
    return response.ok
  } catch {
    return false
  }
}

export async function transcribeSync(opts: {
  apiKey: string
  wav: Uint8Array
  config: SyncConfig
}): Promise<string> {
  const form = new FormData()
  const audio = new Uint8Array(opts.wav.byteLength)
  audio.set(opts.wav)
  form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'clip.wav')
  form.append('config', new Blob([JSON.stringify(opts.config)], { type: 'application/json' }))

  const response = await fetch(SYNC_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      Authorization: opts.apiKey,
      'X-AAI-Model': SYNC_MODEL
    },
    body: form
  })

  const payload = (await response.json().catch(() => null)) as
    | { text?: string; message?: string; detail?: string }
    | null

  if (!response.ok) {
    throw new AssemblyError(publicAssemblyMessage(payload, response.status), response.status)
  }

  const text = payload?.text?.trim() ?? ''
  if (!text) throw new AssemblyError('Пустой ответ распознавания.')
  return text
}

export async function cleanupTranscript(opts: { apiKey: string; text: string }): Promise<string> {
  try {
    const response = await fetch(LLM_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: opts.apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: CLEANUP_SYSTEM_PROMPT },
          { role: 'user', content: opts.text }
        ]
      })
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return opts.text
    return extractCleanupText(payload, opts.text)
  } catch {
    return opts.text
  }
}

function publicAssemblyMessage(
  payload: { message?: string; detail?: string } | null,
  status: number
): string {
  if (status === 401) return 'Неверный ключ AssemblyAI. Проверьте Настройки.'
  if (status === 413) return 'Клип длиннее 120 секунд или больше 40 МБ.'
  if (status === 429) return 'Слишком много запросов. Подождите немного.'
  const detail = payload?.message || payload?.detail
  if (detail && !/authorization|api[_-]?key|bearer/i.test(detail)) return detail
  return `Ошибка распознавания (${status}).`
}
