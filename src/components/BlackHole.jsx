import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt, useStore } from '../store'
import { HOLE, R_HORIZON, DISK_IN, DISK_OUT, DISK_TILT, DISK_ROLL } from '../constants'
import {
  diskVert, diskFrag, haloVert, haloFrag, ringVert, ringFrag, rimVert, rimFrag,
} from '../shaders/blackhole'
import { Jets, HawkingRadiation } from './Jets'

/**
 * HỐ ĐEN TRUNG TÂM (BLACK HOLE - HERO ELEMENT)
 * Cấu trúc vật lý từ trong ra ngoài:
 *  1. Event Horizon  : Quả cầu đen tuyệt đối (#000000, MeshBasicMaterial) nuốt mọi tia sáng phía sau
 *  2. Rim Distortion : Viền Fresnel siêu mảnh sát mép chân trời sự kiện
 *  3. GodRays Sun    : Vành sáng mỏng ngoài rìa chân trời làm nguồn phát tia sáng thể tích (GodRays)
 *  4. Accretion Disk : Đĩa bồi tụ 3 vành tốc độ (3.0 / 1.5 / 0.5 vòng/giây) với GLSL noise + Fresnel + Doppler
 *  5. Lensed Halo    : Ảnh đĩa bồi tụ phía sau bị uốn cong qua cực trên/dưới + Einstein Ring
 *  6. Photon Ring    : Torus mảnh phát sáng trắng-xanh chạy xung nhịp quanh bóng hố đen
 *  7. Jets & Hawking : 2 tia plasma tương đối tính ở 2 cực + bức xạ hạt Hawking li ti
 */
export default function BlackHole() {
  const group = useRef()
  const billboard = useRef()
  const setSun = useStore((s) => s.setSun)

  const mats = useMemo(() => {
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
    return {
      disk: new THREE.ShaderMaterial({
        vertexShader: diskVert,
        fragmentShader: diskFrag,
        side: THREE.DoubleSide,
        ...additive,
        uniforms: {
          uTime: { value: 0 },
          uInner: { value: DISK_IN },
          uOuter: { value: DISK_OUT },
          uIntensity: { value: 1 },
          uAlpha: { value: 0 },
        },
      }),
      halo: new THREE.ShaderMaterial({
        vertexShader: haloVert,
        fragmentShader: haloFrag,
        ...additive,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 1 },
          uAlpha: { value: 0 },
          uRoll: { value: DISK_ROLL },
        },
      }),
      ring: new THREE.ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        ...additive,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uAlpha: { value: 0 } },
      }),
      rim: new THREE.ShaderMaterial({
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        ...additive,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uAlpha: { value: 0 } },
      }),
    }
  }, [])

  // Góc nghiêng chung của đĩa bồi tụ và 2 tia plasma cực
  const euler = useMemo(() => new THREE.Euler(DISK_TILT, 0, DISK_ROLL), [])

  useFrame((state) => {
    const dt = rt.dt
    // Làm mượt hiệu ứng khi di chuột vào hố đen
    rt.hover += (rt.hoverTarget - rt.hover) * (1 - Math.exp(-dt * 4))

    const k = rt.intro.hole
    group.current.scale.setScalar(Math.max(k, 1e-4))

    // Tốc độ xoay đĩa: chuẩn 1.0x (vành trong 3 vòng/giây, giữa 1.5, ngoài 0.5), tăng mạnh khi hover hoặc tiến sát
    const speed = (1 + rt.hover * 1.6) * (1 + rt.e * 2.2) * rt.intro.disk
    rt.diskT += dt * speed

    const alpha = rt.intro.disk
    const boost = 1 + rt.hover * 0.55
    mats.disk.uniforms.uTime.value = rt.diskT
    mats.disk.uniforms.uAlpha.value = alpha
    mats.disk.uniforms.uIntensity.value = boost

    mats.halo.uniforms.uTime.value = rt.time
    mats.halo.uniforms.uAlpha.value = alpha
    mats.halo.uniforms.uIntensity.value = boost

    mats.ring.uniforms.uTime.value = rt.time
    mats.ring.uniforms.uAlpha.value = alpha
    mats.ring.uniforms.uIntensity.value = boost

    mats.rim.uniforms.uTime.value = rt.time
    mats.rim.uniforms.uAlpha.value = alpha
    mats.rim.uniforms.uIntensity.value = boost

    // Nhóm billboard (vòng photon + vòm Einstein) luôn hướng trực diện về camera
    billboard.current.quaternion.copy(state.camera.quaternion)
  })

  return (
    <group ref={group} position={HOLE}>
      {/* 1. EVENT HORIZON — Quả cầu đen tuyệt đối (#000000) */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[R_HORIZON, 64, 64]} />
        <meshBasicMaterial color="#000000" side={THREE.DoubleSide} fog={false} toneMapped={false} />
      </mesh>

      {/* 2. Viền biến dạng hấp dẫn Fresnel sát mép Event Horizon */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[R_HORIZON * 1.03, 48, 48]} />
        <primitive object={mats.rim} attach="material" />
      </mesh>

      {/* 4. ĐĨA BỒI TỤ (ACCRETION DISK) + 7. HAI TIA PLASMA TƯƠNG ĐỐI TÍNH (JETS) */}
      <group rotation={euler}>
        <mesh renderOrder={3} frustumCulled={false}>
          <ringGeometry args={[DISK_IN, DISK_OUT, 256, 8]} />
          <primitive object={mats.disk} attach="material" />
        </mesh>
        <Jets />
      </group>

      {/* 3, 5, 6. VÒM BẺ CONG ÁNH SÁNG + EINSTEIN RING + PHOTON RING + NGUỒN GODRAYS */}
      <group ref={billboard}>
        <mesh ref={setSun} renderOrder={1} frustumCulled={false}>
          <ringGeometry args={[R_HORIZON * 1.05, R_HORIZON * 1.24, 64, 1]} />
          <meshBasicMaterial color="#7fd4ff" transparent opacity={0.18} fog={false} depthWrite={false} />
        </mesh>
        <mesh renderOrder={4} frustumCulled={false}>
          <planeGeometry args={[R_HORIZON * 9, R_HORIZON * 9]} />
          <primitive object={mats.halo} attach="material" />
        </mesh>
        <mesh renderOrder={5} frustumCulled={false}>
          <torusGeometry args={[R_HORIZON * 1.08, 0.18, 16, 240]} />
          <primitive object={mats.ring} attach="material" />
        </mesh>
      </group>

      {/* Bức xạ hạt Hawking thoát ra quanh chân trời sự kiện */}
      <HawkingRadiation />

      {/* Vùng cảm biến tương tác chuột (Hover tăng tốc đĩa & Bloom) */}
      <mesh
        onPointerOver={() => {
          rt.hoverTarget = 1
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          rt.hoverTarget = 0
          document.body.style.cursor = ''
        }}
      >
        <sphereGeometry args={[R_HORIZON * 3.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}
