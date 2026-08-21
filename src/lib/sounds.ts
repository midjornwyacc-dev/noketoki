export function playCue(kind: 'start' | 'stop'): void {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = kind === 'start' ? 784 : 523
  gain.gain.value = 0.0001
  osc.connect(gain)
  gain.connect(ctx.destination)
  const now = ctx.currentTime
  const dur = kind === 'start' ? 0.09 : 0.07
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.start(now)
  osc.stop(now + dur + 0.02)
  osc.onended = () => void ctx.close()
}
