import { concatFloat32, floatToPcm16 } from '../../shared/wav'

const pill = document.getElementById('pill') as HTMLDivElement
const barsEl = document.getElementById('bars') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const timeEl = document.getElementById('time') as HTMLSpanElement
const cancelBtn = document.getElementById('cancel') as HTMLButtonElement

const BAR_COUNT = 16
const bars: HTMLSpanElement[] = []
for (let i = 0; i < BAR_COUNT; i++) {
  const span = document.createElement('span')
  barsEl.appendChild(span)
  bars.push(span)
}

let audioContext: AudioContext | null = null
let stream: MediaStream | null = null
let processor: ScriptProcessorNode | null = null
let chunks: Float32Array[] = []
let sampleRate = 16000
let startedAt = 0
let timer: number | null = null
let capturing = false

cancelBtn.addEventListener('click', () => window.noketoki.cancel())

window.noketoki.onPillState((state) => {
  if (state.phase === 'hidden') {
    pill.hidden = true
    pill.classList.remove('is-busy')
    return
  }
  pill.hidden = false
  pill.classList.toggle('is-busy', state.phase === 'transcribing')
  if (state.phase === 'recording') {
    statusEl.textContent = 'слушаю'
    startedAt = performance.now()
    tickClock()
  } else if (state.phase === 'transcribing') {
    statusEl.textContent = 'разбираю'
    stopClock()
  } else if (state.phase === 'error') {
    statusEl.textContent = state.error || 'ошибка'
    stopClock()
  }
})

window.noketoki.onStartCapture((opts) => {
  void startCapture(opts.sampleRate)
})

window.noketoki.onStopCapture((opts) => {
  void stopCapture(opts.discard)
})

async function startCapture(requestedRate: number): Promise<void> {
  await teardown(true)
  capturing = true
  chunks = []
  sampleRate = requestedRate
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: requestedRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    audioContext = new AudioContext({ sampleRate: requestedRate })
    sampleRate = audioContext.sampleRate
    const source = audioContext.createMediaStreamSource(stream)
    processor = audioContext.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      if (!capturing) return
      const input = event.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(input))
      paintBars(rms(input))
    }
    const mute = audioContext.createGain()
    mute.gain.value = 0
    source.connect(processor)
    processor.connect(mute)
    mute.connect(audioContext.destination)
  } catch {
    capturing = false
    window.noketoki.sendCaptureError('Нет доступа к микрофону. Откройте Настройки.')
  }
}

async function stopCapture(discard: boolean): Promise<void> {
  capturing = false
  const pcm = floatToPcm16(concatFloat32(chunks))
  const rate = sampleRate
  await teardown(false)
  resetBars()
  if (discard) return
  const copy = new ArrayBuffer(pcm.byteLength)
  new Uint8Array(copy).set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
  window.noketoki.sendClip({ pcm: copy, sampleRate: rate })
}

async function teardown(resetChunks: boolean): Promise<void> {
  capturing = false
  processor?.disconnect()
  processor = null
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (audioContext) {
    await audioContext.close().catch(() => undefined)
    audioContext = null
  }
  if (resetChunks) chunks = []
}

function rms(input: Float32Array): number {
  let sum = 0
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
  return Math.sqrt(sum / input.length)
}

function paintBars(level: number): void {
  const scaled = Math.min(1, level * 6)
  bars.forEach((bar, index) => {
    const wave = Math.abs(Math.sin(performance.now() / 180 + index * 0.45))
    const height = 6 + (scaled * 0.7 + wave * 0.3 * scaled) * 22
    bar.style.height = `${height}px`
    bar.style.opacity = String(0.35 + scaled * 0.65)
  })
}

function resetBars(): void {
  bars.forEach((bar) => {
    bar.style.height = '6px'
    bar.style.opacity = '0.5'
  })
}

function tickClock(): void {
  stopClock()
  const tick = (): void => {
    const ms = Math.max(0, performance.now() - startedAt)
    timeEl.textContent = formatTime(ms)
    timer = window.setTimeout(tick, 200)
  }
  tick()
}

function stopClock(): void {
  if (timer) window.clearTimeout(timer)
  timer = null
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
