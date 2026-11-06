import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '../store'
import { useQuality } from '../utils/QualityContext'
import {
  nebulaFrag, spriteVert, skyVert, skyFrag, dustVert, dustFrag,
} from '../shaders/nebula'

const C = (hex) => new THREE.Color(hex).toArray()

/** Vòm trời gradient #1a0b2e (chân trời) -> đen (thiên đỉnh) */
export function SkyDome() {
  const group = useRef()
  const mat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false,
      uniforms: { uOpacity: { value: 1 } },
    }),
    [],
  )
  useFrame((state) => group.current.position.copy(state.camera.position))
  return (
    <group ref={group}>
      <mesh renderOrder={-20}>
        <sphereGeometry args={[3000, 32, 24]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}

/** 7 lớp nebula volumetric (sprite + shader noise), parallax rất chậm theo chuột */
export default function Nebula() {
  const q = useQuality()
  const group = useRef()
  const defs = useMemo(() => {
    const L = [
      // vị trí, size, màu A/B/C, opacity
      { p: [-650, 520, -1400], s: 1700, c: ['#2a0a5e', '#8b00ff', '#ff1493'], o: 0.9 },
      { p: [700, 700, -1500], s: 1800, c: ['#05204a', '#1e90ff', '#00ffff'], o: 0.8 },
      { p: [100, 1100, -1100], s: 1500, c: ['#3a0a4a', '#ff1493', '#8b00ff'], o: 0.65 },
      { p: [-1000, 300, -1000], s: 1300, c: ['#0a2a4a', '#00ffff', '#1e90ff'], o: 0.55 },
      { p: [900, 280, -1200], s: 1400, c: ['#2a0a5e', '#8b00ff', '#1e90ff'], o: 0.65 },
      { p: [-100, 600, -1600], s: 2200, c: ['#1a0b2e', '#ff1493', '#00ffff'], o: 0.45 },
      { p: [350, 380, -900], s: 1100, c: ['#2a0540', '#8b00ff', '#ff1493'], o: 0.4 },
    ]
    const n = q.mobile ? 5 : L.length
    return L.slice(0, n).map((d, i) => ({
      ...d,
      depth: 0.4 + (i / L.length) * 0.6,
      mat: new THREE.ShaderMaterial({
        vertexShader: spriteVert, fragmentShader: nebulaFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uA: { value: new THREE.Vector3(...C(d.c[0])) },
          uB: { value: new THREE.Vector3(...C(d.c[1])) },
          uC: { value: new THREE.Vector3(...C(d.c[2])) },
          uSeed: { value: i * 1.37 + 0.5 },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uDragonPos: {
            value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()],
          },
          uDragonCol: {
            value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
          },
        },
      }),
    }))
  }, [q])

  const meshes = useRef([])
  useLayoutEffect(() => {
    meshes.current.forEach((m) => m && m.lookAt(0, 0, 0))
  }, [])

  useFrame((state) => {
    // bám camera 90% -> khi camera tiến lên nebula chỉ trôi chậm (parallax)
    group.current.position.copy(state.camera.position).multiplyScalar(0.9)
    items(meshes.current, defs, rt, state.camera.position)
  })

  return (
    <group ref={group}>
      {defs.map((d, i) => (
        <mesh key={i} ref={(m) => (meshes.current[i] = m)} position={d.p} renderOrder={-9}>
          <planeGeometry args={[d.s, d.s]} />
          <primitive object={d.mat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

function items(meshes, defs, rt, camPos) {
  defs.forEach((d, i) => {
    const u = d.mat.uniforms
    u.uTime.value = rt.time
    u.uOpacity.value = d.o * rt.intro.stars
    for (let k = 0; k < 4; k++) {
      const gp = rt.dragonGlowPos[k]
      const gc = rt.dragonGlowCol[k]
      u.uDragonPos.value[k].set(gp[0] - camPos.x, gp[1] - camPos.y, gp[2] - camPos.z, gp[3])
      u.uDragonCol.value[k].set(gc[0], gc[1], gc[2])
    }
    const m = meshes[i]
    if (m) {
      // parallax theo chuột: lớp xa trôi ít hơn lớp gần
      m.position.x = d.p[0] - rt.mx * 60 * d.depth
      m.position.y = d.p[1] - rt.my * 35 * d.depth
    }
  })
}

/** 10.000 hạt bụi vũ trụ lơ lửng gần camera, màu #ffd700 -> #ff69b4 */
export function DustField() {
  const q = useQuality()
  const group = useRef()
  const { geometry, material } = useMemo(() => {
    const n = Math.floor(10000 * q.scale)
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const phase = new Float32Array(n)
    const col = new Float32Array(n * 3)
    const a = new THREE.Color('#ffd700')
    const b = new THREE.Color('#ff69b4')
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 100, Math.random() * 40, Math.random() * 100 - 70], i * 3)
      size[i] = 0.4 + Math.random() * 1.8
      phase[i] = Math.random()
      c.lerpColors(a, b, Math.random())
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVert, fragmentShader: dustFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: q.dpr }, uOpacity: { value: 0 } },
    })
    return { geometry: g, material: m }
  }, [q])
  useFrame((state) => {
    group.current.position.set(state.camera.position.x, 0, state.camera.position.z)
    material.uniforms.uTime.value = rt.time
    material.uniforms.uOpacity.value = rt.intro.stars * (1 - rt.e)
  })
  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />
    </group>
  )
}
