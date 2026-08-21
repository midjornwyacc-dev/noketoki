import { concatFloat32, floatToPcm16 } from '../shared/wav'

export type LevelHandler = (level: number) => void

export class MicCapture {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private capturing = false
  sampleRate = 16000

  async start(sampleRate: number, onLevel: LevelHandler): Promise<void> {
    await this.teardown(true)
    this.capturing = true
    this.chunks = []
    this.sampleRate = sampleRate
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    this.context = new AudioContext({ sampleRate })
    this.sampleRate = this.context.sampleRate
    const source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      if (!this.capturing) return
      const input = event.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(input))
      let sum = 0
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
      onLevel(Math.sqrt(sum / input.length))
    }
    const mute = this.context.createGain()
    mute.gain.value = 0
    source.connect(this.processor)
    this.processor.connect(mute)
    mute.connect(this.context.destination)
  }

  async stop(): Promise<{ pcm: Int16Array; sampleRate: number }> {
    this.capturing = false
    const pcm = floatToPcm16(concatFloat32(this.chunks))
    const rate = this.sampleRate
    await this.teardown(true)
    return { pcm, sampleRate: rate }
  }

  async cancel(): Promise<void> {
    this.capturing = false
    await this.teardown(true)
  }

  private async teardown(reset: boolean): Promise<void> {
    this.processor?.disconnect()
    this.processor = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.context) {
      await this.context.close().catch(() => undefined)
      this.context = null
    }
    if (reset) this.chunks = []
  }
}
