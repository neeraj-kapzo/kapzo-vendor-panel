/**
 * New-order alert — Web Audio, no files. Two rounds of three hard-attack
 * chirps (high / low / high) on square waves: loud and sharp enough to cut
 * through a busy pharmacy counter. Best-effort; never throws.
 *
 * `startAlertLoop()` repeats the pattern until `stopAlertLoop()`, so the alarm
 * rings until the vendor accepts or rejects the order.
 */
const BURST = 0.11
const STEP = 0.16
const ROUND = STEP * 3 + 0.22
const LOOP_MS = 1800

let ctx: AudioContext | null = null
let loopTimer: ReturnType<typeof setInterval> | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx || ctx.state === 'closed') ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null // AudioContext unavailable
  }
}

function playPattern() {
  const c = getCtx()
  if (!c) return
  try {
    const master = c.createDynamicsCompressor()
    const out = c.createGain()
    out.gain.value = 0.9
    master.connect(out)
    out.connect(c.destination)

    const freqs = [2349, 1760, 2349]
    for (let round = 0; round < 2; round++) {
      freqs.forEach((freq, i) => {
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(master)
        const t = c.currentTime + round * ROUND + i * STEP
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.linearRampToValueAtTime(1, t + 0.003)
        gain.gain.setValueAtTime(1, t + BURST - 0.015)
        gain.gain.linearRampToValueAtTime(0.0001, t + BURST)
        osc.start(t)
        osc.stop(t + BURST + 0.01)
      })
    }
  } catch {
    // Autoplay policy blocked — silent fail
  }
}

/** One-shot alert. */
export function playAlertBeep() {
  playPattern()
}

/** Ring repeatedly until `stopAlertLoop()`. Safe to call while already ringing. */
export function startAlertLoop() {
  if (loopTimer) return
  playPattern()
  loopTimer = setInterval(playPattern, LOOP_MS)
}

export function stopAlertLoop() {
  if (loopTimer) clearInterval(loopTimer)
  loopTimer = null
}
