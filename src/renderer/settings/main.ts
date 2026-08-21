import { LANGUAGE_OPTIONS } from '../../shared/sync-config'
import { formatHotkey, hotkeyFromBrowserEvent, type Hotkey } from '../../shared/hotkey'

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const keyStatus = document.getElementById('key-status') as HTMLParagraphElement
const language = document.getElementById('language') as HTMLSelectElement
const cleanup = document.getElementById('cleanup') as HTMLInputElement
const sounds = document.getElementById('sounds') as HTMLInputElement
const login = document.getElementById('login') as HTMLInputElement
const dictionary = document.getElementById('dictionary') as HTMLTextAreaElement
const hotkeyBtn = document.getElementById('hotkey') as HTMLButtonElement
const micStatus = document.getElementById('mic-status') as HTMLSpanElement
const accessStatus = document.getElementById('access-status') as HTMLSpanElement

let hotkey: Hotkey = { ctrl: true, alt: true, shift: false, meta: false }
let recordingHotkey = false
let draftHotkey: Hotkey | null = null

for (const option of LANGUAGE_OPTIONS) {
  const el = document.createElement('option')
  el.value = option.code
  el.textContent = option.label
  language.appendChild(el)
}

async function refresh(): Promise<void> {
  const [settings, permissions] = await Promise.all([
    window.noketoki.getSettings(),
    window.noketoki.getPermissions()
  ])
  hotkey = settings.hotkey
  hotkeyBtn.textContent = formatHotkey(hotkey)
  language.value = settings.language
  cleanup.checked = settings.smartCleanup
  sounds.checked = settings.sounds
  login.checked = settings.launchAtLogin
  dictionary.value = settings.dictionary.join('\n')
  keyStatus.textContent = settings.hasApiKey
    ? 'Ключ сохранён в safeStorage. Повторно он не показывается.'
    : 'Ключ не сохранён.'
  micStatus.textContent = `Микрофон: ${permissions.microphone ? 'есть' : 'нужен доступ'}`
  accessStatus.textContent = `Универсальный доступ: ${permissions.accessibility ? 'есть' : 'нужен доступ'}`
}

document.getElementById('save-key')?.addEventListener('click', async () => {
  const value = apiKeyInput.value.trim()
  if (!value) return
  await window.noketoki.setApiKey(value)
  apiKeyInput.value = ''
  await refresh()
})

document.getElementById('clear-key')?.addEventListener('click', async () => {
  await window.noketoki.clearApiKey()
  apiKeyInput.value = ''
  await refresh()
})

document.getElementById('save-settings')?.addEventListener('click', async () => {
  await persist()
})

cleanup.addEventListener('change', () => void persist())
sounds.addEventListener('change', () => void persist())
login.addEventListener('change', () => void persist())
language.addEventListener('change', () => void persist())

async function persist(): Promise<void> {
  await window.noketoki.saveSettings({
    hotkey,
    language: language.value,
    smartCleanup: cleanup.checked,
    sounds: sounds.checked,
    launchAtLogin: login.checked,
    dictionary: dictionary.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  })
  await refresh()
}

hotkeyBtn.addEventListener('click', () => {
  recordingHotkey = true
  draftHotkey = null
  hotkeyBtn.classList.add('listening')
  hotkeyBtn.textContent = 'зажмите клавиши…'
})

window.addEventListener('keydown', (event) => {
  if (!recordingHotkey) return
  event.preventDefault()
  event.stopPropagation()
  if (event.code === 'Escape') {
    recordingHotkey = false
    draftHotkey = null
    hotkeyBtn.classList.remove('listening')
    hotkeyBtn.textContent = formatHotkey(hotkey)
    return
  }
  const next = hotkeyFromBrowserEvent(event)
  draftHotkey = next
  hotkeyBtn.textContent = formatHotkey(next)
  if (next.code) {
    hotkey = next
    recordingHotkey = false
    draftHotkey = null
    hotkeyBtn.classList.remove('listening')
    void persist()
  }
})

window.addEventListener('keyup', (event) => {
  if (!recordingHotkey || !draftHotkey) return
  event.preventDefault()
  const modifierCount =
    Number(draftHotkey.ctrl) +
    Number(draftHotkey.alt) +
    Number(draftHotkey.shift) +
    Number(draftHotkey.meta)
  if (!draftHotkey.code && modifierCount >= 2) {
    hotkey = draftHotkey
    recordingHotkey = false
    draftHotkey = null
    hotkeyBtn.classList.remove('listening')
    hotkeyBtn.textContent = formatHotkey(hotkey)
    void persist()
  }
})

document.getElementById('mic-btn')?.addEventListener('click', async () => {
  const granted = await window.noketoki.requestMic()
  if (!granted) await window.noketoki.openPrivacy('microphone')
  await refresh()
})

document.getElementById('access-btn')?.addEventListener('click', async () => {
  await window.noketoki.openPrivacy('accessibility')
  await refresh()
})

void refresh()
setInterval(() => void refresh(), 2500)
