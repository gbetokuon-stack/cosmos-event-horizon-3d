import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { rt } from '../store'
import { useQuality } from '../utils/QualityContext'
import {
  starVert, starFrag, milkyVert, milkyFrag, galaxyFrag, shootFrag,
} from '../shaders/stars'
import { spriteVert } from '../shaders/nebula'

/* Bảng màu sao theo nhiệt độ: xanh -> trắng -> vàng -> cam -> đỏ */
const TEMP = [
  [0.62, 0.75, 1.0], [0.8, 0.88, 1.0], [1, 1, 1], [1, 0.95, 0.8],
  [1, 0.82, 0.55], [1, 0.6, 0.4], [1, 0.4, 0.35],
]
function pickColor() {
  const r = Math.random()
  if (r < 0.52) return TEMP[2] // đa số sao trắng
  return TEMP[Math.floor(Math.random() * TEMP.length)]
}

// Pháp tuyến dải Ngân Hà (để tập trung 1 phần sao quanh dải)
const BAND_N = new THREE.Vector3(0.35, 0.5, 0.8).normalize()

function makeLayer(count, radius, sizeMin, sizeMax, bandChance) {
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  const color = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue }
    v.normalize()
    if (Math.random() < bandChance) {
      // ép về gần mặt phẳng dải Ngân Hà
      v.addScaledVector(BAND_N, -v.dot(BAND_N) * (0.85 + Math.random() * 0.12)).normalize()
    }
    if (v.y < 0) v.y = -v.y * 0.9 // chỉ bầu trời nửa trên
    v.normalize()
    pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3)
    size[i] = sizeMin + Math.pow(Math.random(), 3) * (sizeMax - sizeMin)
    phase[i] = Math.random()
    const c = pickColor()
    color.set(c, i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
  return g
}

/** 50.000 sao, 3 lớp depth. Cả nhóm bám theo camera (vô cực) */
export function Stars() {
  const q = useQuality()
  const group = useRef()
  const layers = useMemo(() => {
    const s = q.scale
    const defs = [
      // count, radius (z), size px, opacity, twinkle
      { n: 30000, r: 2000, a: 1.1, b: 2.4, op: 0.3, tw: 0.15, band: 0.35 }, // lớp xa
      { n: 15000, r: 1000, a: 1.5, b: 3.4, op: 0.7, tw: 0.35, band: 0.1 }, // lớp giữa
      { n: 5000, r: 500, a: 2.4, b: 7.0, op: 1.0, tw: 0.75, band: 0 }, // lớp gần, twinkle mạnh
    ]
    return defs.map((d) => ({
      geometry: makeLayer(Math.floor(d.n * s), d.r, d.a, d.b, d.band),
      material: new THREE.ShaderMaterial({
        vertexShader: starVert, fragmentShader: starFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uPx: { value: q.dpr }, uTwinkle: { value: d.tw },
          uScale: { value: 1 }, uOpacity: { value: 0 }, base: { value: d.op },
        },
      }),
    }))
  }, [q])

  useFrame((state) => {
    group.current.position.copy(state.camera.position)
    layers.forEach(({ material }) => {
      const u = material.uniforms
      u.uTime.value = rt.time
      u.uOpacity.value = u.base.value * rt.intro.stars
    })
  })

  return (
    <group ref={group}>
      {layers.map((l, i) => (
        <points key={i} geometry={l.geometry} material={l.material} renderOrder={-8} />
      ))}
    </group>
  )
}

