/**
 * HỆ THỐNG ÂM THANH VŨ TRỤ & DRAGON MAID SPATIAL SFX (Web Audio API)
 * - Vũ trụ nền: Sub-bass 38Hz + Drone saw lệch tần + Gió vũ trụ + Reverb xung 5 giây
 * - Dragon Maid SFX (khi bật audio):
 *    1. Tiếng "whoosh" gió xé Doppler pan trái/phải theo quỹ đạo bay
 *    2. Tiếng gầm rồng trầm xa xăm (sub-bass vocal growl rumble)
 *    3. Tiếng vỗ cánh da nặng nề (leathery wing flap) khi lướt gần camera
 */
let ctx = null
let master = null
let reverbNode = null
let noiseBuf = null
let drone = null
let running = false

function makeImpulse(ac, seconds = 5, decay = 3) {
  const len = ac.sampleRate * seconds
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.0001
  master.connect(ctx.destination)

  reverbNode = ctx.createConvolver()
  reverbNode.buffer = makeImpulse(ctx)
  const wet = ctx.createGain()
  wet.gain.value = 0.55
  reverbNode.connect(wet)
  wet.connect(master)

  const bus = ctx.createGain()
  bus.gain.value = 1
  bus.connect(master)
  bus.connect(reverbNode)

  // Sub bass 38Hz
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = 38
  const subG = ctx.createGain()
  subG.value = 0.5
  subG.gain.value = 0.5
  const subLfo = ctx.createOscillator()
  subLfo.frequency.value = 0.07
  const subLfoG = ctx.createGain()
  subLfoG.gain.value = 0.18
  subLfo.connect(subLfoG)
  subLfoG.connect(subG.gain)
  sub.connect(subG)
  subG.connect(bus)
  sub.start()
  subLfo.start()

  // Space Drone
  drone = ctx.createBiquadFilter()
  drone.type = 'lowpass'
  drone.frequency.value = 200
  drone.Q.value = 4
  const droneG = ctx.createGain()
  droneG.gain.value = 0.16
  ;[55, 55.35, 82.4, 110.2].forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = i % 2 ? 'sawtooth' : 'triangle'
    o.frequency.value = f
    o.connect(drone)
    o.start()
  })
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.05
  const lfoG = ctx.createGain()
  lfoG.gain.value = 120
  lfo.connect(lfoG)
  lfoG.connect(drone.frequency)
  lfo.start()
  drone.connect(droneG)
  droneG.connect(bus)

  // Buffer nhiễu trắng dùng chung cho gió vũ trụ & hiệu ứng gió xé Dragon Maid
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  noise.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 420
  bp.Q.value = 0.8
  const bpLfo = ctx.createOscillator()
  bpLfo.frequency.value = 0.04
  const bpLfoG = ctx.createGain()
  bpLfoG.gain.value = 260
  bpLfo.connect(bpLfoG)
  bpLfoG.connect(bp.frequency)
  bpLfo.start()
  const ng = ctx.createGain()
  ng.gain.value = 0.035
  noise.connect(bp)
  bp.connect(ng)
  ng.connect(bus)
  noise.start()
}

export function setSound(on) {
  if (on && !ctx) build()
  if (!ctx) return
  if (on) ctx.resume()
  running = on
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
  master.gain.exponentialRampToValueAtTime(on ? 0.8 : 0.0001, t + (on ? 2.5 : 0.8))
}

/** Âm thanh sáng/tối hơn khi tiến gần hố đen (p: 0..1) */
export function setIntensity(p) {
  if (!ctx || !running || !drone) return
  drone.frequency.setTargetAtTime(200 + p * 700, ctx.currentTime, 0.4)
}

/** Tiếng "thump" sóng hấp dẫn khi click */
export function gravityPulse() {
  if (!ctx || !running) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(28, t + 1.8)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
  o.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + 2.3)
}

/**
 * 1. Tiếng "Whoosh" gió xé không khí khi Dragon Maid vụt qua (kèm pan Stereo trái <-> phải & Doppler)
 */
