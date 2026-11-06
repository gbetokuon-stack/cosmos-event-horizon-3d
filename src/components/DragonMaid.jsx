import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useTexture } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildDragonPlaceholderGeometries } from './buildDragonPlaceholder'

/**
 * ============================================================================
 * COMPONENT ĐƠN LẺ CHO 1 INSTANCE TRONG POOL (DragonMaid.jsx)
 * ============================================================================
 * Đặc điểm kiến trúc:
 *  - KHÔNG gọi useFrame riêng lẻ bên trong component này. Toàn bộ refs được
 *    đăng ký lên component cha `DragonMaids.jsx` để cập nhật tập trung trong
 *    1 vòng lặp useFrame duy nhất (đảm bảo 60fps mượt mà).
 *  - Hỗ trợ 3 chế độ hiển thị:
 *    1. Mặc định: Placeholder PBR Dark-Fantasy (Capsule 2u + Cánh dơi/rồng + Sừng + Đuôi + Mắt)
 *    2. GLB thực tế (`modelUrl`): Clone SkinnedMesh bằng SkeletonUtils + AnimationMixer
 *    3. Sprite Sheet (`spriteSheetUrl`): Lật frame hoạt ảnh 8-12 khung hình trên Sprite
 */

export const RIBBON_SEGMENTS = 26
export const MOBILE_LINE_POINTS = 14
export const EMBERS_PER_INSTANCE = 30
export const STREAK_COUNT = 4
export const STREAK_SEGMENTS = 8

// Shader cho dải lụa Trail phía sau (~80 units, gradient Cyan/Variant -> Trong suốt, Additive)
const trailVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const trailFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColorHead; // Cyan (#00d4ff) ở sát thân/cánh
  uniform vec3 uColorMid;  // Biến thể màu cánh ở thân vệt sáng
  uniform float uOpacity;

  void main() {
    // vUv.x = 0 tại vị trí thực thể -> 1 tại cuối đuôi dài ~80 units (mờ dần về 0)
    float along = clamp(1.0 - vUv.x, 0.0, 1.0);
    float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
    float core = pow(max(edge, 0.0), 2.2) * pow(along, 1.45);
    float halo = pow(max(edge, 0.0), 0.85) * pow(along, 2.2) * 0.45;

    vec3 col = mix(uColorMid, uColorHead, pow(along, 0.65));
    col += vec3(0.85, 0.97, 1.0) * pow(core, 2.0) * 0.6;

    float alpha = (core + halo) * uOpacity;
    gl_FragColor = vec4(col * 1.35, alpha);
  }
