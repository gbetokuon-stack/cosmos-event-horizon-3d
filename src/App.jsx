import { useMemo } from 'react'
import Experience from './components/Experience'
import Overlay from './ui/Overlay'
import Loader from './ui/Loader'
import Fallback from './ui/Fallback'
import { getQuality } from './utils/quality'

export default function App() {
  const q = useMemo(getQuality, [])

  // Thiết bị yếu / không WebGL -> ảnh tĩnh
  if (q.tier === 0) return <Fallback />

  return (
    <>
      <Experience q={q} />
      <Overlay />
      <Loader />
      {/* Không gian cuộn: 700vh điều khiển hành trình lao vào hố đen */}
      <div id="scroll-space" style={{ height: '700vh' }} />
    </>
  )
}
