import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

function keyPath(): string {
  return join(app.getPath('userData'), 'secrets', 'assemblyai.key')
}

export function hasApiKey(): boolean {
  return existsSync(keyPath())
}

export function saveApiKey(apiKey: string): void {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    clearApiKey()
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage недоступен — ключ нельзя сохранить на этом устройстве.')
  }
  const dir = join(app.getPath('userData'), 'secrets')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const payload = safeStorage.encryptString(trimmed)
  writeFileSync(keyPath(), payload, { mode: 0o600 })
}

export function loadApiKey(): string | null {
  if (!hasApiKey()) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const buf = readFileSync(keyPath())
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

export function clearApiKey(): void {
  if (existsSync(keyPath())) unlinkSync(keyPath())
}
