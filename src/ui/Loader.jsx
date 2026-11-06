import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { rt, useStore } from '../store'

/**
 * LOADING SCREEN: progress dạng vòng tròn hố đen + % count.
 * Khi xong -> GSAP master timeline (entrance animation):
 *   0s fade in từ đen · 1s hố đen scale 0→1 (elastic) · 2s đĩa bắt đầu xoay
 *   3s starfield fade in · 4s UI overlay slide up (+ headline letter reveal)
 */
export default function Loader() {
  const root = useRef()
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(false)
  const sceneReady = useStore((s) => s.sceneReady)
  const setStarted = useStore((s) => s.setStarted)
  const prog = useRef({ v: 0 })
  const fontsReady = useRef(false)

  useEffect(() => {
    document.fonts?.ready.then(() => (fontsReady.current = true))
    if (!document.fonts) fontsReady.current = true
    // chạy tới 90% trong lúc scene dựng
    const tw = gsap.to(prog.current, {
      v: 90, duration: 2.6, ease: 'power1.out',
      onUpdate: () => setPct(Math.round(prog.current.v)),
    })
    return () => tw.kill()
  }, [])

  useEffect(() => {
    if (!sceneReady) return
    const finish = () => {
      if (!fontsReady.current) return setTimeout(finish, 100)
      gsap.to(prog.current, {
        v: 100, duration: 0.7, ease: 'power2.out',
        onUpdate: () => setPct(Math.round(prog.current.v)),
        onComplete: () => { setDone(true); playIntro(root.current, setStarted) },
      })
    }
    finish()
  }, [sceneReady, setStarted])

  const C = 2 * Math.PI * 70
  return (
    <div
      ref={root}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black"
      style={{ pointerEvents: done ? 'none' : 'auto' }}
    >
      <div className="relative h-60 w-60">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="50%" stopColor="#ff6b00" />
              <stop offset="100%" stopColor="#8b00ff" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="100" cy="100" r="70" fill="none" stroke="url(#acc)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} filter="url(#glow)"
          />
          {/* lõi hố đen */}
          <circle cx="100" cy="100" r="56" fill="#000" />
          <circle cx="100" cy="100" r="56" fill="none" stroke="rgba(160,220,255,0.35)" strokeWidth="1" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-orbit text-4xl font-bold tracking-widest text-white">
          {pct}<span className="ml-1 text-lg text-white/50">%</span>
        </div>
      </div>
      <p className="blink mt-8 font-grotesk text-sm uppercase tracking-[0.45em] text-white/70">Entering the void...</p>
    </div>
  )
}

function playIntro(loaderEl, setStarted) {
  setStarted(true)
  const fast = new URLSearchParams(window.location.search).has('fast')
  const tl = gsap.timeline({ timeScale: fast ? 8 : 1 })
  // 0s: fade in từ đen
  tl.to(loaderEl, { opacity: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => (loaderEl.style.display = 'none') }, 0)
  // 1s: hố đen scale 0 -> 1 với ease elastic
  tl.fromTo(rt.intro, { hole: 0 }, { hole: 1, duration: 2.4, ease: 'elastic.out(1, 0.55)' }, 1)
  // 2s: accretion disk bắt đầu xoay (& hiện dần)
  tl.fromTo(rt.intro, { disk: 0 }, { disk: 1, duration: 2.2, ease: 'power2.inOut' }, 2)
  // 3s: starfield fade in
  tl.fromTo(rt.intro, { stars: 0 }, { stars: 1, duration: 2.8, ease: 'power1.inOut' }, 3)
  // 4s: UI overlay slide up
  tl.fromTo('.ui-reveal', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.14, ease: 'power3.out' }, 4)
  // Hiệu ứng chữ tiêu đề hiện từng ký tự (letter-by-letter reveal) + glow pulse
  tl.to('.hl-letter', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, stagger: 0.05, ease: 'power3.out' }, 4.3)
  tl.add(() => document.querySelector('#headline')?.classList.add('hl-glow'), 6.2)
}
