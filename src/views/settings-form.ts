import { formatHotkey, hotkeyFromBrowserEvent, type Hotkey } from '../shared/hotkey'
import { LANGUAGE_OPTIONS } from '../shared/sync-config'
import type { AppSettings, PublicSettings } from '../shared/types'
import { clearApiKey, getPermissions, getSettings, openPrivacy, saveSettings, setApiKey } from '../lib/api'

export function mountSettingsForm(host: HTMLElement, opts: { desktop: boolean }): void {
  host.innerHTML = `
    <h2>Ключ AssemblyAI</h2>
    <p class="hint" data-key-status>Ключ не сохранён.</p>
    <label>Вставить ключ
      <input data-api-key type="password" autocomplete="off" spellcheck="false" placeholder="ключ из кабинета AssemblyAI" />
    </label>
    <div class="row">
      <button type="button" data-save-key>Сохранить ключ</button>
      <button type="button" class="ghost" data-clear-key>Удалить</button>
    </div>
    <h2>Диктовка</h2>
    ${
      opts.desktop
        ? `<label>Горячая клавиша (удерживать)
            <button type="button" class="hotkey" data-hotkey>Control + Option</button>
          </label>
          <p class="hint">Fn недоступен. По умолчанию Control+Option.</p>`
        : ''
    }
    <label>Язык
      <select data-language></select>
    </label>
    <label class="check"><input type="checkbox" data-cleanup /> Умная очистка</label>
    <label class="check"><input type="checkbox" data-sounds /> Короткие звуки старта и стопа</label>
    ${
      opts.desktop
        ? `<label class="check"><input type="checkbox" data-login /> Открывать при входе в систему</label>`
        : ''
    }
    <h2>Личный словарь</h2>
    <p class="hint">Имена и термины уходят в keyterms_prompt. По одному на строку.</p>
    <textarea data-dictionary rows="5" placeholder="Noketoki"></textarea>
    <button type="button" data-save>Сохранить настройки</button>
    <p class="foot">${opts.desktop ? 'Вставить последнее: Control + Shift + V · Esc отменяет запись' : 'Ключ хранится в связке ключей iOS'}</p>
  `

  const language = host.querySelector('[data-language]') as HTMLSelectElement
  for (const option of LANGUAGE_OPTIONS) {
    const el = document.createElement('option')
    el.value = option.code
    el.textContent = option.label
    language.appendChild(el)
  }

  const apiKeyInput = host.querySelector('[data-api-key]') as HTMLInputElement
  const keyStatus = host.querySelector('[data-key-status]') as HTMLElement
  const cleanup = host.querySelector('[data-cleanup]') as HTMLInputElement
  const sounds = host.querySelector('[data-sounds]') as HTMLInputElement
  const login = host.querySelector('[data-login]') as HTMLInputElement | null
  const dictionary = host.querySelector('[data-dictionary]') as HTMLTextAreaElement
  const hotkeyBtn = host.querySelector('[data-hotkey]') as HTMLButtonElement | null

  let hotkey: Hotkey = { ctrl: true, alt: true, shift: false, meta: false }
  let recordingHotkey = false
  let draftHotkey: Hotkey | null = null

  async function refresh(): Promise<void> {
    const settings = await getSettings()
    apply(settings)
    if (opts.desktop) {
      const permissions = await getPermissions()
      const mic = document.getElementById('mic-status')
      const access = document.getElementById('access-status')
      if (mic) mic.textContent = `Микрофон: запрашивается при записи`
      if (access) {
        access.textContent = `Универсальный доступ: ${permissions.accessibility ? 'есть' : 'нужен доступ'}`
      }
    }
  }

  function apply(settings: PublicSettings): void {
    hotkey = settings.hotkey
    if (hotkeyBtn) hotkeyBtn.textContent = formatHotkey(hotkey)
    language.value = settings.language
    cleanup.checked = settings.smartCleanup
    sounds.checked = settings.sounds
    if (login) login.checked = settings.launchAtLogin
    dictionary.value = settings.dictionary.join('\n')
    keyStatus.textContent = settings.hasApiKey
      ? 'Ключ сохранён в связке ключей. Повторно он не показывается.'
      : 'Ключ не сохранён.'
  }

  async function persist(): Promise<void> {
    const current = await getSettings()
    const next: AppSettings = {
      hotkey,
      pasteLastHotkey: current.pasteLastHotkey,
      language: language.value,
      smartCleanup: cleanup.checked,
      sounds: sounds.checked,
      launchAtLogin: login?.checked ?? false,
      dictionary: dictionary.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    }
    apply(await saveSettings(next))
  }

  host.querySelector('[data-save-key]')?.addEventListener('click', async () => {
    const value = apiKeyInput.value.trim()
    if (!value) return
    await setApiKey(value)
    apiKeyInput.value = ''
    await refresh()
  })
  host.querySelector('[data-clear-key]')?.addEventListener('click', async () => {
    await clearApiKey()
    apiKeyInput.value = ''
    await refresh()
  })
  host.querySelector('[data-save]')?.addEventListener('click', () => void persist())
  cleanup.addEventListener('change', () => void persist())
  sounds.addEventListener('change', () => void persist())
  login?.addEventListener('change', () => void persist())
  language.addEventListener('change', () => void persist())

  if (hotkeyBtn) {
    hotkeyBtn.addEventListener('click', () => {
      recordingHotkey = true
      draftHotkey = null
      hotkeyBtn.classList.add('listening')
      hotkeyBtn.textContent = 'зажмите клавиши…'
    })
    window.addEventListener('keydown', (event) => {
      if (!recordingHotkey) return
      event.preventDefault()
      if (event.code === 'Escape') {
        recordingHotkey = false
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
      const count =
        Number(draftHotkey.ctrl) +
        Number(draftHotkey.alt) +
        Number(draftHotkey.shift) +
        Number(draftHotkey.meta)
      if (!draftHotkey.code && count >= 2) {
        hotkey = draftHotkey
        recordingHotkey = false
        draftHotkey = null
        hotkeyBtn.classList.remove('listening')
        hotkeyBtn.textContent = formatHotkey(hotkey)
        void persist()
      }
    })
  }

  document.getElementById('access-btn')?.addEventListener('click', async () => {
    await openPrivacy('accessibility')
    await refresh()
  })

  void refresh()
}