`

// Shader cho 30 hạt tàn lửa Ember rơi từ cánh (#ffaa00 -> #ff0044, lifetime 1s, Additive)
const emberVertexShader = /* glsl */ `
  attribute float aAge;
  attribute float aSeed;
  varying float vLifeRatio;

  void main() {
    // aAge chạy từ 0 (mới sinh) -> 1 (tắt hẳn sau 1.0s)
    vLifeRatio = clamp(1.0 - aAge, 0.0, 1.0);
    if (vLifeRatio <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float baseSize = (3.5 + aSeed * 3.5) * (0.45 + 0.55 * vLifeRatio);
    gl_PointSize = clamp(baseSize * (140.0 / max(-mvPosition.z, 1.0)), 1.5, 24.0);
  }
`

const emberFragmentShader = /* glsl */ `
  precision highp float;
  varying float vLifeRatio;

  void main() {
    if (vLifeRatio <= 0.001) discard;
    float dist = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (dist > 1.0) discard;

    float spark = exp(-dist * dist * 5.5);
    // Chuyển màu từ Hổ phách rực (#ffaa00) sang Đỏ thẫm (#ff0044) khi hạt nguội dần
    vec3 hotAmber = vec3(1.0, 0.667, 0.0);
    vec3 coolCrimson = vec3(1.0, 0.0, 0.267);
    vec3 col = mix(coolCrimson, hotAmber, pow(vLifeRatio, 0.75));
    col += vec3(1.0, 0.95, 0.8) * pow(spark, 3.0) * vLifeRatio * 0.7;

    gl_FragColor = vec4(col * 1.8, spark * vLifeRatio);
  }
`

/**
 * Nhánh thay thế 1: Tải mô hình GLB thật (SkinnedMesh + AnimationMixer)
 * Hỗ trợ chu trình clip: idle -> flap -> dive -> fly-through
 */
function GLBDragonSubModel({ modelUrl, onMixerReady }) {
  const gltf = useGLTF(modelUrl)

  const { clonedScene, mixer, actions } = useMemo(() => {
    // Dùng SkeletonUtils.clone để mỗi cá thể trong Pool có bộ xương SkinnedMesh độc lập
    const scene = SkeletonUtils.clone(gltf.scene)
    scene.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = true
      }
    })

    const animMixer = new THREE.AnimationMixer(scene)
    const clipMap = {}
    gltf.animations.forEach((clip) => {
      const name = clip.name.toLowerCase()
      const action = animMixer.clipAction(clip)
      if (name.includes('idle')) clipMap.idle = action
      else if (name.includes('dive')) clipMap.dive = action
      else if (name.includes('fly') || name.includes('glide')) clipMap.flyThrough = action
      else if (name.includes('flap') || name.includes('wing')) clipMap.flap = action
      // Fallback lấy clip đầu tiên nếu tên trong Blender đặt khác chuẩn
      if (!clipMap.default) clipMap.default = action
    })

    const startAction = clipMap.flap || clipMap.default
    if (startAction) startAction.play()

    return { clonedScene: scene, mixer: animMixer, actions: clipMap }
  }, [gltf])

  useEffect(() => {
    onMixerReady?.({ mixer, actions, activeKey: 'flap' })
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, actions, onMixerReady])

  return <primitive object={clonedScene} />
}

/**
 * Nhánh thay thế 2: Hiển thị bằng Sprite Sheet PBR (8 - 12 frame render sẵn từ Blender)
 */
function SpriteSheetDragonSubModel({ spriteSheetUrl, spriteFrames = 10, onSpriteReady }) {
  const baseTex = useTexture(spriteSheetUrl)

  const instanceTex = useMemo(() => {
    const tex = baseTex.clone()
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.repeat.set(1 / spriteFrames, 1)
    tex.needsUpdate = true
    return tex
  }, [baseTex, spriteFrames])

  useEffect(() => {
    onSpriteReady?.({ texture: instanceTex, totalFrames: spriteFrames })
    return () => instanceTex.dispose()
  }, [instanceTex, spriteFrames, onSpriteReady])

  return (
    <sprite scale={[7.5, 5.5, 1]}>
      <spriteMaterial map={instanceTex} transparent depthWrite={false} />
    </sprite>
  )
}

/**
 * Component biểu diễn 1 Dragon Maid trong Pool
 */
export default function DragonMaid({
  slotIndex,
  isMobile,
  modelUrl = null,
  spriteSheetUrl = null,
  spriteFrames = 10,
  onRegister,
}) {
  const rootRef = useRef(null)
  const bankRef = useRef(null)
  const wingLRef = useRef(null)
  const wingRRef = useRef(null)
  const tailRef = useRef(null)
  const lightRef = useRef(null)
  const glbAnimRef = useRef(null)
  const spriteAnimRef = useRef(null)

  // Khởi tạo bộ hình học Placeholder dùng chung (chỉ build 1 lần duy nhất cho cả 10 instance)
  const shared = useMemo(() => buildDragonPlaceholderGeometries(), [])

  // Vật liệu Cánh Dơi/Rồng riêng cho từng instance để đổi biến thể màu (Tím-Hồng / Xanh-Cyan / Đỏ-Cam)
  // Chuẩn thông số: DoubleSide, emissive cyan (#00d4ff) intensity 0.5, opacity 0.85
  const wingMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#8b00ff'),
        emissive: new THREE.Color('#00d4ff'),
        emissiveIntensity: 0.5,
        metalness: 0.78,
        roughness: 0.28,
        iridescence: 0.9,
        iridescenceIOR: 1.5,
        bumpMap: shared.scaleTex,
        bumpScale: 0.025,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [shared.scaleTex],
  )

  // Khởi tạo toàn bộ BufferGeometry tĩnh cho Trail, Motion Streaks & Ember Particles (không tạo lại khi chạy)
  const vfx = useMemo(() => {
    if (isMobile) {
      // MOBILE MODE: Tắt Ribbon phức tạp & Ember, dùng Line đơn giản nhẹ GPU
      const linePos = new Float32Array(MOBILE_LINE_POINTS * 3)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#00d4ff'),
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      })
      const mobileLine = new THREE.Line(lineGeo, lineMat)
      mobileLine.visible = false
      mobileLine.frustumCulled = false
      return { isMobile: true, mobileLine, linePos, lineGeo, lineMat }
    }

    // DESKTOP MODE:
    // 1. Dải lụa Ribbon Trail dài ~80 units, rộng 2-4 units
    const ribbonVerts = new Float32Array(RIBBON_SEGMENTS * 2 * 3)
    const ribbonUvs = new Float32Array(RIBBON_SEGMENTS * 2 * 2)
    const ribbonIndices = []
    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      const u = i / (RIBBON_SEGMENTS - 1)
      ribbonUvs[i * 4] = u
      ribbonUvs[i * 4 + 1] = 0
      ribbonUvs[i * 4 + 2] = u
      ribbonUvs[i * 4 + 3] = 1
      if (i < RIBBON_SEGMENTS - 1) {
        const a = i * 2
        ribbonIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const ribbonGeo = new THREE.BufferGeometry()
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonVerts, 3))
    ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(ribbonUvs, 2))
    ribbonGeo.setIndex(ribbonIndices)

    const ribbonMat = new THREE.ShaderMaterial({
      vertexShader: trailVertexShader,
      fragmentShader: trailFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColorHead: { value: new THREE.Color('#00d4ff') },
        uColorMid: { value: new THREE.Color('#8b00ff') },
        uOpacity: { value: 0.85 },
      },
    })
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat)
    ribbonMesh.visible = false
    ribbonMesh.frustumCulled = false
    ribbonMesh.renderOrder = 6

    // 2. Motion Streaks (4 vệt sáng xé gió song song dọc quỹ đạo khi speed > 300)
    const streakVertCount = STREAK_COUNT * (STREAK_SEGMENTS - 1) * 2
    const streakPos = new Float32Array(streakVertCount * 3)
    const streakGeo = new THREE.BufferGeometry()
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3))
    const streakMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#bdf6ff'),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const streakLines = new THREE.LineSegments(streakGeo, streakMat)
    streakLines.visible = false
    streakLines.frustumCulled = false
    streakLines.renderOrder = 7

    // Độ lệch tương đối của 4 tia Motion Streak quanh sải cánh & thân
    const streakOffsets = [
      [-3.1, 0.35],
      [3.1, 0.35],
      [-1.5, -0.45],
      [1.5, -0.45],
    ]

    // 3. Ember Particles: Đúng 30 hạt/instance rơi từ cánh (#ffaa00 -> #ff0044, lifetime 1.0s)
    const emberPos = new Float32Array(EMBERS_PER_INSTANCE * 3)
    const emberVel = new Float32Array(EMBERS_PER_INSTANCE * 3)
    const emberAge = new Float32Array(EMBERS_PER_INSTANCE).fill(2.0) // > 1.0 = đang nghỉ
    const emberSeed = new Float32Array(EMBERS_PER_INSTANCE)
    for (let i = 0; i < EMBERS_PER_INSTANCE; i++) emberSeed[i] = Math.random()

    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
    emberGeo.setAttribute('aAge', new THREE.BufferAttribute(emberAge, 1))
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeed, 1))

    const emberMat = new THREE.ShaderMaterial({
      vertexShader: emberVertexShader,
      fragmentShader: emberFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const emberPoints = new THREE.Points(emberGeo, emberMat)
    emberPoints.visible = false
    emberPoints.frustumCulled = false
    emberPoints.renderOrder = 8

    return {
      isMobile: false,
      ribbonMesh,
      ribbonGeo,
      ribbonMat,
      ribbonVerts,
      streakLines,
      streakGeo,
      streakMat,
      streakPos,
      streakOffsets,
      emberPoints,
      emberGeo,
      emberPos,
      emberVel,
      emberAge,
      emberCursor: 0,
      spawnAccum: 0,
    }
  }, [isMobile])

  // Đăng ký toàn bộ tham chiếu (refs) của instance này lên DragonMaids.jsx
  useEffect(() => {
    onRegister(slotIndex, {
      rootRef,
      bankRef,
      wingLRef,
      wingRRef,
      tailRef,
      lightRef,
      wingMaterial,
      glbAnimRef,
      spriteAnimRef,
      vfx,
    })
    return () => onRegister(slotIndex, null)
  }, [slotIndex, wingMaterial, vfx, onRegister])

  return (
    <>
      {/* Nhóm thực thể chính: Frustum Culling bật, xoay hướng bay bằng lookAt + banking roll */}
      <group ref={rootRef} visible={false}>
        {/* PointLight cyan hắt sáng lên mây/nebula xung quanh (intensity 2, distance 50 khi active) */}
        <pointLight
          ref={lightRef}
          color="#00d4ff"
          intensity={0}
          distance={50}
          decay={2}
          position={[0, 0.5, 0.8]}
        />

        {/* Lớp nghiêng người khí động học (banking roll quanh trục bay Z) */}
        <group ref={bankRef}>
          {modelUrl ? (
            <GLBDragonSubModel
              modelUrl={modelUrl}
              onMixerReady={(data) => {
                glbAnimRef.current = data
              }}
            />
          ) : spriteSheetUrl ? (
            <SpriteSheetDragonSubModel
              spriteSheetUrl={spriteSheetUrl}
              spriteFrames={spriteFrames}
              onSpriteReady={(data) => {
                spriteAnimRef.current = data
              }}
            />
          ) : (
            /* PLACEHOLDER DARK-FANTASY AAA WARRIOR (+Z hướng bay tới trước, +Y hướng lên trời, +X sang phải) */
            <group>
              {/* Body: Capsule cao 2.0 units nghiêng khí động học về phía trước, PBR metalness 0.8, roughness 0.3, iridescent #2a1a4a -> #4a2a6a */}
              <mesh
                rotation={[Math.PI * 0.44, 0, 0]}
                geometry={shared.bodyGeo}
                material={shared.bodyMat}
                frustumCulled
              />

              {/* Wings: 2 cánh dơi/rồng DoubleSide, emissive cyan intensity 0.5, opacity 0.85, đập cánh bằng rotation.z */}
              <mesh
                ref={wingLRef}
                position={[-0.16, 0.12, 0.34]}
                geometry={shared.wingLeftGeo}
                material={wingMaterial}
                frustumCulled
              />
              <mesh
                ref={wingRRef}
                position={[0.16, 0.12, 0.34]}
                geometry={shared.wingRightGeo}
                material={wingMaterial}
                frustumCulled
              />

              {/* Horns: 2 sừng nhọn đen bóng trên đỉnh đầu */}
              <mesh
                position={[-0.08, 0.24, 0.78]}
                geometry={shared.hornLeftGeo}
                material={shared.hornMat}
                frustumCulled
              />
              <mesh
                position={[0.08, 0.24, 0.78]}
                geometry={shared.hornRightGeo}
                material={shared.hornMat}
                frustumCulled
              />

              {/* Eyes: 2 cầu mắt phát sáng hổ phách (#ffaa00) intensity 3.0 */}
              <mesh
                position={[-0.062, 0.11, 0.96]}
                geometry={shared.eyeGeo}
                material={shared.eyeMat}
                frustumCulled
              />
              <mesh
                position={[0.062, 0.11, 0.96]}
                geometry={shared.eyeGeo}
                material={shared.eyeMat}
                frustumCulled
              />

              {/* Tail: Đuôi rồng TubeGeometry cong nhẹ kéo dài về sau (-Z), animate sway */}
              <mesh
                ref={tailRef}
                position={[0, -0.10, -0.62]}
                geometry={shared.tailGeo}
                material={shared.bodyMat}
                frustumCulled
              />
            </group>
          )}
        </group>
      </group>

      {/* Các hiệu ứng không gian thế giới (World-space Trails, Motion Streaks & Embers) */}
      {vfx.isMobile ? (
        <primitive object={vfx.mobileLine} />
      ) : (
        <>
          <primitive object={vfx.ribbonMesh} />
          <primitive object={vfx.streakLines} />
          <primitive object={vfx.emberPoints} />
        </>
      )}
    </>
  )
}
