import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type FrontApp = {
  pid: number
  name: string
}

export async function getFrontApp(): Promise<FrontApp | null> {
  if (process.platform !== 'darwin') return null
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to tell (first process whose frontmost is true) to return (unix id as text) & linefeed & name'
    ])
    const [pidLine, nameLine] = stdout.trim().split('\n')
    const pid = Number(pidLine)
    if (!pid || !nameLine) return null
    return { pid, name: nameLine.trim() }
  } catch {
    return null
  }
}

export async function activateApp(target: FrontApp): Promise<boolean> {
  if (process.platform !== 'darwin') return false
  try {
    await execFileAsync('osascript', [
      '-e',
      `tell application "System Events" to set frontmost of (first process whose unix id is ${target.pid}) to true`
    ])
    return true
  } catch {
    try {
      await execFileAsync('osascript', ['-e', `tell application "${escapeAppleScript(target.name)}" to activate`])
      return true
    } catch {
      return false
    }
  }
}

export async function sendPaste(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Вставка через Cmd+V доступна только на macOS.')
  }
  await execFileAsync('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down'
  ])
}

export function openPrivacyPane(pane: 'microphone' | 'accessibility'): void {
  const urls =
    pane === 'microphone'
      ? [
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
          'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone'
        ]
      : [
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
          'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility'
        ]
  execFile('open', [urls[0]])
}

function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
