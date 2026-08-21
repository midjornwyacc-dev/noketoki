import { describe, expect, it } from 'vitest'
import { encodeWav, floatToPcm16, pcmDurationMs } from '../src/shared/wav'

describe('wav', () => {
  it('encodes a RIFF WAVE header for 16-bit mono PCM', () => {
    const pcm = new Int16Array([0, 1, -1, 32767, -32768])
    const wav = encodeWav(pcm, 16000)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE')
    expect(String.fromCharCode(...wav.subarray(12, 16))).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(String.fromCharCode(...wav.subarray(36, 40))).toBe('data')
    expect(view.getUint32(40, true)).toBe(pcm.byteLength)
    expect(wav.byteLength).toBe(44 + pcm.byteLength)
  })

  it('converts float samples to signed 16-bit PCM with clipping', () => {
    const pcm = floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))
    expect(pcm[0]).toBe(0)
    expect(pcm[1]).toBe(32767)
    expect(pcm[2]).toBe(-32768)
    expect(pcm[3]).toBe(32767)
    expect(pcm[4]).toBe(-32768)
    expect(pcm[5]).toBe(16384)
  })

  it('reports clip duration in milliseconds', () => {
    expect(pcmDurationMs(new Int16Array(16000), 16000)).toBe(1000)
    expect(pcmDurationMs(new Int16Array(16), 16000)).toBe(1)
    expect(pcmDurationMs(new Int16Array(0), 16000)).toBe(0)
  })
})