/** Dải Ngân Hà: plane khổng lồ chéo bầu trời */
export function MilkyWay() {
  const mesh = useRef()
  const group = useRef()
  const mat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: milkyVert, fragmentShader: milkyFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    }),
    [],
  )
  useLayoutEffect(() => {
    mesh.current.lookAt(0, 0, 0)
    mesh.current.rotateZ(0.55) // chéo
  }, [])
  useFrame((state) => {
    group.current.position.copy(state.camera.position)
    mat.uniforms.uTime.value = rt.time
    mat.uniforms.uOpacity.value = 0.5 * rt.intro.stars
  })
  return (
    <group ref={group}>
      <mesh ref={mesh} position={[200, 1000, -1500]} renderOrder={-10}>
        <planeGeometry args={[4200, 1100]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}

/** 26 thiên hà xoắn ốc xa xôi (sprite mờ) */
export function DistantGalaxies() {
  const q = useQuality()
  const group = useRef()
  const items = useMemo(() => {
    const tints = [[0.6, 0.7, 1], [1, 0.75, 0.6], [0.85, 0.7, 1], [0.7, 0.9, 1]]
    const n = q.mobile ? 14 : 26
    return Array.from({ length: n }, () => {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.9 + 0.12, Math.random() * 2 - 1).normalize()
      const tint = tints[Math.floor(Math.random() * tints.length)]
      return {
        pos: v.multiplyScalar(1700),
        size: 40 + Math.random() * 80,
        mat: new THREE.ShaderMaterial({
          vertexShader: spriteVert, fragmentShader: galaxyFrag,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: {
            uRot: { value: Math.random() * 6.28 }, uTilt: { value: 0.35 + Math.random() * 0.6 },
            uOp: { value: 0 }, uTint: { value: new THREE.Vector3(...tint) },
          },
        }),
      }
    })
  }, [q])
  useFrame((state) => {
    group.current.position.copy(state.camera.position)
    items.forEach((it) => { it.mat.uniforms.uOp.value = 0.55 * rt.intro.stars })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <Billboard key={i} position={it.pos} renderOrder={-7}>
          <mesh>
            <planeGeometry args={[it.size, it.size]} />
            <primitive object={it.mat} attach="material" />
          </mesh>
        </Billboard>
      ))}
    </group>
  )
}

/** 5 sao băng ngẫu nhiên, trail gradient */
export function ShootingStars() {
  const group = useRef()
  const N = 5
  const items = useMemo(
    () => Array.from({ length: N }, () => ({
      mat: new THREE.ShaderMaterial({
        vertexShader: spriteVert, fragmentShader: shootFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uLife: { value: 0 } },
      }),
      mesh: null,
      age: 99, life: 1, wait: Math.random() * 6, // chờ ngẫu nhiên để spawn
      from: new THREE.Vector3(), vel: new THREE.Vector3(), len: 100,
    })),
    [],
  )
  useFrame((state) => {
    const dt = rt.dt
    group.current.position.copy(state.camera.position)
    items.forEach((s) => {
      if (!s.mesh) return
      if (s.age > s.life) {
        s.wait -= dt
        s.mesh.visible = false
        if (s.wait > 0) return
        // spawn mới
        const th = Math.random() * Math.PI * 2
        const el = 0.35 + Math.random() * 0.8
        const R = 900
        s.from.set(Math.cos(th) * Math.cos(el) * R, Math.sin(el) * R, -Math.abs(Math.sin(th)) * Math.cos(el) * R - 200)
        const dir = new THREE.Vector3(Math.random() - 0.5, -0.25 - Math.random() * 0.3, Math.random() * 0.2 - 0.1).normalize()
        s.vel.copy(dir).multiplyScalar(500 + Math.random() * 400)
        s.len = 120 + Math.random() * 140
        s.life = 0.9 + Math.random() * 0.8
        s.age = 0
        s.wait = 2 + Math.random() * 7
        s.mesh.visible = true
      }
      s.age += dt
      const p = s.from.clone().addScaledVector(s.vel, s.age)
      s.mesh.position.copy(p)
      s.mesh.lookAt(state.camera.position.x - group.current.position.x, state.camera.position.y - group.current.position.y, state.camera.position.z - group.current.position.z)
      // xoay để đuôi dọc theo hướng bay (trong mặt phẳng nhìn)
      const dirView = s.vel.clone().transformDirection(state.camera.matrixWorldInverse)
      s.mesh.rotateZ(Math.atan2(dirView.y, dirView.x))
      s.mesh.scale.set(s.len, 2.6, 1)
      const k = s.age / s.life
      s.mat.uniforms.uLife.value = Math.sin(Math.min(k, 1) * Math.PI) * rt.intro.stars
    })
  })
  return (
    <group ref={group}>
      {items.map((s, i) => (
        <mesh key={i} ref={(m) => (s.mesh = m)} visible={false} renderOrder={-6}>
          {/* đuôi trải dọc +X (đầu sao ở uv.x = 1) */}
          <planeGeometry args={[1, 1]} />
          <primitive object={s.mat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}
