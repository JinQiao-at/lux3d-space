/**
 * WebAudio 合成音效 —— 零外部音频资产，全部用振荡器 + 噪声即时生成。
 * 浏览器要求首次用户手势后才能播放，所以 ensureAudio() 在“开始探索”点击时调用。
 */
import type { SoundName } from './types.ts'

let context: AudioContext | null = null
let master: GainNode | null = null
let currentVolume = 0.7
let noiseBuffer: AudioBuffer | null = null

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function setMasterVolume(volume: number): void {
  currentVolume = clampVolume(volume)
  if (master && context) {
    master.gain.setTargetAtTime(currentVolume, context.currentTime, 0.05)
  }
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    try {
      const Ctor = window.AudioContext
      if (!Ctor) return null
      context = new Ctor()
      master = context.createGain()
      master.gain.value = currentVolume
      master.connect(context.destination)
      noiseBuffer = createNoiseBuffer(context)
    } catch {
      return null
    }
  }
  return context
}

/** 用户手势时调用：创建/resume AudioContext。 */
export function ensureAudio(): void {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

function envelopeGain(ctx: AudioContext, start: number, duration: number, peak: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(0.02, duration * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  return gain
}

function tone(
  ctx: AudioContext,
  options: { type: OscillatorType; from: number; to?: number; start: number; duration: number; gain: number },
): void {
  const oscillator = ctx.createOscillator()
  oscillator.type = options.type
  oscillator.frequency.setValueAtTime(options.from, options.start)
  if (options.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), options.start + options.duration)
  }
  const gain = envelopeGain(ctx, options.start, options.duration, options.gain)
  oscillator.connect(gain)
  gain.connect(master as GainNode)
  oscillator.start(options.start)
  oscillator.stop(options.start + options.duration + 0.02)
}

function noise(
  ctx: AudioContext,
  options: { start: number; duration: number; gain: number; frequency: number; type?: BiquadFilterType },
): void {
  if (!noiseBuffer) return
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = options.type ?? 'lowpass'
  filter.frequency.setValueAtTime(options.frequency, options.start)
  const gain = envelopeGain(ctx, options.start, options.duration, options.gain)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(master as GainNode)
  source.start(options.start)
  source.stop(options.start + options.duration + 0.02)
}

/** 播放一个合成音效。无 AudioContext（如服务端渲染/静音）时静默失败。 */
export function playSound(name: SoundName): void {
  const ctx = getContext()
  if (!ctx || ctx.state === 'suspended') return
  const t = ctx.currentTime + 0.01
  try {
    switch (name) {
      case 'pickup':
        tone(ctx, { type: 'sine', from: 660, to: 990, start: t, duration: 0.16, gain: 0.16 })
        tone(ctx, { type: 'sine', from: 990, to: 1320, start: t + 0.1, duration: 0.2, gain: 0.1 })
        break
      case 'lantern_on':
        tone(ctx, { type: 'sine', from: 220, start: t, duration: 0.8, gain: 0.12 })
        tone(ctx, { type: 'sine', from: 330, start: t + 0.05, duration: 0.7, gain: 0.08 })
        tone(ctx, { type: 'sine', from: 440, start: t + 0.1, duration: 0.6, gain: 0.06 })
        noise(ctx, { start: t, duration: 0.35, gain: 0.05, frequency: 1800, type: 'highpass' })
        break
      case 'lantern_off':
        tone(ctx, { type: 'sine', from: 330, to: 90, start: t, duration: 0.45, gain: 0.1 })
        break
      case 'stone':
        noise(ctx, { start: t, duration: 0.28, gain: 0.24, frequency: 420 })
        tone(ctx, { type: 'sine', from: 110, to: 60, start: t, duration: 0.3, gain: 0.1 })
        break
      case 'dial':
        tone(ctx, { type: 'square', from: 720, to: 520, start: t, duration: 0.07, gain: 0.05 })
        noise(ctx, { start: t, duration: 0.06, gain: 0.08, frequency: 2600, type: 'highpass' })
        break
      case 'dial_wrong':
        tone(ctx, { type: 'sawtooth', from: 110, to: 70, start: t, duration: 0.32, gain: 0.08 })
        tone(ctx, { type: 'sawtooth', from: 92, to: 55, start: t + 0.05, duration: 0.3, gain: 0.06 })
        noise(ctx, { start: t, duration: 0.2, gain: 0.05, frequency: 260 })
        break
      case 'unlock':
        noise(ctx, { start: t, duration: 0.9, gain: 0.2, frequency: 300 })
        tone(ctx, { type: 'sine', from: 70, to: 50, start: t, duration: 1.1, gain: 0.14 })
        tone(ctx, { type: 'sine', from: 150, to: 210, start: t + 0.5, duration: 0.5, gain: 0.06 })
        break
      case 'door':
        noise(ctx, { start: t, duration: 0.8, gain: 0.16, frequency: 220 })
        tone(ctx, { type: 'sawtooth', from: 90, to: 55, start: t, duration: 0.9, gain: 0.05 })
        break
      case 'ending': {
        const notes = [261.63, 329.63, 392.0, 523.25]
        notes.forEach((freq, index) => {
          tone(ctx, { type: 'sine', from: freq, start: t + index * 0.28, duration: 2.4, gain: 0.09 })
          tone(ctx, { type: 'sine', from: freq * 2, start: t + index * 0.28, duration: 1.8, gain: 0.03 })
        })
        break
      }
      case 'hint':
        tone(ctx, { type: 'sine', from: 1180, start: t, duration: 0.5, gain: 0.07 })
        tone(ctx, { type: 'sine', from: 1770, start: t + 0.06, duration: 0.5, gain: 0.04 })
        break
      case 'footstep':
        noise(ctx, { start: t, duration: 0.09, gain: 0.06, frequency: 320 })
        break
      case 'ui':
      default:
        tone(ctx, { type: 'sine', from: 880, start: t, duration: 0.06, gain: 0.04 })
        break
    }
  } catch {
    // 音频失败不影响玩法
  }
}
