import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * ============================================================================
 * CUSTOM HOOK QUẢN LÝ OBJECT POOL & QUỸ ĐẠO BAY (useDragonPool.js)
 * ============================================================================
 * - Khởi tạo cố định N instance (10 trên Desktop, 5 trên Mobile), tái sử dụng 100%
 * - Mỗi cá thể giữ đầy đủ state:
 *   { active, startPos, endPos, controlPos, progress, speed, scale, colorVariant }
 * - Tính trước (Precompute) toàn bộ điểm & tiếp tuyến của QuadraticBezierCurve3 ngay
 *   khi spawn để vòng lặp useFrame đạt O(1) phép nội suy mảng tĩnh (0 tạo rác bộ nhớ)
 */

// Số đoạn lấy mẫu tĩnh dọc theo đường cong QuadraticBezierCurve3 lúc spawn
export const CURVE_LUT_STEPS = 128

/**
 * 3 Biến thể màu cánh & vệt sáng chuẩn Dark-Fantasy Cinema
 */
export const DRAGON_VARIANTS = [
  {
    id: 'violet-pink',
    label: 'Tím-Hồng',
    wingPrimary: '#8b00ff',
    wingSecondary: '#ff1493',
    emissiveCyan: '#00d4ff',
  },
  {
    id: 'blue-cyan',
    label: 'Xanh-Cyan',
    wingPrimary: '#00d4ff',
    wingSecondary: '#00ffaa',
    emissiveCyan: '#00d4ff',
  },
  {
    id: 'red-orange',
    label: 'Đỏ-Cam',
    wingPrimary: '#ff3300',
    wingSecondary: '#ffaa00',
    emissiveCyan: '#00d4ff',
  },
]

const _tmpPt = new THREE.Vector3()
const _tmpPrev = new THREE.Vector3()
const _tmpTan = new THREE.Vector3()
const _camFwd = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _apex = new THREE.Vector3()
const _chord = new THREE.Vector3()
const _perp = new THREE.Vector3()

const randRange = (min, max) => min + Math.random() * (max - min)

/**
 * Tiền tính toán (Precompute) bảng tra cứu vị trí & tiếp tuyến của đường cong Bézier bậc 2
 * giúp không phải giải phương trình đường cong lại mỗi frame trong useFrame.
 */
export function precomputeCurveLUT(slot) {
  const { curve, lutPoints, lutTangents } = slot
  let totalLen = 0

  for (let i = 0; i <= CURVE_LUT_STEPS; i++) {
    const t = i / CURVE_LUT_STEPS
    curve.getPoint(t, _tmpPt)
    curve.getTangent(t, _tmpTan)

    const i3 = i * 3
    lutPoints[i3] = _tmpPt.x
    lutPoints[i3 + 1] = _tmpPt.y
    lutPoints[i3 + 2] = _tmpPt.z

    lutTangents[i3] = _tmpTan.x
    lutTangents[i3 + 1] = _tmpTan.y
    lutTangents[i3 + 2] = _tmpTan.z

    if (i > 0) {
      totalLen += _tmpPt.distanceTo(_tmpPrev)
    }
    _tmpPrev.copy(_tmpPt)
  }

  slot.curveLength = Math.max(40, totalLen)
}

/**
 * Đọc vị trí & tiếp tuyến tại `progress` (0..1) từ bảng Precomputed LUT trong thời gian O(1)
 */
export function samplePrecomputedCurve(slot, progress, outPos, outTan) {
  const clamped = progress <= 0 ? 0 : progress >= 1 ? 1 : progress
  const f = clamped * CURVE_LUT_STEPS
  const idx0 = Math.min(CURVE_LUT_STEPS - 1, Math.floor(f))
  const idx1 = idx0 + 1
  const alpha = f - idx0

  const a3 = idx0 * 3
  const b3 = idx1 * 3
  const pts = slot.lutPoints
  const tans = slot.lutTangents

  outPos.set(
    pts[a3] + (pts[b3] - pts[a3]) * alpha,
    pts[a3 + 1] + (pts[b3 + 1] - pts[a3 + 1]) * alpha,
    pts[a3 + 2] + (pts[b3 + 2] - pts[a3 + 2]) * alpha,
  )

  outTan
    .set(
      tans[a3] + (tans[b3] - tans[a3]) * alpha,
      tans[a3 + 1] + (tans[b3 + 1] - tans[a3 + 1]) * alpha,
      tans[a3 + 2] + (tans[b3 + 2] - tans[a3 + 2]) * alpha,
    )
    .normalize()
}

