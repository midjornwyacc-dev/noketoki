import { describe, expect, it } from 'vitest'
import {
  formatAssemblyError,
  parseAssemblyInvokeError,
  type AssemblyErrorPayload
} from '../src/shared/assembly-errors'

describe('AssemblyAI public errors', () => {
  it('maps HTTP 401, 413, 429 and 504 to specific Russian copy', () => {
    expect(formatAssemblyError({ kind: 'http', status: 401 })).toMatch(/ключ/i)
    expect(formatAssemblyError({ kind: 'http', status: 413 })).toMatch(/40/)
    expect(formatAssemblyError({ kind: 'http', status: 429 })).toMatch(/запрос/i)
    expect(formatAssemblyError({ kind: 'http', status: 504 })).toMatch(/не успел|таймаут|сервер/i)
  })

  it('maps client timeout and network failure without leaking secrets', () => {
    expect(formatAssemblyError({ kind: 'timeout' })).toMatch(/секунд|таймаут|дождаться/i)
    expect(formatAssemblyError({ kind: 'network' })).toMatch(/сеть|соединен/i)
    const leaked = formatAssemblyError({
      kind: 'http',
      status: 500,
      detail: 'invalid api_key bearer Authorization token abc'
    })
    expect(leaked).not.toMatch(/abc|bearer|api_key/i)
    expect(leaked).toMatch(/500/)
  })

  it('parses a Rust invoke error JSON string and a plain fallback', () => {
    const payload: AssemblyErrorPayload = { kind: 'http', status: 504, detail: 'Gateway Timeout' }
    expect(parseAssemblyInvokeError(JSON.stringify(payload))).toMatch(/сервер|таймаут|не успел/i)
    expect(parseAssemblyInvokeError({ message: JSON.stringify(payload) })).toMatch(/сервер|таймаут|не успел/i)
    expect(parseAssemblyInvokeError('weird')).toMatch(/распознать|сеть/i)
  })
})
