const RIFF = 0x52494646
const WAVE = 0x57415645
const FMT = 0x666d7420
const DATA = 0x64617461

export function floatToPcm16(input: Float32Array | number[]): Int16Array {
  const pcm = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0))
    pcm[i] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767)
  }
  return pcm
}

export function encodeWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataSize = pcm.byteLength
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  writeFourCC(view, 0, RIFF)
  view.setUint32(4, 36 + dataSize, true)
  writeFourCC(view, 8, WAVE)
  writeFourCC(view, 12, FMT)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeFourCC(view, 36, DATA)
  view.setUint32(40, dataSize, true)
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 44)
  return bytes
}

export function pcmDurationMs(pcm: Int16Array, sampleRate: number): number {
  if (sampleRate <= 0 || pcm.length === 0) return 0
  return Math.round((pcm.length / sampleRate) * 1000)
}

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function writeFourCC(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false)
}

export function encodeToneWav(opts: {
  frequency: number
  durationMs: number
  sampleRate?: number
  gain?: number
}): Uint8Array {
  const sampleRate = opts.sampleRate ?? 22050
  const gain = opts.gain ?? 0.18
  const n = Math.max(1, Math.round((opts.durationMs / 1000) * sampleRate))
  const samples = new Float32Array(n)
  const fade = Math.min(400, Math.floor(n / 6))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let amp = gain * Math.sin(2 * Math.PI * opts.frequency * t)
    if (i < fade) amp *= i / fade
    if (i > n - fade) amp *= (n - i) / fade
    samples[i] = amp
  }
  return encodeWav(floatToPcm16(samples), sampleRate)
}
