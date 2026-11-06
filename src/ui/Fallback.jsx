/** Ảnh tĩnh (SVG/CSS) cho thiết bị yếu / không WebGL */
export default function Fallback() {
  const stars = Array.from({ length: 90 }, (_, i) => ({
    x: (i * 137.5) % 100, y: (i * 61.8) % 100, r: 0.6 + ((i * 7) % 5) * 0.3, o: 0.3 + ((i * 13) % 7) / 10,
  }))
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(60% 50% at 30% 30%, rgba(139,0,255,0.25), transparent 70%),' +
          'radial-gradient(50% 45% at 75% 40%, rgba(30,144,255,0.2), transparent 70%),' +
          'linear-gradient(#02020a, #1a0b2e 95%)',
      }} />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill="#fff" opacity={s.o} />)}
        <defs>
          <radialGradient id="g" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#000" /><stop offset="62%" stopColor="#fff" />
            <stop offset="70%" stopColor="#ffb347" /><stop offset="85%" stopColor="#ff0044" stopOpacity=".6" />
            <stop offset="100%" stopColor="#8b00ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="38" rx="30" ry="9" fill="url(#g)" opacity=".9" />
        <circle cx="50" cy="38" r="6.2" fill="#000" />
        <circle cx="50" cy="38" r="9" fill="none" stroke="#bfe9ff" strokeWidth=".25" opacity=".9" />
      </svg>
      <div className="absolute inset-x-0 bottom-[12vh] px-6 text-center">
        <div className="logo-grad mb-4 font-orbit text-xl font-black tracking-[0.3em]">COSMOS ∞</div>
        <h1 className="hl-glow font-orbit text-2xl font-bold uppercase tracking-[0.16em] text-white md:text-5xl">Beyond the Event Horizon</h1>
        <p className="mt-4 font-grotesk text-xs uppercase tracking-[0.4em] text-white/50">Static mode · open on a desktop GPU for the full 3D experience</p>
      </div>
    </div>
  )
}
