export const APP_NAME = 'Noketoki'
export const SYNC_BASE_URL = 'https://sync.assemblyai.com'
export const SYNC_TRANSCRIBE_URL = `${SYNC_BASE_URL}/transcribe`
export const SYNC_WARM_URL = `${SYNC_BASE_URL}/warm`
export const SYNC_MODEL = 'universal-3-5-pro'
export const LLM_GATEWAY_URL = 'https://llm-gateway.assemblyai.com/v1/chat/completions'
export const LLM_MODEL = 'qwen3.5-4b-32k-fast'
export const MIN_CLIP_MS = 80
export const MAX_CLIP_MS = 120_000
export const SAMPLE_RATE = 16_000

export const IPC = {
  pillState: 'noketoki:pill-state',
  pillLevels: 'noketoki:pill-levels',
  pillCancel: 'noketoki:pill-cancel',
  startCapture: 'noketoki:start-capture',
  stopCapture: 'noketoki:stop-capture',
  clipReady: 'noketoki:clip-ready',
  captureError: 'noketoki:capture-error',
  playSound: 'noketoki:play-sound',
  getSettings: 'noketoki:get-settings',
  saveSettings: 'noketoki:save-settings',
  setApiKey: 'noketoki:set-api-key',
  clearApiKey: 'noketoki:clear-api-key',
  getHistory: 'noketoki:get-history',
  getPermissions: 'noketoki:get-permissions',
  requestMic: 'noketoki:request-mic',
  openPrivacy: 'noketoki:open-privacy',
  pasteLast: 'noketoki:paste-last'
} as const
