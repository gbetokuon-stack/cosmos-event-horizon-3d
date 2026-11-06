import { memo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  EffectComposer, Bloom, Noise, Vignette, ChromaticAberration, GodRays, SSAO, ToneMapping,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { Lensing } from '../effects/LensingEffect'
import { rt, useStore } from '../store'
import { HOLE, R_HORIZON } from '../constants'
import { useQuality } from '../utils/QualityContext'

const holeV = new THREE.Vector3(...HOLE)
const ndc = new THREE.Vector3()
const CA_OFFSET = new THREE.Vector2(0.002, 0.002)

/**
 * CHUỖI HẬU KỲ ĐIỆN ẢNH (POST-PROCESSING STACK)
 * Thứ tự chuẩn HDR Cinema Pipeline (HalfFloatType):
 *  1. Lensing + LensDistortion (barrel) + Gravitational Wave + Exposure 1.2
 *  2. GodRays tỏa ra từ rìa hố đen
 *  3. UnrealBloom (strength 1.5, radius 0.8, threshold 0.2)
 *  4. SSAO tăng chiều sâu cho mặt đất & đá tiền cảnh (tắt tự động trên mobile)
 *  5. ACESFilmicToneMapping chuyển HDR về LDR mượt mà (tránh vỡ hạt màu cầu vồng)
 *  6. ChromaticAberration (offset 0.002)
 *  7. Film Noise (opacity 0.15)
 *  8. Vignette (darkness 0.8)
 */
function PostFX() {
  const q = useQuality()
  const sun = useStore((s) => s.sun)
  const lens = useRef()
  const bloom = useRef()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useFrame(() => {
    const L = lens.current
    if (!L) return
    const u = L.uniforms
    const dist = camera.position.distanceTo(holeV)
    ndc.copy(holeV).project(camera)
    const behind = ndc.z > 1
    u.get('uCenter').value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5)
    u.get('uAspect').value = size.width / size.height

    const unitsPerHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const rScaled = R_HORIZON * Math.max(rt.intro.hole, 1e-3)
    u.get('uRadius').value = Math.min((rScaled / unitsPerHeight) * 1.02, 0.9)
    // Cường độ bẻ cong không-thời gian tăng khi hover hoặc cuộn lại gần
    u.get('uStrength').value = behind ? 0 : (0.65 + rt.hover * 0.25) * rt.intro.hole

    // Sóng hấp dẫn lan tỏa khi click chuột
    const age = rt.time - rt.wave.t0
    u.get('uWaveC').value.set(rt.wave.x, rt.wave.y)
    u.get('uWaveR').value = age * 0.5
    u.get('uWaveA').value = age < 4 ? Math.exp(-age * 0.9) : 0

    // Hover vào hố đen -> Bloom rực sáng hơn
    if (bloom.current) bloom.current.intensity = 1.5 + rt.hover * 0.85 + rt.e * 0.9
  })

  return (
    <EffectComposer
      multisampling={q.msaa}
      enableNormalPass={q.ssao}
      frameBufferType={THREE.HalfFloatType}
    >
      <Lensing barrel={0.045} exposure={1.2} ref={lens} />
      {sun && (
        <GodRays
          sun={sun}
          blendFunction={BlendFunction.SCREEN}
          samples={q.godRaySamples}
          density={0.94}
          decay={0.91}
          weight={0.18}
          exposure={0.45}
          clampMax={0.85}
          kernelSize={KernelSize.SMALL}
          blur
        />
      )}
      <Bloom
        ref={bloom}
        intensity={1.5}
        radius={0.8}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      {q.ssao && (
        <SSAO
          samples={12}
          rings={4}
          radius={0.05}
          intensity={6}
          luminanceInfluence={0.7}
          bias={0.03}
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.35} />
      <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.15} />
      <Vignette eskil={false} offset={0.22} darkness={0.8} />
    </EffectComposer>
  )
}

export default memo(PostFX)
