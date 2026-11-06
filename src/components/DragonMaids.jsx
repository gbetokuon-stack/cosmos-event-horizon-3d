import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DragonMaid, {
  RIBBON_SEGMENTS,
  MOBILE_LINE_POINTS,
  EMBERS_PER_INSTANCE,
  STREAK_COUNT,
  STREAK_SEGMENTS,
} from './DragonMaid'
import { useDragonPool, samplePrecomputedCurve } from './useDragonPool'

/**
 * ============================================================================
 * HỆ THỐNG NỮ CHIẾN BINH CÁNH RỒNG BAY VỤT QUA BẦU TRỜI (DragonMaids.jsx)
 * ============================================================================
 * Phong cách: PHOTOREALISTIC DARK-FANTASY AAA CINEMATIC (House of the Dragon / Elden Ring)
 * Tuyệt đối KHÔNG anime / manga / chibi / cel-shading.
 *
 * Tính năng cốt lõi:
 *  - Object Pooling cố định `count` instance (mặc định 10, tự hạ xuống 5 trên Mobile < 768px)
 *  - Toàn bộ chuyển động, vệt sáng, hạt tàn lửa & va chạm vùng gần chạy trong 1 `useFrame` duy nhất
 *  - Quỹ đạo QuadraticBezierCurve3 tính sẵn (Precomputed LUT) từ 4 mép màn hình (300 - 600 units)
 *  - Hỗ trợ thay thế trực tiếp bằng mô hình GLB (`modelUrl`) hoặc Sprite Sheet (`spriteSheetUrl`)
 */

// Các vector tạm tái sử dụng toàn cục để không cấp phát bộ nhớ trong vòng lặp 60fps
const _pos = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _lookTarget = new THREE.Vector3()
const _trailPos = new THREE.Vector3()
const _trailTan = new THREE.Vector3()
const _viewDir = new THREE.Vector3()
const _sideVec = new THREE.Vector3()
const _upVec = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _camLocalPos = new THREE.Vector3()
const _wingWorldPos = new THREE.Vector3()

/**
 * Phát âm thanh gió xé "Whoosh" không gian 2 kênh (Stereo Panning):
 * Ưu tiên phát file `audioSrc` nếu có sẵn trong dự án, tự động fallback sang
 * bộ tổng hợp gió siêu thanh Web Audio API nếu dự án chưa đặt file mp3.
 */
function triggerWhooshSound(audioState, audioSrc, side) {
  if (typeof window === 'undefined') return
  const panVal = side === 'left' ? -0.8 : side === 'right' ? 0.8 : 0.0

  // Khởi tạo AudioContext một lần khi cần
  if (!audioState.ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    audioState.ctx = new AudioCtx()
  }
  const ctx = audioState.ctx
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  // Fallback tổng hợp tiếng gió xé Doppler trầm hùng bằng Web Audio API
  const playProceduralWhoosh = () => {
    const dur = 0.55
    const now = ctx.currentTime
    const bufSize = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const ch = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      ch[i] = Math.random() * 2 - 1
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.8
    filter.frequency.setValueAtTime(220, now)
    filter.frequency.exponentialRampToValueAtTime(1250, now + dur * 0.35)
    filter.frequency.exponentialRampToValueAtTime(140, now + dur)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.28, now + dur * 0.32)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    src.connect(filter)
    filter.connect(gain)
    if (panner) {
      panner.pan.setValueAtTime(panVal, now)
      gain.connect(panner)
      panner.connect(ctx.destination)
    } else {
      gain.connect(ctx.destination)
    }
    src.start(now)
    src.stop(now + dur + 0.02)
  }

  if (!audioSrc || audioState.fileFailed) {
    playProceduralWhoosh()
    return
  }

  // Nếu đã tải thành công AudioBuffer từ `audioSrc`, phát trực tiếp với StereoPanner
  if (audioState.decodedBuffer) {
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = audioState.decodedBuffer
    const gain = ctx.createGain()
    gain.gain.value = 0.65
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(panVal, now)
      src.connect(gain)
      gain.connect(panner)
      panner.connect(ctx.destination)
    } else {
      src.connect(gain)
      gain.connect(ctx.destination)
    }
    src.start(now)
    return
  }

  // Lần đầu tiên: nạp bất đồng bộ file `audioSrc`, trong lúc chờ dùng tiếng gió tổng hợp
  playProceduralWhoosh()
  if (!audioState.loading) {
    audioState.loading = true
    fetch(audioSrc)
      .then((res) => {
        if (!res.ok) throw new Error('Audio not found')
        return res.arrayBuffer()
      })
      .then((arr) => ctx.decodeAudioData(arr))
      .then((decoded) => {
        audioState.decodedBuffer = decoded
      })
      .catch(() => {
        audioState.fileFailed = true
      })
  }
}

