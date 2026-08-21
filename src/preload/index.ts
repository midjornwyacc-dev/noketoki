import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type { ClipPayload, PermissionStatus, PillState, PublicSettings } from '../shared/types'
import type { HistoryItem } from '../shared/history'
import type { Hotkey } from '../shared/hotkey'

const api = {
  onPillState(callback: (state: PillState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, state: PillState): void => callback(state)
    ipcRenderer.on(IPC.pillState, listener)
    return () => ipcRenderer.removeListener(IPC.pillState, listener)
  },
  onStartCapture(callback: (opts: { sampleRate: number }) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, opts: { sampleRate: number }): void =>
      callback(opts)
    ipcRenderer.on(IPC.startCapture, listener)
    return () => ipcRenderer.removeListener(IPC.startCapture, listener)
  },
  onStopCapture(callback: (opts: { discard: boolean }) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, opts: { discard: boolean }): void =>
      callback(opts)
    ipcRenderer.on(IPC.stopCapture, listener)
    return () => ipcRenderer.removeListener(IPC.stopCapture, listener)
  },
  sendClip(clip: ClipPayload): void {
    ipcRenderer.send(IPC.clipReady, clip)
  },
  sendCaptureError(message: string): void {
    ipcRenderer.send(IPC.captureError, message)
  },
  cancel(): void {
    ipcRenderer.send(IPC.pillCancel)
  },
  getSettings(): Promise<PublicSettings> {
    return ipcRenderer.invoke(IPC.getSettings)
  },
  saveSettings(patch: Record<string, unknown>): Promise<PublicSettings> {
    return ipcRenderer.invoke(IPC.saveSettings, patch)
  },
  setApiKey(apiKey: string): Promise<{ hasApiKey: boolean }> {
    return ipcRenderer.invoke(IPC.setApiKey, apiKey)
  },
  clearApiKey(): Promise<{ hasApiKey: boolean }> {
    return ipcRenderer.invoke(IPC.clearApiKey)
  },
  getHistory(): Promise<HistoryItem[]> {
    return ipcRenderer.invoke(IPC.getHistory)
  },
  getPermissions(): Promise<PermissionStatus> {
    return ipcRenderer.invoke(IPC.getPermissions)
  },
  requestMic(): Promise<boolean> {
    return ipcRenderer.invoke(IPC.requestMic)
  },
  openPrivacy(kind: 'microphone' | 'accessibility'): Promise<void> {
    return ipcRenderer.invoke(IPC.openPrivacy, kind)
  },
  pasteLast(): Promise<void> {
    return ipcRenderer.invoke(IPC.pasteLast)
  }
}

export type NoketokiApi = typeof api
export type { Hotkey }

contextBridge.exposeInMainWorld('noketoki', api)
