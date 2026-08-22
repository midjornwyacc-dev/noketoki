export type AssemblyErrorPayload = {
  kind: 'http' | 'timeout' | 'network' | 'empty' | 'key'
  status?: number
  detail?: string | null
}

export function formatAssemblyError(error: AssemblyErrorPayload): string {
  if (error.kind === 'key') return 'Добавьте ключ AssemblyAI в Настройках.'
  if (error.kind === 'timeout') {
    return 'Распознавание не успело за 60 секунд. Проверьте сеть и попробуйте ещё раз.'
  }
  if (error.kind === 'network') {
    return 'Нет связи с AssemblyAI. Проверьте сеть и повторите.'
  }
  if (error.kind === 'empty') return 'Пустой ответ распознавания.'

  const status = error.status ?? 0
  if (status === 401) return 'Неверный ключ AssemblyAI. Проверьте Настройки.'
  if (status === 413) return 'Клип длиннее 120 секунд или больше 40 МБ.'
  if (status === 429) return 'Слишком много запросов. Подождите немного.'
  if (status === 504) return 'Сервер AssemblyAI не успел за 30 секунд. Повторите короче или позже.'

  const detail = error.detail
  if (detail && !/authorization|api[_-]?key|bearer/i.test(detail)) return detail
  return status ? `Ошибка распознавания (${status}).` : 'Не удалось распознать речь.'
}

export function parseAssemblyInvokeError(raw: unknown): string {
  if (raw instanceof Error) return parseAssemblyInvokeError(raw.message)
  if (raw && typeof raw === 'object' && 'message' in raw) {
    return parseAssemblyInvokeError((raw as { message: unknown }).message)
  }
  const text = typeof raw === 'string' ? raw : ''
  if (!text) return formatAssemblyError({ kind: 'network' })
  try {
    const parsed = JSON.parse(text) as AssemblyErrorPayload
    if (parsed && typeof parsed === 'object' && parsed.kind) {
      return formatAssemblyError(parsed)
    }
  } catch {
    // not JSON — fall through
  }
  return formatAssemblyError({ kind: 'network' })
}