/**
 * Chuyển pha mượt mà giữa các clip trong AnimationMixer khi dùng mô hình GLB thật
 */
function transitionGLBAction(glbState, targetKey) {
  if (!glbState || glbState.activeKey === targetKey) return
  const { actions } = glbState
  const next = actions[targetKey] || actions.flap || actions.default
  const prev = actions[glbState.activeKey] || actions.default
  if (!next || next === prev) return

  next.reset().play()
  if (prev) prev.crossFadeTo(next, 0.25, false)
  glbState.activeKey = targetKey
}

export default function DragonMaids({
  count = 10,
  spawnInterval = [3000, 8000],
  speedRange = [200, 500],
  onWhoosh,
  enableAudio = false,
  audioSrc = '/sounds/whoosh.mp3',
  modelUrl = null,
  spriteSheetUrl = null,
  spriteFrames = 10,
  onActivePositionsChange,
}) {
  // Tự động nhận diện thiết bị Mobile qua chiều rộng viewport (< 768px)
  const isMobile = useThree((s) => s.size.width < 768)

  // Quản lý Pool cố định (10 trên Desktop, 5 trên Mobile)
  const pool = useDragonPool({ count, spawnInterval, speedRange, isMobile })

  // Bảng lưu refs của toàn bộ các DragonMaid con
  const handlesRef = useRef([])
  const audioStateRef = useRef({
    ctx: null,
    decodedBuffer: null,
    loading: false,
    fileFailed: false,
  })

  useEffect(() => {
    // Reset trạng thái cache nếu đổi đường dẫn file âm thanh
    audioStateRef.current.decodedBuffer = null
    audioStateRef.current.loading = false
    audioStateRef.current.fileFailed = false
  }, [audioSrc])

  const handleRegister = useCallback((slotIndex, handles) => {
    handlesRef.current[slotIndex] = handles
  }, [])

  /**
   * VÒNG LẶP DUY NHẤT (SINGLE CONSOLIDATED useFrame):
   * Điều phối hẹn giờ spawn, nội suy quỹ đạo, xoay hướng & nghiêng người, đập cánh,
   * cập nhật dải Trail ~80 units, 30 hạt Ember/instance, Motion Streaks & sự kiện Whoosh.
   */
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05) // Chống nhảy vọt khi chuyển tab
    const elapsed = state.clock.elapsedTime
    const camera = state.camera
    const camPos = camera.position
    const { slots, timer, spawnFromPool, nextIntervalSec, showcaseMode, swarmMode } = pool

    // 1. BỘ HẸN GIỜ SPAWN TỰ ĐỘNG (3 - 8 giây ngẫu nhiên, hoặc chế độ kiểm thử ?showcase / ?swarm)
    if (showcaseMode && !timer.showcaseInit) {
      timer.showcaseInit = true
      // Cá thể 0: Bay tầm gần bên trái khung hình (thấy rõ thân giáp iridescent, cánh dơi, sừng, đuôi & mắt #ffaa00)
      spawnFromPool(camera, {
        variantIndex: 0,
        scale: 1.48,
        speed: 340,
        initialProgress: 0.34,
        points: [
          new THREE.Vector3(camPos.x - 62, 9, camPos.z - 22),
          new THREE.Vector3(camPos.x - 14, 7.5, camPos.z - 12),
          new THREE.Vector3(camPos.x + 48, 28, camPos.z - 56),
        ],
      })
      if (slots.length > 1) {
        // Cá thể 1: Vệt bay siêu thanh Xanh-Cyan vút ngang bầu trời bên phải
        spawnFromPool(camera, {
          variantIndex: 1,
          scale: 1.38,
          speed: 390,
          initialProgress: 0.42,
          points: [
            new THREE.Vector3(camPos.x + 195, 88, camPos.z - 155),
            new THREE.Vector3(camPos.x + 28, 36, camPos.z - 48),
            new THREE.Vector3(camPos.x - 165, 62, camPos.z - 175),
          ],
        })
      }
      if (slots.length > 2) {
        // Cá thể 2: Biến thể Đỏ-Cam bay tầm cao trước dải Ngân Hà
        spawnFromPool(camera, {
          variantIndex: 2,
          scale: 1.3,
          speed: 325,
          initialProgress: 0.46,
          points: [
            new THREE.Vector3(camPos.x - 145, 118, camPos.z - 205),
            new THREE.Vector3(camPos.x + 12, 68, camPos.z - 105),
            new THREE.Vector3(camPos.x + 185, 44, camPos.z - 175),
          ],
        })
      }
    } else if (!showcaseMode) {
      timer.remaining -= dt
      if (swarmMode) {
        const activeCount = slots.reduce((acc, s) => acc + (s.active ? 1 : 0), 0)
        if (activeCount < Math.min(3, slots.length) && timer.remaining <= 0) {
          spawnFromPool(camera)
          timer.remaining = 0.6
        }
      } else if (timer.remaining <= 0) {
        spawnFromPool(camera)
        timer.remaining = nextIntervalSec()
      }
    }

    // 2. CẬP NHẬT TẤT CẢ INSTANCE TRONG POOL
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const h = handlesRef.current[i]
      if (!h || !h.rootRef.current) continue

      const root = h.rootRef.current
      const vfx = h.vfx

      if (!slot.active) {
        if (root.visible) {
          root.visible = false
          if (h.lightRef.current) h.lightRef.current.intensity = 0
          if (vfx.isMobile) vfx.mobileLine.visible = false
          else {
            vfx.ribbonMesh.visible = false
            vfx.streakLines.visible = false
            vfx.emberPoints.visible = false
          }
        }
        continue
      }

      // Khởi tạo trạng thái vật liệu & hạt ngay frame đầu tiên kích hoạt lại từ Pool
      if (slot.justSpawned) {
        slot.justSpawned = false
        root.visible = true
        root.scale.setScalar(slot.scale)

        // Áp biến thể màu cánh (Tím-Hồng / Xanh-Cyan / Đỏ-Cam) + giữ ánh phát sáng Cyan
        h.wingMaterial.color.set(slot.colorVariant.wingPrimary)
        h.wingMaterial.emissive.set(slot.colorVariant.emissiveCyan)

        if (h.lightRef.current) {
          h.lightRef.current.color.set('#00d4ff')
          h.lightRef.current.intensity = 2.0
        }

        if (vfx.isMobile) {
          vfx.lineMat.color.set(slot.colorVariant.wingPrimary)
          vfx.mobileLine.visible = true
        } else {
          vfx.ribbonMat.uniforms.uColorHead.value.set('#00d4ff')
          vfx.ribbonMat.uniforms.uColorMid.value.set(slot.colorVariant.wingPrimary)
          vfx.ribbonMesh.visible = true
          vfx.streakLines.visible = slot.speed > 300
          vfx.emberPoints.visible = true
          vfx.emberAge.fill(2.0)
          vfx.spawnAccum = 0
        }
      }

      // Tăng tiến độ bay (0 -> 1) dựa trên vận tốc (units/s) và tổng chiều dài đường cong
      if (showcaseMode) {
        slot.progress = Math.min(0.66, slot.progress + dt * 0.018)
      } else {
        slot.progress += (slot.speed * dt) / slot.curveLength
      }

      // Hoàn tất hành trình -> Tắt hiển thị và trả ngay về Pool để tái sử dụng
      if (slot.progress > 1.0) {
        slot.active = false
        root.visible = false
        if (h.lightRef.current) h.lightRef.current.intensity = 0
        if (vfx.isMobile) vfx.mobileLine.visible = false
        else {
          vfx.ribbonMesh.visible = false
          vfx.streakLines.visible = false
          vfx.emberPoints.visible = false
        }
        continue
      }

      // Đọc vị trí & vector tiếp tuyến từ bảng Precomputed LUT (không tính lại phương trình Bézier)
      samplePrecomputedCurve(slot, slot.progress, _pos, _tan)
      root.position.copy(_pos)

      // Hướng mặt theo tiếp tuyến quỹ đạo (tự động cập nhật rotation.y & độ chúc ngẩng)
      _lookTarget.copy(_pos).add(_tan)
      root.lookAt(_lookTarget)

      // Banking Roll: Nghiêng người theo độ gắt cua ngang (-tangent.x * 0.5)
      if (h.bankRef.current) {
        const targetRoll = -_tan.x * 0.5
        h.bankRef.current.rotation.z +=
          (targetRoll - h.bankRef.current.rotation.z) * Math.min(1, dt * 10)
      }

      // 3. CẬP NHẬT HOẠT ẢNH NHÂN VẬT (GLB Mixer / Sprite Sheet / Placeholder Flap & Sway)
      const speedRatio = THREE.MathUtils.clamp((slot.speed - 50) / 450, 0.15, 1.2)
      const flapFreq = 7.5 + speedRatio * 9.5
      const phase = elapsed * flapFreq + slot.flapPhase

      if (h.glbAnimRef.current) {
        // Nếu đã gắn model GLB: điều phối trạng thái idle -> flap -> dive -> fly-through
        const glb = h.glbAnimRef.current
        if (slot.speed < 90) transitionGLBAction(glb, 'idle')
        else if (_tan.y < -0.28 && slot.speed > 260) transitionGLBAction(glb, 'dive')
        else if (slot.speed > 360) transitionGLBAction(glb, 'flyThrough')
        else transitionGLBAction(glb, 'flap')
        glb.mixer.timeScale = 0.8 + speedRatio * 0.9
        glb.mixer.update(dt)
      } else if (h.spriteAnimRef.current) {
        // Nếu dùng Sprite Sheet: dịch chuyển ô UV theo nhịp đập cánh
        const sp = h.spriteAnimRef.current
        const frameIdx = Math.floor((elapsed * 14 * (0.6 + speedRatio)) % sp.totalFrames)
        sp.texture.offset.x = frameIdx / sp.totalFrames
      } else {
        // Mặc định Placeholder: Đập 2 cánh dơi bằng sóng sin trên rotation.z + vẫy đuôi rồng
        const flapAngle = Math.sin(phase) * 0.62
        if (h.wingLRef.current) h.wingLRef.current.rotation.z = -flapAngle
        if (h.wingRRef.current) h.wingRRef.current.rotation.z = flapAngle
        if (h.tailRef.current) {
          h.tailRef.current.rotation.y = Math.sin(phase * 0.75 - 0.8) * 0.22
          h.tailRef.current.rotation.x = Math.cos(phase * 0.5) * 0.12
        }
      }

      // 4. KIỂM TRA BAY SÁT CAMERA (< 5 UNITS) -> GỌI CALLBACK onWhoosh(side) & ÂM THANH
      const distToCam = _pos.distanceTo(camPos)
      if (!slot.whooshed && distToCam < 5.0) {
        slot.whooshed = true
        _camLocalPos.copy(_pos).applyMatrix4(camera.matrixWorldInverse)
        const side =
          Math.abs(_camLocalPos.x) < 1.2
            ? 'front'
            : _camLocalPos.x < 0
              ? 'left'
              : 'right'

        onWhoosh?.(side)
        if (enableAudio) {
          triggerWhooshSound(audioStateRef.current, audioSrc, side)
        }
      }

      // 5. CẬP NHẬT TRAIL (~80 UNITS PHÍA SAU), MOTION STREAKS & 30 HẠT EMBER
      // Đặt đầu dải Trail lùi nhẹ 1.6 units sau hông để không làm chói lấp silhouette cánh & thân giáp
      const headOffsetU = Math.min(slot.progress, (1.6 * slot.scale) / slot.curveLength)
      const trailHeadU = Math.max(0, slot.progress - headOffsetU)
      const trailSpanU = Math.min(trailHeadU, 80.0 / slot.curveLength)

      if (vfx.isMobile) {
        // Mobile: Dây Line đơn giản dọc 80 units phía sau
        const arr = vfx.linePos
        for (let s = 0; s < MOBILE_LINE_POINTS; s++) {
          const u = trailHeadU - (s / (MOBILE_LINE_POINTS - 1)) * trailSpanU
          samplePrecomputedCurve(slot, u, _trailPos, _trailTan)
          const idx = s * 3
          arr[idx] = _trailPos.x
          arr[idx + 1] = _trailPos.y
          arr[idx + 2] = _trailPos.z
        }
        vfx.lineGeo.attributes.position.needsUpdate = true
      } else {
        // Desktop 5a: Dải lụa Ribbon Trail (rộng 2-4 units tuỳ scale & tốc độ, dài ~80 units)
        const baseHalfWidth = (1.05 + speedRatio * 0.7) * slot.scale // tổng bề rộng ~2.1 -> 3.6 units
        const rVerts = vfx.ribbonVerts

        for (let s = 0; s < RIBBON_SEGMENTS; s++) {
          const ratio = s / (RIBBON_SEGMENTS - 1)
          const u = trailHeadU - ratio * trailSpanU
          samplePrecomputedCurve(slot, u, _trailPos, _trailTan)

          // Xoay mặt phẳng dải lụa luôn hướng về phía ống kính (camera-facing ribbon)
          _viewDir.subVectors(camPos, _trailPos).normalize()
          _sideVec.crossVectors(_trailTan, _viewDir)
          if (_sideVec.lengthSq() < 1e-5) _sideVec.set(1, 0, 0)
          else _sideVec.normalize()

          const w = baseHalfWidth * (1.0 - ratio * 0.72)
          const vIdx = s * 6
          rVerts[vIdx] = _trailPos.x + _sideVec.x * w
          rVerts[vIdx + 1] = _trailPos.y + _sideVec.y * w
          rVerts[vIdx + 2] = _trailPos.z + _sideVec.z * w

          rVerts[vIdx + 3] = _trailPos.x - _sideVec.x * w
          rVerts[vIdx + 4] = _trailPos.y - _sideVec.y * w
          rVerts[vIdx + 5] = _trailPos.z - _sideVec.z * w
        }
        vfx.ribbonGeo.attributes.position.needsUpdate = true
        vfx.ribbonMat.uniforms.uOpacity.value =
          Math.min(1, slot.progress * 8.0) * (1.0 - Math.pow(slot.progress, 8.0)) * 0.78

        // Desktop 5b: Motion Streaks (4 vệt sáng dọc quỹ đạo khi vận tốc > 300 units/s)
        if (slot.speed > 300) {
          vfx.streakLines.visible = true
          const streakSpanU = Math.min(slot.progress, 34.0 / slot.curveLength)
          const sArr = vfx.streakPos
          let writeIdx = 0

          for (let k = 0; k < STREAK_COUNT; k++) {
            const [ox, oy] = vfx.streakOffsets[k]
            for (let seg = 0; seg < STREAK_SEGMENTS - 1; seg++) {
              const u0 = slot.progress - (seg / (STREAK_SEGMENTS - 1)) * streakSpanU
              const u1 = slot.progress - ((seg + 1) / (STREAK_SEGMENTS - 1)) * streakSpanU

              samplePrecomputedCurve(slot, u0, _trailPos, _trailTan)
              _sideVec.crossVectors(_trailTan, _worldUp)
              if (_sideVec.lengthSq() < 1e-5) _sideVec.set(1, 0, 0)
              else _sideVec.normalize()
              _upVec.crossVectors(_sideVec, _trailTan).normalize()

              sArr[writeIdx++] =
                _trailPos.x + (_sideVec.x * ox + _upVec.x * oy) * slot.scale
              sArr[writeIdx++] =
                _trailPos.y + (_sideVec.y * ox + _upVec.y * oy) * slot.scale
              sArr[writeIdx++] =
                _trailPos.z + (_sideVec.z * ox + _upVec.z * oy) * slot.scale

              samplePrecomputedCurve(slot, u1, _trailPos, _trailTan)
              sArr[writeIdx++] =
                _trailPos.x + (_sideVec.x * ox + _upVec.x * oy) * slot.scale
              sArr[writeIdx++] =
                _trailPos.y + (_sideVec.y * ox + _upVec.y * oy) * slot.scale
              sArr[writeIdx++] =
                _trailPos.z + (_sideVec.z * ox + _upVec.z * oy) * slot.scale
            }
          }
          vfx.streakGeo.attributes.position.needsUpdate = true
        } else {
          vfx.streakLines.visible = false
        }

        // Desktop 5c: 30 Hạt tàn lửa Ember rơi từ hai cánh (#ffaa00 -> #ff0044, lifetime 1.0s)
        vfx.spawnAccum += dt * 30.0 // Duy trì luồng 30 hạt/giây khớp với vòng đời 1.0s
        while (vfx.spawnAccum >= 1.0) {
          vfx.spawnAccum -= 1.0
          const pIdx = vfx.emberCursor
          vfx.emberCursor = (vfx.emberCursor + 1) % EMBERS_PER_INSTANCE
          const p3 = pIdx * 3

          // Phát hạt xen kẽ từ sải cánh trái và phải
          const wingSign = pIdx % 2 === 0 ? -1 : 1
          _sideVec.crossVectors(_tan, _worldUp)
          if (_sideVec.lengthSq() < 1e-5) _sideVec.set(1, 0, 0)
          else _sideVec.normalize()

          const wingOffset = wingSign * (1.4 + Math.random() * 1.8) * slot.scale
          _wingWorldPos.copy(_pos).addScaledVector(_sideVec, wingOffset)

          vfx.emberPos[p3] = _wingWorldPos.x + (Math.random() - 0.5) * 0.6
          vfx.emberPos[p3 + 1] = _wingWorldPos.y + (Math.random() - 0.5) * 0.5
          vfx.emberPos[p3 + 2] = _wingWorldPos.z + (Math.random() - 0.5) * 0.6

          // Vận tốc rơi: trôi nhẹ theo quán tính cánh + rơi xuống do trọng lực
          vfx.emberVel[p3] = _tan.x * slot.speed * 0.06 + (Math.random() - 0.5) * 6.0
          vfx.emberVel[p3 + 1] = -3.5 - Math.random() * 6.5
          vfx.emberVel[p3 + 2] = _tan.z * slot.speed * 0.06 + (Math.random() - 0.5) * 6.0
          vfx.emberAge[pIdx] = 0.0
        }

        for (let p = 0; p < EMBERS_PER_INSTANCE; p++) {
          if (vfx.emberAge[p] >= 1.0) continue
          vfx.emberAge[p] += dt // Đúng 1.0 giây vòng đời
          const p3 = p * 3
          vfx.emberPos[p3] += vfx.emberVel[p3] * dt
          vfx.emberPos[p3 + 1] += vfx.emberVel[p3 + 1] * dt
          vfx.emberPos[p3 + 2] += vfx.emberVel[p3 + 2] * dt
          vfx.emberVel[p3 + 1] -= 4.5 * dt
        }
        vfx.emberGeo.attributes.position.needsUpdate = true
        vfx.emberGeo.attributes.aAge.needsUpdate = true
      }
    }

    // Callback tuỳ chọn nếu Scene cha muốn đồng bộ toạ độ thực thể với shader mây/sương mù riêng
    if (onActivePositionsChange) {
      onActivePositionsChange(slots)
    }
  })

  return (
    <group name="DragonMaidsPool">
      {pool.slots.map((slot) => (
        <DragonMaid
          key={slot.index}
          slotIndex={slot.index}
          isMobile={isMobile}
          modelUrl={modelUrl}
          spriteSheetUrl={spriteSheetUrl}
          spriteFrames={spriteFrames}
          onRegister={handleRegister}
        />
      ))}
    </group>
  )
}
