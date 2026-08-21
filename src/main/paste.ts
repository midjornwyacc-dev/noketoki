import { clipboard, nativeImage, type NativeImage } from 'electron'
import { activateApp, sendPaste, type FrontApp } from './macos'

export type ClipboardSnapshot = {
  text: string
  html: string
  rtf: string
  image: NativeImage | null
}

export function snapshotClipboard(): ClipboardSnapshot {
  const image = clipboard.readImage()
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: safeReadRtf(),
    image: image.isEmpty() ? null : nativeImage.createFromBuffer(image.toPNG())
  }
}

export function restoreClipboard(snapshot: ClipboardSnapshot): void {
  const payload: Electron.Data = {
    text: snapshot.text,
    html: snapshot.html,
    rtf: snapshot.rtf
  }
  if (snapshot.image && !snapshot.image.isEmpty()) payload.image = snapshot.image
  clipboard.write(payload)
}

export async function pasteViaClipboard(
  text: string,
  target: FrontApp | null,
  ourPid: number
): Promise<boolean> {
  const snapshot = snapshotClipboard()
  try {
    if (target && target.pid !== ourPid) {
      await activateApp(target)
      await sleep(80)
    }
    clipboard.writeText(text)
    await sleep(50)
    await sendPaste()
    await sleep(220)
    return true
  } catch {
    return false
  } finally {
    restoreClipboard(snapshot)
  }
}

function safeReadRtf(): string {
  try {
    return clipboard.readRTF()
  } catch {
    return ''
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
