import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { app } from 'electron'
import { encodeToneWav } from '../shared/wav'

let startPath: string | null = null
let stopPath: string | null = null

export function prepareSounds(): void {
  const dir = join(app.getPath('userData'), 'sounds')
  mkdirSync(dir, { recursive: true })
  startPath = join(dir, 'start.wav')
  stopPath = join(dir, 'stop.wav')
  writeFileSync(startPath, encodeToneWav({ frequency: 784, durationMs: 90, gain: 0.16 }))
  writeFileSync(stopPath, encodeToneWav({ frequency: 523, durationMs: 70, gain: 0.14 }))
}

export function playCue(kind: 'start' | 'stop'): void {
  const file = kind === 'start' ? startPath : stopPath
  if (!file) return
  if (process.platform === 'darwin') {
    execFile('afplay', [file], () => undefined)
  }
}