/**
 * Custom Hook khởi tạo & điều phối Object Pool các thực thể Dragon Maid
 */
export function useDragonPool({
  count = 10,
  spawnInterval = [3000, 8000],
  speedRange = [200, 500],
  isMobile = false,
}) {
  const poolSize = isMobile ? Math.min(count, 5) : count

  const pool = useMemo(() => {
    const [minIntervalMs, maxIntervalMs] = spawnInterval

    // Khởi tạo mảng Pool cố định một lần duy nhất (không tạo/huỷ object khi spawn)
    const slots = Array.from({ length: poolSize }, (_, index) => {
      const startPos = new THREE.Vector3()
      const controlPos = new THREE.Vector3()
      const endPos = new THREE.Vector3()
      return {
        index,
        active: false,
        startPos,
        controlPos,
        endPos,
        curve: new THREE.QuadraticBezierCurve3(startPos, controlPos, endPos),
        lutPoints: new Float32Array((CURVE_LUT_STEPS + 1) * 3),
        lutTangents: new Float32Array((CURVE_LUT_STEPS + 1) * 3),
        curveLength: 500,
        progress: 0,
        speed: 280,
        scale: 1.0,
        colorVariant: DRAGON_VARIANTS[index % DRAGON_VARIANTS.length],
        isClosePass: false,
        whooshed: false,
        justSpawned: false,
        flapPhase: Math.random() * Math.PI * 2,
      }
    })

    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const showcaseMode = searchParams ? searchParams.has('showcase') : false
    const swarmMode = searchParams ? searchParams.has('swarm') : false

    /**
     * Lấy một instance đang rảnh từ Pool và sinh quỹ đạo QuadraticBezierCurve3 mới
     * @param {THREE.Camera} camera Camera hiện tại của cảnh 3D
     * @param {object|null} override Tuỳ chọn ép cấu hình (phục vụ showcase/test nếu cần)
     */
    const spawnFromPool = (camera, override = null) => {
      const slot = slots.find((s) => !s.active)
      if (!slot) return null

      const camPos = camera.position
      camera.getWorldDirection(_camFwd)
      _camFwd.y = 0
      if (_camFwd.lengthSq() < 1e-4) _camFwd.set(0, 0, -1)
      else _camFwd.normalize()
      _camRight.crossVectors(_camFwd, _worldUp).normalize()

      // Chọn 1 trong 4 hướng mép màn hình: 0 = Trái, 1 = Phải, 2 = Trên, 3 = Dưới
      const edge = override?.edge ?? Math.floor(Math.random() * 4)
      // 20% xác suất bay SÁT camera (< 5 units) tạo hiệu ứng "whoosh" xé gió qua đầu
      const isClosePass = override?.isClosePass ?? Math.random() < 0.2

      // Khoảng cách xuất phát & kết thúc cách camera 300 - 600 units, độ cao y random 20 - 150
      const distStart = randRange(300, 600)
      const distEnd = randRange(300, 600)
      const startY = randRange(20, 150)
      const endY = randRange(20, 150)

      const { startPos, endPos, controlPos } = slot

      if (edge === 0) {
        // Mép Trái -> Mép Phải
        startPos
          .copy(camPos)
          .addScaledVector(_camRight, -distStart * 0.85)
          .addScaledVector(_camFwd, distStart * randRange(0.35, 0.75))
        startPos.y = startY

        endPos
          .copy(camPos)
          .addScaledVector(_camRight, distEnd * 0.85)
          .addScaledVector(_camFwd, distEnd * randRange(0.35, 0.75))
        endPos.y = endY
      } else if (edge === 1) {
        // Mép Phải -> Mép Trái
        startPos
          .copy(camPos)
          .addScaledVector(_camRight, distStart * 0.85)
          .addScaledVector(_camFwd, distStart * randRange(0.35, 0.75))
        startPos.y = startY

        endPos
          .copy(camPos)
          .addScaledVector(_camRight, -distEnd * 0.85)
          .addScaledVector(_camFwd, distEnd * randRange(0.35, 0.75))
        endPos.y = endY
      } else if (edge === 2) {
        // Mép Trên cao bổ nhào xuống rồi vút ra xa
        const sideSign = Math.random() < 0.5 ? -1 : 1
        startPos
          .copy(camPos)
          .addScaledVector(_camRight, sideSign * randRange(120, 260))
          .addScaledVector(_camFwd, distStart * randRange(0.4, 0.75))
        startPos.y = randRange(110, 150)

        endPos
          .copy(camPos)
          .addScaledVector(_camRight, -sideSign * randRange(140, 290))
          .addScaledVector(_camFwd, distEnd * randRange(0.45, 0.85))
        endPos.y = randRange(25, 95)
      } else {
        // Mép Dưới / Sau lưng vọt lên bầu trời phía trước
        const sideSign = Math.random() < 0.5 ? -1 : 1
        startPos
          .copy(camPos)
          .addScaledVector(_camRight, sideSign * randRange(80, 220))
          .addScaledVector(_camFwd, -distStart * randRange(0.55, 0.85))
        startPos.y = randRange(20, 55)

        endPos
          .copy(camPos)
          .addScaledVector(_camRight, -sideSign * randRange(90, 240))
          .addScaledVector(_camFwd, distEnd * randRange(0.65, 0.95))
        endPos.y = randRange(65, 145)
      }

      if (isClosePass) {
        // Để đường cong Quadratic Bézier B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2 đi sát camera (< 5 units),
        // ta đặt đỉnh cong M cách camera 2.4 - 4.3 units rồi giải chính xác P1 = 2*M - 0.5*(P0 + P2)
        const passSide = Math.random() < 0.34 ? 0 : Math.random() < 0.5 ? -1 : 1
        _apex
          .copy(camPos)
          .addScaledVector(_camRight, passSide * randRange(1.8, 3.4))
          .addScaledVector(_camFwd, randRange(1.8, 3.2))
        _apex.y = camPos.y + randRange(1.2, 2.8)

        controlPos
          .copy(_apex)
          .multiplyScalar(2.0)
          .addScaledVector(startPos, -0.5)
          .addScaledVector(endPos, -0.5)
      } else {
        // Đường bay tầm trung/cao trên bầu trời: điểm uốn lệch vuông góc với dây cung P0->P2 để tạo cung lượn mềm
        _chord.subVectors(endPos, startPos)
        _perp.crossVectors(_chord, _worldUp)
        if (_perp.lengthSq() < 1e-4) _perp.copy(_camRight)
        else _perp.normalize()

        // Đảm bảo cung lượn đi qua vùng trời phía trước mặt người xem (cách camera 95 - 240 units)
        _apex
          .copy(camPos)
          .addScaledVector(_camFwd, randRange(95, 235))
          .addScaledVector(_camRight, randRange(-95, 95))
          .addScaledVector(_perp, randRange(-45, 45))
        _apex.y = randRange(28, 125)

        controlPos
          .copy(_apex)
          .multiplyScalar(2.0)
          .addScaledVector(startPos, -0.5)
          .addScaledVector(endPos, -0.5)
      }

      if (override?.points) {
        startPos.copy(override.points[0])
        controlPos.copy(override.points[1])
        endPos.copy(override.points[2])
      }

      // Weighted Random Speed: 20% bay chậm (50 - 80 units/s) để ngắm chi tiết, 80% bay vút (speedRange)
      const [minSpd, maxSpd] = speedRange
      const isSlowScenic = !isClosePass && Math.random() < 0.2
      slot.speed =
        override?.speed ?? (isSlowScenic ? randRange(50, 80) : randRange(minSpd, maxSpd))

      // Random tỷ lệ (0.8 - 1.5x) & 1 trong 3 biến thể màu cánh
      slot.scale = override?.scale ?? randRange(0.8, 1.5)
      const varIdx =
        override?.variantIndex ?? Math.floor(Math.random() * DRAGON_VARIANTS.length)
      slot.colorVariant = DRAGON_VARIANTS[varIdx % DRAGON_VARIANTS.length]

      slot.progress = override?.initialProgress ?? 0
      slot.isClosePass = isClosePass
      slot.whooshed = false
      slot.justSpawned = true
      slot.active = true

      // Precompute sẵn toàn bộ điểm & vector tiếp tuyến trên đường cong ngay lúc kích hoạt
      precomputeCurveLUT(slot)
      return slot
    }

    const nextIntervalSec = () =>
      randRange(minIntervalMs, maxIntervalMs) / 1000

    return {
      slots,
      spawnFromPool,
      nextIntervalSec,
      // Spawn chuyến đầu tiên sớm (1.2s) để người xem thấy hiệu ứng ngay khi vào cảnh
      timer: { remaining: 1.2, showcaseInit: false },
      showcaseMode,
      swarmMode,
    }
  }, [poolSize, spawnInterval[0], spawnInterval[1], speedRange[0], speedRange[1]])

  return pool
}
