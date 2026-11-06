import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { rt } from '../store'
import { useQuality } from '../utils/QualityContext'
import { fogVert, fogFrag } from '../shaders/nebula'

/** Sinh normal map gợn sóng nước liền mạch (tileable) bằng công thức lượng giác */
function makeRippleNormal(size = 256) {
  const data = new Uint8Array(size * size * 4)
  const TAU = Math.PI * 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const a = TAU * (3 * u + v)
      const b = TAU * (5 * v - 2 * u)
      const c = TAU * (9 * u + 7 * v)
      const dhdu = Math.cos(a) * 3 * 0.5 + Math.cos(b) * -2 * 0.3 + Math.cos(c) * 9 * 0.15
      const dhdv = Math.cos(a) * 1 * 0.5 + Math.cos(b) * 5 * 0.3 + Math.cos(c) * 7 * 0.15
      const n = new THREE.Vector3(-dhdu * 0.06, -dhdv * 0.06, 1).normalize()
      const i = (y * size + x) * 4
      data[i] = (n.x * 0.5 + 0.5) * 255
      data[i + 1] = (n.y * 0.5 + 0.5) * 255
      data[i + 2] = (n.z * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 60)
  t.needsUpdate = true
  return t
}

/**
 * MẶT ĐẤT PHẢN CHIẾU (GROUND REFLECTOR)
 *  - Mặt gương nước đen (roughness 0.1, metalness 0.9) phản chiếu hố đen & dải Ngân Hà
 *  - Kết hợp Vertex Displacement Sine Wave trên lưới đa giác + Normal Map gợn sóng động
 */
export function Ground() {
  const q = useQuality()
  const geoRef = useRef()
  const normal = useMemo(() => makeRippleNormal(), [])
  const segs = q.mobile ? 64 : 128

  // Lưu toạ độ gốc để tính vertex displacement sine wave mượt mà
  const baseXY = useMemo(() => null, [])
  const origRef = useRef(null)

  useFrame(() => {
    normal.offset.x = rt.time * 0.004
    normal.offset.y = rt.time * 0.0027

    const g = geoRef.current
    if (!g) return
    const pos = g.attributes.position
    if (!origRef.current) {
      origRef.current = new Float32Array(pos.array)
    }
    const base = origRef.current
    const t = rt.time * 1.15
    // Vertex displacement sine wave nhẹ trên bề mặt hồ nước đen
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3
      const x = base[ix]
      const y = base[ix + 1]
      const wave =
        Math.sin(x * 0.045 + t) * 0.08 +
        Math.cos(y * 0.038 - t * 0.8) * 0.07 +
        Math.sin((x + y) * 0.09 + t * 1.4) * 0.035
      pos.array[ix + 2] = wave
    }
    pos.needsUpdate = true
  })

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} renderOrder={-1}>
      <planeGeometry ref={geoRef} args={[2400, 2400, segs, segs]} />
      <MeshReflectorMaterial
        color="#04040c"
        metalness={0.9}
        roughness={0.1}
        mirror={0.95}
        blur={[280, 90]}
        mixBlur={1.0}
        mixStrength={2.4}
        resolution={q.reflRes}
        depthScale={0.6}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.5}
        normalMap={normal}
        normalScale={new THREE.Vector2(0.28, 0.28)}
        distortion={0}
      />
    </mesh>
  )
}

/** 3 lớp sương mù thể tích (volumetric fog layers) là là sát mặt nước đen */
export function GroundFog() {
  const group = useRef()
  const layers = useMemo(
    () =>
      [
        { y: 0.35, op: 0.55, sc: 1.0 },
        { y: 1.15, op: 0.38, sc: 1.45 },
        { y: 2.35, op: 0.26, sc: 1.95 },
      ].map((l) => ({
        ...l,
        mat: new THREE.ShaderMaterial({
          vertexShader: fogVert,
          fragmentShader: fogFrag,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uOp: { value: l.op },
            uSc: { value: l.sc },
            uCam: { value: new THREE.Vector3() },
            uDragonPos: {
              value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()],
            },
            uDragonCol: {
              value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
            },
          },
        }),
      })),
    [],
  )

  useFrame((state) => {
    group.current.position.set(state.camera.position.x, 0, state.camera.position.z)
    layers.forEach((l) => {
      const u = l.mat.uniforms
      u.uTime.value = rt.time
      u.uCam.value.copy(state.camera.position)
      u.uOp.value = l.op * rt.intro.stars * (1 - rt.e * 0.8)
      for (let k = 0; k < 4; k++) {
        const gp = rt.dragonGlowPos[k]
        const gc = rt.dragonGlowCol[k]
        u.uDragonPos.value[k].set(gp[0], gp[1], gp[2], gp[3])
        u.uDragonCol.value[k].set(gc[0], gc[1], gc[2])
      }
    })
  })

  return (
    <group ref={group}>
      {layers.map((l, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, l.y, 0]} renderOrder={7}>
          <planeGeometry args={[1000, 1000]} />
          <primitive object={l.mat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

/** Silhouette cỏ & mỏm đá tiền cảnh (InstancedMesh) tạo chiều sâu tỷ lệ người đứng */
export function Foreground() {
  const q = useQuality()
  const grass = useRef()
  const rocks = useRef()
  const grassCount = Math.floor(900 * q.scale)

  const rockDefs = useMemo(() => {
    const r = []
    // Đá tiền cảnh hai bên trái/phải (chừa trống trục giữa để gương nước phản chiếu trọn vẹn hố đen)
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const x = side * (7 + Math.random() * 18)
      r.push({
        p: [x, -0.15, -5 - Math.random() * 26],
        s: [1.4 + Math.random() * 3.0, 0.7 + Math.random() * 1.8, 1.4 + Math.random() * 2.8],
      })
    }
    // Dãy núi thấp mờ phía chân trời hai bên
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const x = side * (55 + Math.random() * 200)
      r.push({
        p: [x, -0.5, -85 - Math.random() * 65],
        s: [24 + Math.random() * 38, 3.5 + Math.random() * 7.5, 14 + Math.random() * 20],
      })
    }
    return r
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const qn = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < grassCount; i++) {
      const side = Math.random() < 0.5 ? -1 : 1
      const x = side * (3.5 + Math.random() * 22)
      const z = -26 + Math.random() * 34
      const h = 0.35 + Math.random() * 1.15
      e.set((Math.random() - 0.5) * 0.35, Math.random() * 6.28, (Math.random() - 0.5) * 0.35)
      qn.setFromEuler(e)
      m.compose(new THREE.Vector3(x, 0, z), qn, new THREE.Vector3(1, h, 1))
      grass.current.setMatrixAt(i, m)
    }
    grass.current.instanceMatrix.needsUpdate = true

    rockDefs.forEach((d, i) => {
      e.set(0, Math.random() * 6.28, 0)
      qn.setFromEuler(e)
      m.compose(new THREE.Vector3(...d.p), qn, new THREE.Vector3(...d.s))
      rocks.current.setMatrixAt(i, m)
    })
    rocks.current.instanceMatrix.needsUpdate = true
  }, [grassCount, rockDefs])

  return (
    <>
      <instancedMesh ref={grass} args={[null, null, grassCount]} frustumCulled={false}>
        <coneGeometry args={[0.035, 1, 3]} />
        <meshBasicMaterial color="#030308" />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[null, null, rockDefs.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#020207" />
      </instancedMesh>
    </>
  )
}
