import { invoke } from '@tauri-apps/api/core'
import { CLEANUP_SYSTEM_PROMPT } from '../shared/cleanup'
import { parseAssemblyInvokeError } from '../shared/assembly-errors'
import type { SyncConfig } from '../shared/sync-config'

export class AssemblyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssemblyError'
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function warmSyncConnection(): Promise<boolean> {
  try {
    return await invoke<boolean>('warm_sync')
  } catch {
    return false
  }
}

export async function transcribeSync(opts: { wav: Uint8Array; config: SyncConfig }): Promise<string> {
  try {
    return await invoke<string>('transcribe_sync', {
      wavBase64: bytesToBase64(opts.wav),
      config: opts.config
    })
  } catch (error) {
    throw new AssemblyError(parseAssemblyInvokeError(error))
  }
}

export async function cleanupTranscript(opts: { text: string }): Promise<string> {
  try {
    return await invoke<string>('cleanup_transcript', {
      text: opts.text,
      systemPrompt: CLEANUP_SYSTEM_PROMPT
    })
  } catch {
    return opts.text
  }
}
