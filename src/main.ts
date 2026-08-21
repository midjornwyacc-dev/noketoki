import { bindMacosSession, bindPillView } from './lib/macos-loop'
import { DictationSession } from './lib/dictation'
import { fillBars, paintBars, resetBars } from './views/bars'
import { mountSettingsForm } from './views/settings-form'
import { platform as getPlatform } from './lib/api'

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search)
  let view = params.get('view')
  if (!view) {
    const plat = await getPlatform()
    view = plat === 'ios' ? 'ios' : 'settings'
  }

  document.getElementById(`view-${view}`)?.removeAttribute('hidden')

  if (view === 'pill') {
    document.body.classList.add('pill-body')
    bindPillView()
    return
  }
  if (view === 'ios') {
    mountIos()
    return
  }
  mountDesktopSettings()
}

function mountDesktopSettings(): void {
  const host = document.querySelector('#view-settings [data-settings-form]')
  if (host instanceof HTMLElement) mountSettingsForm(host, { desktop: true })
  bindMacosSession()
}

function mountIos(): void {
  const host = document.querySelector('#ios-settings [data-settings-form]')
  if (host instanceof HTMLElement) mountSettingsForm(host, { desktop: false })
  const toggle = document.getElementById('ios-settings-toggle')
  const panel = document.getElementById('ios-settings')
  toggle?.addEventListener('click', () => {
    if (!panel) return
    panel.hidden = !panel.hidden
  })

  const status = document.getElementById('ios-status') as HTMLElement
  const result = document.getElementById('ios-result') as HTMLTextAreaElement
  const ptt = document.getElementById('ios-ptt') as HTMLButtonElement
  const bars = fillBars(document.getElementById('ios-bars') as HTMLElement)

  const session = new DictationSession('ios', {
    onState(state) {
      if (state.phase === 'recording') status.textContent = 'слушаю'
      else if (state.phase === 'transcribing') status.textContent = 'разбираю'
      else if (state.error) status.textContent = state.error
      else status.textContent = 'готово'
      if (state.phase !== 'recording') resetBars(bars)
    },
    onLevel: (level) => paintBars(bars, level),
    onResult: (text) => {
      result.value = text
    }
  })

  const down = (event: Event): void => {
    event.preventDefault()
    ptt.classList.add('is-down')
    void session.beginHold()
  }
  const up = (event: Event): void => {
    event.preventDefault()
    ptt.classList.remove('is-down')
    void session.finishHold('ptt-up')
  }
  ptt.addEventListener('pointerdown', down)
  ptt.addEventListener('pointerup', up)
  ptt.addEventListener('pointercancel', up)
  ptt.addEventListener('pointerleave', (event) => {
    if (ptt.classList.contains('is-down')) up(event)
  })

  document.getElementById('ios-copy')?.addEventListener('click', async () => {
    if (!result.value.trim()) return
    await navigator.clipboard.writeText(result.value)
    status.textContent = 'скопировано'
  })
  document.getElementById('ios-share')?.addEventListener('click', async () => {
    if (!result.value.trim()) return
    if (navigator.share) {
      await navigator.share({ text: result.value }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(result.value)
      status.textContent = 'скопировано'
    }
  })
}

void boot()