export function playDragonWhoosh(panStart = -0.8, panEnd = 0.8, closeness = 0.8, supersonic = false) {
  if (!ctx || !running || !noiseBuf) return
  const t = ctx.currentTime
  const dur = supersonic ? 0.95 : 1.25

  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = supersonic ? 2.2 : 1.4
  filter.frequency.setValueAtTime(320, t)
  filter.frequency.exponentialRampToValueAtTime(supersonic ? 2600 : 1450, t + dur * 0.36)
  filter.frequency.exponentialRampToValueAtTime(140, t + dur)

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panStart)), t)
    panner.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, panEnd)), t + dur)
  }

  const gain = ctx.createGain()
  const peak = Math.min(0.65, 0.12 + closeness * 0.5)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  src.connect(filter)
  filter.connect(gain)
  if (panner) {
    gain.connect(panner)
    panner.connect(master)
    if (reverbNode) panner.connect(reverbNode)
  } else {
    gain.connect(master)
  }

  // Nổ xung siêu thanh (Sonic Boom thump) nếu vượt rào cản âm thanh ở gần
  if (supersonic && closeness > 0.35) {
    const boom = ctx.createOscillator()
    const bg = ctx.createGain()
    boom.type = 'triangle'
    boom.frequency.setValueAtTime(125, t + dur * 0.3)
    boom.frequency.exponentialRampToValueAtTime(26, t + dur * 0.85)
    bg.gain.setValueAtTime(0.0001, t + dur * 0.28)
    bg.gain.exponentialRampToValueAtTime(peak * 0.75, t + dur * 0.33)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9)
    boom.connect(bg)
    if (panner) bg.connect(panner)
    else bg.connect(master)
    boom.start(t + dur * 0.28)
    boom.stop(t + dur * 0.95)
  }

  src.start(t)
  src.stop(t + dur + 0.05)
}

/**
 * 2. Tiếng vỗ cánh da nặng nề (Leathery Wing Flap) khi Dragon Maid đập cánh ở gần camera
 */
export function playWingFlap(pan = 0, closeness = 0.6) {
  if (!ctx || !running || !noiseBuf || closeness < 0.15) return
  const t = ctx.currentTime
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t)

  // Xung khí trầm từ màng cánh rộng
  const thump = ctx.createOscillator()
  const tg = ctx.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(68, t)
  thump.frequency.exponentialRampToValueAtTime(29, t + 0.24)
  tg.gain.setValueAtTime(0.0001, t)
  tg.gain.exponentialRampToValueAtTime(0.32 * closeness, t + 0.03)
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
  thump.connect(tg)

  // Tiếng da căng phần phật (leathery snap)
  const leather = ctx.createBufferSource()
  leather.buffer = noiseBuf
  const lp = ctx.createBiquadFilter()
  lp.type = 'bandpass'
  lp.frequency.setValueAtTime(340, t)
  lp.Q.value = 1.8
  const lg = ctx.createGain()
  lg.gain.setValueAtTime(0.0001, t)
  lg.gain.exponentialRampToValueAtTime(0.22 * closeness, t + 0.04)
  lg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  leather.connect(lp)
  lp.connect(lg)

  if (panner) {
    tg.connect(panner)
    lg.connect(panner)
    panner.connect(master)
  } else {
    tg.connect(master)
    lg.connect(master)
  }

  thump.start(t)
  thump.stop(t + 0.28)
  leather.start(t)
  leather.stop(t + 0.25)
}

/**
 * 3. Tiếng gầm rồng trầm xa xăm (Sub-bass Dragon Rumble) vọng qua không gian
 */
export function playDragonRumble(pan = 0, intensity = 0.5) {
  if (!ctx || !running) return
  const t = ctx.currentTime
  const dur = 2.4

  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  osc1.type = 'sawtooth'
  osc2.type = 'triangle'
  osc1.frequency.setValueAtTime(52, t)
  osc1.frequency.exponentialRampToValueAtTime(34, t + dur)
  osc2.frequency.setValueAtTime(78, t)
  osc2.frequency.exponentialRampToValueAtTime(49, t + dur)

  // Rung thanh quản rồng trầm (growl flutter 18Hz)
  const growlLfo = ctx.createOscillator()
  const growlGain = ctx.createGain()
  growlLfo.frequency.value = 18
  growlGain.gain.value = 38

  const formant = ctx.createBiquadFilter()
  formant.type = 'lowpass'
  formant.frequency.setValueAtTime(145, t)
  formant.Q.value = 5.5
  growlLfo.connect(growlGain)
  growlGain.connect(formant.frequency)

  const gain = ctx.createGain()
  const peak = 0.22 * Math.max(0.25, Math.min(1, intensity))
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.45)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan * 0.7)), t)

  osc1.connect(formant)
  osc2.connect(formant)
  formant.connect(gain)

  if (panner) {
    gain.connect(panner)
    panner.connect(master)
    if (reverbNode) panner.connect(reverbNode)
  } else {
    gain.connect(master)
    if (reverbNode) gain.connect(reverbNode)
  }

  growlLfo.start(t)
  osc1.start(t)
  osc2.start(t)
  growlLfo.stop(t + dur + 0.05)
  osc1.stop(t + dur + 0.05)
  osc2.stop(t + dur + 0.05)
}
