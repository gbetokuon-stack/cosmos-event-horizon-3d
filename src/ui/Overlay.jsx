import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { rt, useStore } from '../store'
import { setSound } from '../utils/audio'

gsap.registerPlugin(ScrollTrigger)

const HEADLINE = 'BEYOND THE EVENT HORIZON'
const CAPTIONS = [
  { a: 0.14, b: 0.4, t: 'Time bends around mass.' },
  { a: 0.4, b: 0.66, t: 'Light itself cannot escape.' },
  { a: 0.66, b: 0.9, t: 'Everything ends. Everything begins.' },
]
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** UI Overlay glassmorphism - tối giản, KHÔNG che hố đen (hố đen ở nửa trên/giữa màn hình) */
export default function Overlay() {
  const soundOn = useStore((s) => s.soundOn)
  const setSoundOn = useStore((s) => s.setSoundOn)
  const headRef = useRef()
  const hintRef = useRef()
  const capRefs = useRef([])
  const fadeRef = useRef()
  const distRef = useRef()
  const hudRef = useRef()

  // ScrollTrigger -> rt.scroll (0..1)
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: '#scroll-space',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => (rt.scroll = self.progress),
    })
    return () => st.kill()
  }, [])

  // Cập nhật UI theo scroll mỗi frame (ghi thẳng DOM, không re-render React)
  useEffect(() => {
    let raf
    const loop = () => {
      const s = rt.sm
      if (headRef.current) {
        const o = 1 - smooth(0.0, 0.1, s)
        headRef.current.style.opacity = o
        headRef.current.style.transform = `translateY(${(1 - o) * 30}px)`
      }
      if (hintRef.current) hintRef.current.style.opacity = 1 - smooth(0, 0.06, s)
      CAPTIONS.forEach((c, i) => {
        const el = capRefs.current[i]
        if (!el) return
        const o = smooth(c.a, c.a + 0.05, s) * (1 - smooth(c.b - 0.05, c.b, s))
        el.style.opacity = o
        el.style.transform = `translateY(${(1 - o) * 24}px)`
      })
      if (fadeRef.current) fadeRef.current.style.opacity = smooth(0.9, 0.995, s)
      if (distRef.current) {
        const d = Math.round(26000 * (1 - rt.e))
        distRef.current.textContent = d <= 0 ? 'EVENT HORIZON' : `${d.toLocaleString('en-US')} LY`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggleSound = () => {
    const v = !soundOn
    setSoundOn(v)
    setSound(v)
  }

  const explore = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const o = { y: window.scrollY }
    gsap.to(o, {
      y: max * 0.62, duration: 7, ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, o.y),
    })
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-30 select-none">
        {/* Top-left: logo */}
        <header className="ui-reveal absolute left-6 top-6 md:left-10 md:top-8">
          <div className="logo-grad font-orbit text-xl font-black tracking-[0.3em] md:text-2xl">COSMOS ∞</div>
        </header>

        {/* Top-right: telemetry + âm thanh */}
        <div ref={hudRef} className="ui-reveal pointer-events-auto absolute right-6 top-6 flex items-center gap-3 md:right-10 md:top-8">
          <div className="glass hidden rounded-full px-4 py-2 font-grotesk text-xs tracking-[0.25em] text-white/70 sm:block">
            <span className="text-white/40">DIST </span><span ref={distRef}>26,000 LY</span>
          </div>
          <button
            onClick={toggleSound}
            className="glass rounded-full px-4 py-2 font-grotesk text-xs tracking-[0.25em] text-white/80 transition hover:bg-white/10"
          >
            SOUND {soundOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Center-bottom: headline + captions */}
        <div className="absolute inset-x-0 bottom-[6.5vh] flex flex-col items-center px-6 text-center">
          <div ref={headRef}>
            <h1
              id="headline"
              className="font-orbit text-2xl font-bold uppercase tracking-[0.2em] text-white sm:text-3xl md:text-5xl"
            >
              {HEADLINE.split(' ').map((w, wi) => (
                <span key={wi} className="mr-[0.35em] inline-block whitespace-nowrap">
                  {w.split('').map((ch, ci) => (
                    <span key={ci} className="hl-letter inline-block opacity-0" style={{ transform: 'translateY(24px)', filter: 'blur(10px)' }}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="ui-reveal mt-3.5 font-grotesk text-xs font-light uppercase tracking-[0.5em] text-white/55">
              Stand beneath the infinite
            </p>
          </div>
          {CAPTIONS.map((c, i) => (
            <p
              key={i}
              ref={(el) => (capRefs.current[i] = el)}
              className="absolute bottom-0 font-orbit text-xl font-medium tracking-[0.18em] text-white/90 opacity-0 md:text-3xl"
              style={{ textShadow: '0 0 30px rgba(120,190,255,0.5)' }}
            >
              {c.t}
            </p>
          ))}
        </div>

        {/* Bottom-left: scroll indicator */}
        <div ref={hintRef} className="ui-reveal absolute bottom-8 left-6 flex items-center gap-3 md:bottom-10 md:left-10">
          <div className="relative h-10 w-6 rounded-full border border-white/40">
            <span className="scroll-dot absolute left-1/2 top-2 h-1.5 w-1 -translate-x-1/2 rounded-full bg-white" />
          </div>
          <span className="blink font-grotesk text-xs uppercase tracking-[0.35em] text-white/60">Scroll</span>
        </div>

        {/* Bottom-right: EXPLORE */}
        <div className="ui-reveal pointer-events-auto absolute bottom-6 right-6 md:bottom-9 md:right-10">
          <button onClick={explore} className="explore-btn flex items-center justify-center font-orbit text-xs font-bold tracking-[0.25em] text-white">
            EXPLORE
          </button>
        </div>
      </div>

      {/* Fade to black khi event horizon bao trùm */}
      <div ref={fadeRef} className="pointer-events-none fixed inset-0 z-40 bg-black opacity-0" />
    </>
  )
}
