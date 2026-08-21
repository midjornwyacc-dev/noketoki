export function fillBars(host: HTMLElement, count = 16): HTMLSpanElement[] {
  host.replaceChildren()
  const bars: HTMLSpanElement[] = []
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span')
    host.appendChild(span)
    bars.push(span)
  }
  return bars
}

export function paintBars(bars: HTMLSpanElement[], level: number): void {
  const scaled = Math.min(1, level * 6)
  bars.forEach((bar, index) => {
    const wave = Math.abs(Math.sin(performance.now() / 180 + index * 0.45))
    const height = 6 + (scaled * 0.7 + wave * 0.3 * scaled) * 22
    bar.style.height = `${height}px`
    bar.style.opacity = String(0.35 + scaled * 0.65)
  })
}

export function resetBars(bars: HTMLSpanElement[]): void {
  bars.forEach((bar) => {
    bar.style.height = '6px'
    bar.style.opacity = '0.5'
  })
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
