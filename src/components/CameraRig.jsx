import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '../store'
import { HOLE, CAM_START, LOOK_START } from '../constants'
import { setIntensity } from '../utils/audio'

const start = new THREE.Vector3(...CAM_START)
const hole = new THREE.Vector3(...HOLE)
const lookA = new THREE.Vector3(...LOOK_START)
const tmp = new THREE.Vector3()
const tgt = new THREE.Vector3()
const deg = THREE.MathUtils.degToRad

/** Đồng hồ trung tâm: clamp delta (tránh nhảy khi tab bị ẩn) */
export function Clock() {
  useFrame((_, d) => {
    rt.dt = Math.min(d, 1 / 20)
    rt.time += rt.dt
  }, -100)
  return null
}

/**
 * CAMERA RIG
 *  - Từ mặt đất ngước lên, FOV 80 -> 90 khi lao vào hố đen
 *  - Breathing: dao động ±0.5° (roll + pitch)
 *  - Parallax chuột ease 0.05
 *  - Camera Shake (0.3° - 0.5°) khi có Dragon Maid vụt sát qua bán kính gần
 *  - Scroll: tiến dần tới hố đen (easing ^2.2: đầu chậm, cuối lao nhanh)
 */
export function CameraRig() {
  useFrame((state) => {
    const dt = rt.dt
    const cam = state.camera

    rt.sm += (rt.scroll - rt.sm) * (1 - Math.exp(-dt * 4))
    const e = Math.pow(rt.sm, 2.2)
    rt.e = e
    const k = 1 - Math.pow(1 - 0.05, dt * 60) // ease 0.05 độc lập frame-rate
    rt.mx += (rt.mouse.x - rt.mx) * k
    rt.my += (rt.mouse.y - rt.my) * k
    const par = 1 - e

    tmp.lerpVectors(start, hole, e * 0.975)
    tmp.x += rt.mx * 1.6 * par
    tmp.y += rt.my * 0.6 * par
    cam.position.copy(tmp)

    tgt.lerpVectors(lookA, hole, e)
    tgt.x += rt.mx * 14 * par
    tgt.y += rt.my * 8 * par
    cam.lookAt(tgt)

    const t = rt.time
    // Rung camera 0.3° - 0.5° trong đúng 200ms khi Dragon Maid bay sát (< 5 units) gọi onWhoosh()
    const nowMs = performance.now()
    if (rt.shake.until && nowMs < rt.shake.until) {
      // Giữ nguyên biên độ 0.3° - 0.5° suốt 200ms xung kích
    } else {
      rt.shake.amp *= Math.exp(-dt * 10.0)
    }
    const shakePitch = rt.shake.amp > 0.002 ? Math.sin(t * 52.0) * deg(rt.shake.amp) : 0
    const shakeRoll =
      rt.shake.amp > 0.002 ? Math.cos(t * 64.0) * deg(rt.shake.amp * 0.85 * (rt.shake.dir || 1)) : 0
    const shakeYaw = rt.shake.amp > 0.002 ? Math.sin(t * 41.0 + 1.3) * deg(rt.shake.amp * 0.65) : 0

    cam.rotateZ(Math.sin(t * 0.37) * deg(0.5) + shakeRoll)
    cam.rotateX(Math.sin(t * 0.29 + 1) * deg(0.5) + shakePitch)
    cam.rotateY(shakeYaw)

    cam.fov = 80 + e * 10
    cam.updateProjectionMatrix()

    if ((state.clock.elapsedTime * 10) % 5 < 0.2) setIntensity(rt.sm)
  })
  return null
}
