import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { rt, useStore } from '../store'
import { QualityContext } from '../utils/QualityContext'
import { Clock, CameraRig } from './CameraRig'
import BlackHole from './BlackHole'
import DragonMaids from './DragonMaids'
import { Stars, MilkyWay, DistantGalaxies, ShootingStars } from './StarField'
import Nebula, { SkyDome, DustField } from './Nebula'
import { Ground, GroundFog, Foreground } from './Ground'
import PostFX from './PostFX'
import { gravityPulse } from '../utils/audio'

/** Hạ DPR tự động khi FPS tụt, tăng lại khi ổn định */
function Perf({ max }) {
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  return (
    <PerformanceMonitor
      onDecline={() => setDpr(Math.max(1, gl.getPixelRatio() - 0.25))}
      onIncline={() => setDpr(Math.min(max, gl.getPixelRatio() + 0.25))}
    />
  )
}

/** Báo cho Loader biết scene đã sẵn sàng sau vài frame đầu */
function ReadySignal() {
  const set = useStore((s) => s.setSceneReady)
  useEffect(() => {
    const id = setTimeout(() => set(true), 600)
    return () => clearTimeout(id)
  }, [set])
  return null
}

const _syncPos = new THREE.Vector3()

/** Kết nối component DragonMaids độc lập với Camera Shake (200ms) & Hắt sáng Nebula của COSMOS ∞ */
function DragonMaidsBridge() {
  const sound = useStore((s) => s.sound)

  return (
    <DragonMaids
      count={10}
      spawnInterval={[3000, 8000]}
      speedRange={[200, 500]}
      enableAudio={sound}
      audioSrc="/sounds/whoosh.mp3"
      onWhoosh={(side) => {
        // Rung camera 0.3° - 0.5° trong 200ms tuỳ theo hướng vụt sát ('left' | 'right' | 'front')
        rt.shake.amp = side === 'front' ? 0.5 : 0.38
        rt.shake.dir = side === 'left' ? -1 : 1
        rt.shake.until = performance.now() + 200
      }}
      onActivePositionsChange={(slots) => {
        for (let k = 0; k < 4; k++) rt.dragonGlowPos[k][3] = 0
        let gIdx = 0
        for (let i = 0; i < slots.length && gIdx < 4; i++) {
          const s = slots[i]
          if (!s.active) continue
          s.curve.getPoint(s.progress, _syncPos)
          rt.dragonGlowPos[gIdx][0] = _syncPos.x
          rt.dragonGlowPos[gIdx][1] = _syncPos.y
          rt.dragonGlowPos[gIdx][2] = _syncPos.z
          rt.dragonGlowPos[gIdx][3] = 1.0
          // Hắt ánh sáng cyan (#00d4ff) lên các đám mây tinh vân xung quanh trong bán kính 50 units
          rt.dragonGlowCol[gIdx][0] = 0.0
          rt.dragonGlowCol[gIdx][1] = 0.83
          rt.dragonGlowCol[gIdx][2] = 1.0
          gIdx++
        }
      }}
    />
  )
}

export default function Experience({ q }) {
  useEffect(() => {
    const move = (e) => {
      rt.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      rt.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    // Click: phát sóng hấp dẫn từ vị trí click
    const down = (e) => {
      if (e.target.closest && e.target.closest('button')) return
      rt.wave.t0 = rt.time
      rt.wave.x = e.clientX / window.innerWidth
      rt.wave.y = 1 - e.clientY / window.innerHeight
      gravityPulse()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0">
      <QualityContext.Provider value={q}>
        <Canvas
          dpr={[1, q.dpr]}
          camera={{ fov: 80, near: 0.1, far: 6000, position: [0, 1.7, 14] }}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            stencil: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
          style={{ touchAction: 'pan-y' }}
        >
          <color attach="background" args={['#02020a']} />
          {/* Fog volumetric tím-xanh navy #0a0a1f */}
          <fogExp2 attach="fog" args={['#0a0a1f', 0.0042]} />
          <Clock />
          <Perf max={q.dpr} />
          <Suspense fallback={null}>
            <SkyDome />
            <MilkyWay />
            <Nebula />
            <Stars />
            <DistantGalaxies />
            <ShootingStars />
            <BlackHole />
            <DragonMaidsBridge />
            <Ground />
            <Foreground />
            <GroundFog />
            <DustField />
            <CameraRig />
            <PostFX />
            <ReadySignal />
          </Suspense>
        </Canvas>
      </QualityContext.Provider>
    </div>
  )
}
