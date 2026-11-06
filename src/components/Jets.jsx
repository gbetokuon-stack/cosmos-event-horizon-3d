import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '../store'
import { R_HORIZON } from '../constants'
import { jetVert, jetFrag, hawkVert, hawkFrag } from '../shaders/jets'
import { useQuality } from '../utils/QualityContext'

/** 2 tia plasma tương đối tính phun ra từ 2 cực (trục Z cục bộ của nhóm đĩa) */
export function Jets() {
  const q = useQuality()
  const { geometry, material } = useMemo(() => {
    const n = Math.floor(7000 * q.scale)
    const seed = new Float32Array(n)
    const sign = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      seed[i] = Math.random()
      sign[i] = i % 2 === 0 ? 1 : -1
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)) // dummy
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aSign', new THREE.BufferAttribute(sign, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: jetVert, fragmentShader: jetFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uLen: { value: 85 }, uRH: { value: R_HORIZON },
        uPx: { value: q.dpr }, uHover: { value: 0 }, uAlpha: { value: 0 },
      },
    })
    return { geometry: g, material: m }
  }, [q])

  useFrame(() => {
    const u = material.uniforms
    u.uTime.value = rt.time * (1 + rt.hover * 1.5)
    u.uHover.value = rt.hover
    u.uAlpha.value = rt.intro.disk
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}

/** Hạt Hawking li ti bay ra từ event horizon */
export function HawkingRadiation() {
  const q = useQuality()
  const { geometry, material } = useMemo(() => {
    const n = Math.floor(1800 * q.scale)
    const dir = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      dir.set([s * Math.cos(th), u, s * Math.sin(th)], i * 3)
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: hawkVert, fragmentShader: hawkFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uRH: { value: R_HORIZON }, uRange: { value: 55 },
        uPx: { value: q.dpr }, uAlpha: { value: 0 },
      },
    })
    return { geometry: g, material: m }
  }, [q])

  useFrame(() => {
    material.uniforms.uTime.value = rt.time
    material.uniforms.uAlpha.value = rt.intro.disk
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}
