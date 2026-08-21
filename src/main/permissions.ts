import { systemPreferences, shell } from 'electron'
import { openPrivacyPane } from './macos'
import type { PermissionStatus } from '../shared/types'

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const microphone =
    process.platform === 'darwin'
      ? systemPreferences.getMediaAccessStatus('microphone') === 'granted'
      : true
  const accessibility =
    process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true
  return { microphone, accessibility }
}

export async function requestMicrophone(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  try {
    return await systemPreferences.askForMediaAccess('microphone')
  } catch {
    return false
  }
}

export function promptAccessibility(): boolean {
  if (process.platform !== 'darwin') return true
  return systemPreferences.isTrustedAccessibilityClient(true)
}

export function openPermissionSettings(kind: 'microphone' | 'accessibility'): void {
  openPrivacyPane(kind)
  if (kind === 'microphone') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone').catch(
      () => undefined
    )
  } else {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    ).catch(() => undefined)
  }
}
