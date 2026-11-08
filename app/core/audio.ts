import { G, state } from './state'
import { bell, smooth } from './timeline'

// Ambient soundscape, synthesised with Web Audio: zero audio files to download or license.
// One loop per scene (wind, night hum, birds + breeze, water + frogs, fire + crickets),
// crossfaded by scroll progress. Off by default.

type Channel = 'wind' | 'night' | 'meadow' | 'pond' | 'fire'

function weights(p: number): Record<Channel, number> {
  return {
    wind: 1 - smooth(p, 0.22, 0.3),
    night: Math.max(bell(p, 0.24, 0.3, 0.4, 0.46), smooth(p, 0.9, 0.98) * 0.5),
    meadow: bell(p, 0.43, 0.48, 0.62, 0.68),
    pond: bell(p, 0.63, 0.68, 0.8, 0.86),
    fire: smooth(p, 0.82, 0.86),
  }
}

class Soundscape {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private ch = {} as Record<Channel, GainNode>
  private w = weights(0)
  private enabled = false
  private tick: ReturnType<typeof setInterval> | null = null
  private white!: AudioBuffer
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode
  private next = { bird: 0, drip: 0, frog: 0, crackle: 0, cricket: 0 }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on && !this.ctx) this.init()
    const ctx = this.ctx
    if (!ctx) return
    if (on) {
      void ctx.resume()
      this.tick ??= setInterval(() => this.schedule(), 90)
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, on ? 0.6 : 0.25)
    if (!on) {
      if (this.tick) clearInterval(this.tick)
      this.tick = null
      setTimeout(() => !this.enabled && void ctx.suspend(), 1500)
    }
  }

  private init() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = (this.ctx = new Ctx())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    this.master.connect(comp).connect(ctx.destination)
    for (const name of ['wind', 'night', 'meadow', 'pond', 'fire'] as Channel[]) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.master)
      this.ch[name] = g
    }
    this.white = this.noise('white', 3)
    const pink = this.noise('pink', 4)
    const brown = this.noise('brown', 4)

    // wind: pink noise through a wandering band-pass; gusts with scroll speed
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 520
    this.windFilter.Q.value = 0.8
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.5
    this.loop(pink).connect(this.windFilter).connect(this.windGain).connect(this.ch.wind)
    this.lfo(0.07, 260, this.windFilter.frequency)

    // night: a low, quiet two-note hum with a faint shimmer
    for (const [f, a] of [[98, 0.05], [146.8, 0.035], [1760, 0.004]] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = a
      o.connect(g).connect(this.ch.night)
      o.start()
      this.lfo(0.09 + f * 0.0002, a * 0.5, g.gain)
    }

    // meadow breeze
    const breeze = ctx.createBiquadFilter()
    breeze.type = 'lowpass'
    breeze.frequency.value = 900
    const bg = ctx.createGain()
    bg.gain.value = 0.22
    this.loop(pink).connect(breeze).connect(bg).connect(this.ch.meadow)

    // pond water: soft brown noise
    const water = ctx.createBiquadFilter()
    water.type = 'lowpass'
    water.frequency.value = 420
    const wg = ctx.createGain()
    wg.gain.value = 0.35
    this.loop(brown).connect(water).connect(wg).connect(this.ch.pond)
    this.lfo(0.13, 0.12, wg.gain)

    // fire: low rumble (crackles and crickets are scheduled)
    const rumble = ctx.createBiquadFilter()
    rumble.type = 'lowpass'
    rumble.frequency.value = 190
    const rg = ctx.createGain()
    rg.gain.value = 0.5
    this.loop(brown).connect(rumble).connect(rg).connect(this.ch.fire)
  }

  private noise(kind: 'white' | 'pink' | 'brown', seconds: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') d[i] = w
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046
        b1 = 0.963 * b1 + w * 0.2965164
        b2 = 0.57 * b2 + w * 1.0526913
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18
      } else {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    return buf
  }

  private loop(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.start(0, Math.random() * buf.duration)
    return s
  }

  private lfo(freq: number, depth: number, param: AudioParam) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = depth
    o.connect(g).connect(param)
    o.start()
  }

  /** Per frame: crossfade the loops with progress. */
  update() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    this.w = weights(state.p)
    const now = ctx.currentTime
    for (const name of Object.keys(this.ch) as Channel[]) this.ch[name].gain.setTargetAtTime(this.w[name], now, 0.3)
    const gust = G.uGust.value
    this.windGain.gain.setTargetAtTime(0.45 + gust * 0.9, now, 0.2)
    this.windFilter.Q.setTargetAtTime(0.8 + gust * 0.6, now, 0.3)
  }

  /** Lookahead scheduler for the one-shot sounds. */
  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const now = ctx.currentTime
    const ahead = now + 0.25
    const n = this.next
    if (this.w.meadow > 0.02 && n.bird < ahead) {
      const calls = 2 + Math.floor(Math.random() * 4)
      const base = 2600 + Math.random() * 1400
      for (let i = 0; i < calls; i++) this.chirp(Math.max(n.bird, now) + i * 0.13, base * (1 + (Math.random() - 0.5) * 0.2))
      n.bird = Math.max(n.bird, now) + 1.4 + Math.random() * 3.2
    }
    if (this.w.pond > 0.02) {
      if (n.drip < ahead) {
        this.drip(Math.max(n.drip, now))
        n.drip = Math.max(n.drip, now) + 0.35 + Math.random() * 1.2
      }
      if (n.frog < ahead) {
        this.croak(Math.max(n.frog, now))
        if (Math.random() < 0.4) this.croak(Math.max(n.frog, now) + 0.45)
        n.frog = Math.max(n.frog, now) + 2 + Math.random() * 4
      }
    }
    if (this.w.fire > 0.02) {
      while (n.crackle < ahead) {
        n.crackle = Math.max(n.crackle, now) + Math.random() * 0.16
        this.crackle(n.crackle)
      }
      if (n.cricket < ahead) {
        this.cricket(Math.max(n.cricket, now), 4400)
        this.cricket(Math.max(n.cricket, now) + 0.31, 4750)
        n.cricket = Math.max(n.cricket, now) + 0.7 + Math.random() * 0.3
      }
    }
  }

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    return g
  }

  private chirp(t: number, f: number) {
    const o = this.ctx!.createOscillator()
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.05)
    o.frequency.exponentialRampToValueAtTime(f * 1.1, t + 0.1)
    const g = this.env(t, 0.05, 0.01, 0.1)
    o.connect(g).connect(this.ch.meadow)
    o.start(t)
    o.stop(t + 0.14)
  }

  private drip(t: number) {
    const o = this.ctx!.createOscillator()
    const f = 500 + Math.random() * 500
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06)
    const g = this.env(t, 0.04, 0.004, 0.07)
    o.connect(g).connect(this.ch.pond)
    o.start(t)
    o.stop(t + 0.1)
  }

  private croak(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(115 + Math.random() * 30, t)
    o.frequency.linearRampToValueAtTime(95, t + 0.3)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 4
    const am = ctx.createOscillator()
    am.type = 'square'
    am.frequency.value = 26
    const amg = ctx.createGain()
    amg.gain.value = 0.5
    const g = this.env(t, 0.12, 0.02, 0.3)
    const mod = ctx.createGain()
    mod.gain.value = 0.5
    am.connect(amg).connect(mod.gain)
    o.connect(bp).connect(mod).connect(g).connect(this.ch.pond)
    o.start(t)
    am.start(t)
    o.stop(t + 0.36)
    am.stop(t + 0.36)
  }

  private crackle(t: number) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.white
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1200 + Math.random() * 2500
    const g = this.env(t, 0.05 + Math.random() * 0.25, 0.001, 0.008 + Math.random() * 0.03)
    s.connect(hp).connect(g).connect(this.ch.fire)
    s.start(t, Math.random() * 2.5, 0.06)
  }

  private cricket(t: number, f: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.045
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.018, s + 0.008)
      g.gain.linearRampToValueAtTime(0, s + 0.028)
    }
    o.connect(g).connect(this.ch.fire)
    o.start(t)
    o.stop(t + 0.16)
  }
}

export const soundscape = new Soundscape()
