import * as THREE from 'three'
import { HOLE } from '../constants'
import {
  wingVert,
  wingFrag,
  lodSpriteVert,
  lodSpriteFrag,
  charPbrVert,
  charPbrFrag,
} from '../shaders/dragonMaid'

/**
 * Bảng phối màu vảy rồng tráng gương (Iridescent Dark-Fantasy Palettes)
 * Tuyệt đối tuân thủ phong cách điện ảnh tối cổ (House of the Dragon / Elden Ring)
 */
export const WING_PALETTES = [
  {
    name: 'AmethystJade',
    base: [0.24, 0.06, 0.42], // Tím obsidian sẫm
    iridA: [0.0, 0.78, 0.88], // Xanh cyan tráng gương
    iridB: [0.05, 0.85, 0.58], // Ngọc lục bảo (emerald jade)
  },
  {
    name: 'AbyssalSapphire',
    base: [0.04, 0.14, 0.38], // Xanh đại dương thẳm
    iridA: [0.0, 0.85, 1.0], // Xanh băng giá
    iridB: [0.46, 0.22, 0.88], // Tím hoàng gia
  },
  {
    name: 'CrimsonObsidian',
    base: [0.36, 0.04, 0.08], // Đỏ huyết ngọc sẫm
    iridA: [0.95, 0.42, 0.06], // Cam lửa rồng
    iridB: [0.55, 0.12, 0.68], // Tím khói sẫm
  },
]

export const EYE_PALETTES = [
  { name: 'Cyan', hdr: [0.08, 2.35, 2.95], hex: '#00f0ff', light: [0.0, 0.88, 1.0] },
  { name: 'Amber', hdr: [2.95, 1.65, 0.12], hex: '#ffaa00', light: [1.0, 0.62, 0.12] },
]

/**
 * Dựng hình học màng cánh ngoài có 4 ngón xương rồng xoè rộng & đường viền võng (scalloped bat/dragon wing)
 * side = +1 (cánh phải +X) hoặc -1 (cánh trái -X)
 */
function createOuterWingMembraneGeometry(side = 1) {
  // Cổ tay tại gốc (0,0,0), 4 ngón xương rồng xoè rộng & vuốt cong khí động học về -Z
  const fingers = [
    new THREE.Vector3(side * 2.95, 0.12, 0.30), // Ngón dẫn hướng (leading edge)
    new THREE.Vector3(side * 2.72, 0.04, -0.58), // Ngón 2
    new THREE.Vector3(side * 2.05, -0.04, -1.36), // Ngón 3
    new THREE.Vector3(side * 1.15, -0.08, -1.68), // Ngón 4
    new THREE.Vector3(0.0, -0.06, -1.14), // Khớp nối rìa sau màng cánh trong
  ]

  const radialSegs = 8
  const webSegs = 6
  const positions = []
  const uvs = []
  const membranes = []
  const indices = []

  // Tạo lưới giữa từng cặp ngón liền kề (4 khoang màng da có cung võng catenary ở rìa sau)
  for (let w = 0; w < fingers.length - 1; w++) {
    const fA = fingers[w]
    const fB = fingers[w + 1]
    const baseIdx = positions.length / 3

    for (let iu = 0; iu <= webSegs; iu++) {
      const u = iu / webSegs // 0 ở xương ngón A -> 1 ở xương ngón B
      const distFromSpar = Math.sin(u * Math.PI) // 0 trên xương ngón, 1 ở giữa màng da
      for (let iv = 0; iv <= radialSegs; iv++) {
        const v = iv / radialSegs // 0 ở cổ tay -> 1 ở rìa sau cánh
        const endPt = new THREE.Vector3().lerpVectors(fA, fB, u)
        // Khoét cung võng tự nhiên ở rìa sau giữa 2 ngón cánh rồng
        const scallop = 1.0 - 0.22 * distFromSpar * Math.pow(v, 1.5)
        const px = endPt.x * v * scallop
        const py = endPt.y * v + distFromSpar * v * 0.08
        const pz = endPt.z * v * scallop - distFromSpar * Math.pow(v, 1.4) * 0.14

        positions.push(px, py, pz)
        uvs.push((w + u) / (fingers.length - 1), v)
        membranes.push(distFromSpar * Math.min(1, v * 1.4))
      }
    }

    const stride = radialSegs + 1
    for (let iu = 0; iu < webSegs; iu++) {
      for (let iv = 0; iv < radialSegs; iv++) {
        const a = baseIdx + iu * stride + iv
        const b = a + 1
        const c = a + stride
        const d = c + 1
        if (side > 0) {
          indices.push(a, b, c, b, d, c)
        } else {
          indices.push(a, c, b, b, c, d)
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('aMembrane', new THREE.Float32BufferAttribute(membranes, 1))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return { geo, fingers }
}

/** Dựng màng cánh trong (từ bả vai ra cổ tay x = ±1.55, vát gọn về lưng trên z = -0.44 để lộ rõ thân giáp & đuôi rồng) */
function createInnerWingMembraneGeometry(side = 1) {
  const wrist = new THREE.Vector3(side * 1.55, 0.08, 0.28)
  const wristBack = new THREE.Vector3(side * 1.55, 0.02, -0.86)
  const shoulder = new THREE.Vector3(0, 0.06, 0.24)
  const midBack = new THREE.Vector3(0, 0.02, -0.44)

  const segX = 8
  const segZ = 7
  const positions = []
  const uvs = []
  const membranes = []
  const indices = []

  for (let ix = 0; ix <= segX; ix++) {
    const u = ix / segX
    const front = new THREE.Vector3().lerpVectors(shoulder, wrist, u)
    const back = new THREE.Vector3().lerpVectors(midBack, wristBack, u)
    for (let iz = 0; iz <= segZ; iz++) {
      const v = iz / segZ
      const p = new THREE.Vector3().lerpVectors(front, back, v)
      const arch = Math.sin(u * Math.PI) * Math.pow(v, 1.5) * 0.26
      p.z += arch
      p.y += Math.sin(v * Math.PI) * 0.08
      positions.push(p.x, p.y, p.z)
      uvs.push(u * 0.45, v)
      membranes.push(smoothStep(0.08, 0.5, v))
    }
  }

  const stride = segZ + 1
  for (let ix = 0; ix < segX; ix++) {
    for (let iz = 0; iz < segZ; iz++) {
      const a = ix * stride + iz
      const b = a + 1
      const c = a + stride
      const d = c + 1
      if (side > 0) indices.push(a, b, c, b, d, c)
      else indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('aMembrane', new THREE.Float32BufferAttribute(membranes, 1))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function smoothStep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Dựng SkinnedMesh Đuôi Rồng dài 6 đốt xương (Skeleton + Vertex Skinning thật) */
function createSkinnedTailGeometry() {
  const length = 4.6
  const segs = 24
  const radSegs = 8
  const boneCount = 6
  const segLen = length / (boneCount - 1)

  const cyl = new THREE.CylinderGeometry(0.16, 0.025, length, radSegs, segs, false)
  // Xoay dọc theo trục -Z (gốc đuôi ở z = 0, chóp đuôi ở z = -length)
  cyl.rotateX(Math.PI / 2)
  cyl.translate(0, 0, -length / 2)

  const pos = cyl.attributes.position
  const skinIndices = []
  const skinWeights = []

  // Tạo gờ gai lưng rồng (dorsal ridge) dọc sống lưng trên (y > 0)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const dist = Math.max(0, -z)
    const t = dist / length

    // Gai sừng nhô dọc sống lưng và vây chóp đuôi hình mũi giáo ở cuối
    if (y > 0.02 && Math.abs(x) < 0.06) {
      const spike = Math.pow(Math.abs(Math.sin(dist * 5.5)), 2.5) * 0.14 * (1 - t * 0.55)
      pos.setY(i, y + spike)
    }
    if (t > 0.84) {
      const spade = Math.sin(((t - 0.84) / 0.16) * Math.PI) * 0.24
      pos.setX(i, x + Math.sign(x || 1) * spade)
    }

    const boneFloat = Math.min(boneCount - 1.001, dist / segLen)
    const b0 = Math.floor(boneFloat)
    const b1 = Math.min(boneCount - 1, b0 + 1)
    const w1 = boneFloat - b0
    const w0 = 1 - w1
    skinIndices.push(b0, b1, 0, 0)
    skinWeights.push(w0, w1, 0, 0)
  }

  cyl.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  cyl.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
  cyl.computeVertexNormals()
  return { tailGeo: cyl, boneCount, segLen }
}

/** Dựng cặp sừng rồng uốn cong có ngấn keratin tự nhiên */
function createHornGeometry(side = 1) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.16, 0.14, 0.04),
    new THREE.Vector3(side * 0.30, 0.34, -0.16),
    new THREE.Vector3(side * 0.38, 0.52, -0.48),
    new THREE.Vector3(side * 0.28, 0.68, -0.82),
  ])
  const geo = new THREE.TubeGeometry(curve, 18, 0.055, 8, false)
  const pos = geo.attributes.position
  const center = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / 9)
    const t = ringIdx / 18
    curve.getPointAt(t, center)
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center)
    // Vuốt nhọn dần về chóp sừng + ngấn gờ sừng rồng
    const ridge = 1 + 0.12 * Math.sin(t * 42.0) * (1 - t)
    const taper = Math.max(0.06, (1 - Math.pow(t, 0.85)) * ridge)
    v.multiplyScalar(taper).add(center)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

/** Dựng hình học thân giáp nữ chiến binh tỉ lệ người thật 1:7.5 (Lathe + nén giải phẫu) */
function createTorsoArmorGeometry() {
  const profile = [
    new THREE.Vector2(0.01, -0.62),
    new THREE.Vector2(0.24, -0.55), // Hông giáp
    new THREE.Vector2(0.17, -0.18), // Eo thon gọn chiến binh
    new THREE.Vector2(0.25, 0.22), // Giáp ngực (cuirass)
    new THREE.Vector2(0.21, 0.42), // Vai
    new THREE.Vector2(0.11, 0.52), // Cổ áo giáp cao (gorget)
    new THREE.Vector2(0.12, 0.60),
  ]
  const geo = new THREE.LatheGeometry(profile, 20)
  // Xoay dọc theo trục bay +Z (đầu hướng +Z, chân hướng -Z) và nén chiều dày trước-sau chuẩn giải phẫu người
  geo.scale(1.0, 1.0, 0.68)
  geo.rotateX(Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

/** Dựng khối đầu người thật với ánh xạ UV trực diện cho khuôn mặt photorealistic */
function createRealisticHeadGeometry() {
  const geo = new THREE.SphereGeometry(0.21, 24, 20)
  // Kéo nhẹ tỷ lệ hộp sọ người thật: cao 1.18, hẹp hai bên thái dương 0.88
  geo.scale(0.88, 1.02, 1.16)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // Mặt hướng về phía trước (+Z trong hệ tọa độ bay, hơi ngẩng nhìn hướng bay)
    // Ánh xạ planar UV mặt trước lên vùng chân dung của face_albedo.jpg
    if (y < 0 && z > -0.05) {
      const uFace = 0.5 + (x / 0.20) * 0.30
      const vFace = 0.52 + (z / 0.24) * 0.34
      uv.setXY(i, Math.max(0.12, Math.min(0.88, uFace)), Math.max(0.12, Math.min(0.88, vFace)))
    } else {
      // Vùng tóc tết phía sau hộp sọ lấy vùng tóc tối trên đỉnh ảnh
      uv.setXY(i, 0.5 + x * 0.8, 0.88)
    }
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Tải & khởi tạo bộ tài nguyên hình học + PBR textures dùng chung cho toàn bộ Object Pool
 */
export function createSharedDragonAssets() {
  const loader = new THREE.TextureLoader()
  const faceTex = loader.load('/textures/face_albedo.jpg')
  faceTex.colorSpace = THREE.SRGBColorSpace

  const armorTex = loader.load('/textures/armor_brocade.jpg')
  armorTex.colorSpace = THREE.SRGBColorSpace
  armorTex.wrapS = armorTex.wrapT = THREE.RepeatWrapping
  armorTex.repeat.set(2, 2)

  const scaleTex = loader.load('/textures/wing_scales.jpg')
  scaleTex.wrapS = scaleTex.wrapT = THREE.RepeatWrapping

  const torsoGeo = createTorsoArmorGeometry()
  const headGeo = createRealisticHeadGeometry()
  const hornLGeo = createHornGeometry(-1)
  const hornRGeo = createHornGeometry(1)

  const innerWingL = createInnerWingMembraneGeometry(-1)
  const innerWingR = createInnerWingMembraneGeometry(1)
  const outerWingL = createOuterWingMembraneGeometry(-1)
  const outerWingR = createOuterWingMembraneGeometry(1)

  // Xương sườn cánh rồng (arm spars & finger bones)
  const humerusLGeo = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, 0.06, 0.24), new THREE.Vector3(-1.55, 0.08, 0.28)),
    8,
    0.055,
    6,
    false,
  )
  const humerusRGeo = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, 0.06, 0.24), new THREE.Vector3(1.55, 0.08, 0.28)),
    8,
    0.055,
    6,
    false,
  )

  const makeFingerSpars = (fingers) => {
    const group = []
    fingers.slice(0, 4).forEach((tip, idx) => {
      const r = idx === 0 ? 0.045 : 0.026
      group.push(
        new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), tip), 6, r, 5, false),
      )
    })
    return group
  }

  const fingerSparsL = makeFingerSpars(outerWingL.fingers)
  const fingerSparsR = makeFingerSpars(outerWingR.fingers)

  // Vạt áo giáp lụa đen thêu vàng bay phía sau (modest battle coat-tails)
  const skirtPanelGeo = new THREE.PlaneGeometry(0.36, 1.85, 4, 8)
  skirtPanelGeo.rotateX(Math.PI / 2)
  skirtPanelGeo.translate(0, 0, -0.92)
  // Uốn cong nhẹ ôm hông chiến binh
  const sp = skirtPanelGeo.attributes.position
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i)
    const z = sp.getZ(i)
    sp.setY(i, -0.06 - Math.pow(x * 2.2, 2) * 0.08 + Math.sin(z * 2.0) * 0.03)
  }
  skirtPanelGeo.computeVertexNormals()

  // Giáp vai (pauldrons), tay & chân tỷ lệ người thật
  const pauldronGeo = new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58)
  const limbGeo = new THREE.CylinderGeometry(0.065, 0.048, 0.92, 8)
  limbGeo.rotateX(Math.PI / 2)
  limbGeo.translate(0, 0, -0.46)

  const legGeo = new THREE.CylinderGeometry(0.088, 0.052, 1.38, 10)
  legGeo.rotateX(Math.PI / 2)
  legGeo.translate(0, 0, -0.69)

  const eyeGeo = new THREE.SphereGeometry(0.026, 8, 8)
  const goldCollarGeo = new THREE.TorusGeometry(0.155, 0.022, 8, 24)
  const beltGoldGeo = new THREE.TorusGeometry(0.185, 0.02, 8, 24)

  const { tailGeo, boneCount, segLen } = createSkinnedTailGeometry()

  const makePbrMat = ({
    map = null,
    baseColor = '#ffffff',
    metalness = 0.5,
    roughness = 0.4,
    bump = 0.02,
    repeat = [1, 1],
    doubleSide = false,
  }) =>
    new THREE.ShaderMaterial({
      vertexShader: charPbrVert,
      fragmentShader: charPbrFrag,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: {
        uMap: { value: map },
        uUseMap: { value: map ? 1.0 : 0.0 },
        uBaseColor: { value: new THREE.Color(baseColor) },
        uMetalness: { value: metalness },
        uRoughness: { value: roughness },
        uBumpStrength: { value: bump },
        uUvRepeat: { value: new THREE.Vector2(repeat[0], repeat[1]) },
        uHolePos: { value: new THREE.Vector3(...HOLE) },
        uAccentLight: { value: new THREE.Vector3(0.1, 0.75, 1.0) },
        uNearBlur: { value: 0.0 },
      },
    })

  // Vật liệu PBR dùng chung cho giáp lụa đen thêu vàng, vàng kim cổ, da mặt người thật & sừng rồng
  const armorMat = makePbrMat({
    map: armorTex,
    baseColor: '#e6ded2',
    metalness: 0.62,
    roughness: 0.32,
    bump: 0.04,
    repeat: [2, 2],
    doubleSide: true,
  })

  const goldMat = makePbrMat({
    map: null,
    baseColor: '#dfa93e',
    metalness: 0.92,
    roughness: 0.2,
    bump: 0.0,
  })

  const hornMat = makePbrMat({
    map: scaleTex,
    baseColor: '#352b42',
    metalness: 0.68,
    roughness: 0.28,
    bump: 0.03,
  })

  const headMat = makePbrMat({
    map: faceTex,
    baseColor: '#f2e6dc',
    metalness: 0.06,
    roughness: 0.56,
    bump: 0.015,
  })

  // Tạo 4 AnimationClip chuẩn cho THREE.AnimationMixer: idle, flap-wings, dive, fly-through
  const clips = buildDragonAnimationClips()

  return {
    faceTex,
    armorTex,
    scaleTex,
    torsoGeo,
    headGeo,
    hornLGeo,
    hornRGeo,
    innerWingL,
    innerWingR,
    outerWingL,
    outerWingR,
    humerusLGeo,
    humerusRGeo,
    fingerSparsL,
    fingerSparsR,
    skirtPanelGeo,
    pauldronGeo,
    limbGeo,
    legGeo,
    eyeGeo,
    goldCollarGeo,
    beltGoldGeo,
    tailGeo,
    tailBoneCount: boneCount,
    tailSegLen: segLen,
    armorMat,
    goldMat,
    hornMat,
    headMat,
    clips,
  }
}

/**
 * Xây dựng 4 THREE.AnimationClip: 'idle' -> 'flap-wings' -> 'dive' -> 'fly-through'
 * Điều khiển khớp cánh trong, khớp cổ tay cánh ngoài, nhịp thân và sóng đuôi rồng
 */
function buildDragonAnimationClips() {
  const qFromEuler = (rx, ry, rz) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
    return [q.x, q.y, q.z, q.w]
  }

  // 1. FLAP-WINGS (Đập cánh mạnh mẽ có pha gập cổ tay khi vung lên & duỗi rộng khi đập xuống)
  const tFlap = [0.0, 0.25, 0.5, 0.75, 1.0]
  const flapClip = new THREE.AnimationClip('flap-wings', 1.0, [
    new THREE.QuaternionKeyframeTrack('WingL_Shoulder.quaternion', tFlap, [
      ...qFromEuler(0.05, 0.12, -0.68),
      ...qFromEuler(-0.08, -0.05, 0.15),
      ...qFromEuler(-0.12, -0.18, 0.78),
      ...qFromEuler(0.06, 0.08, 0.05),
      ...qFromEuler(0.05, 0.12, -0.68),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Shoulder.quaternion', tFlap, [
      ...qFromEuler(0.05, -0.12, 0.68),
      ...qFromEuler(-0.08, 0.05, -0.15),
      ...qFromEuler(-0.12, 0.18, -0.78),
      ...qFromEuler(0.06, -0.08, -0.05),
      ...qFromEuler(0.05, -0.12, 0.68),
    ]),
    new THREE.QuaternionKeyframeTrack('WingL_Outer.quaternion', tFlap, [
      ...qFromEuler(0, 0.22, -0.45),
      ...qFromEuler(0, 0.02, 0.18),
      ...qFromEuler(0, -0.12, 0.35),
      ...qFromEuler(0, 0.32, -0.62),
      ...qFromEuler(0, 0.22, -0.45),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Outer.quaternion', tFlap, [
      ...qFromEuler(0, -0.22, 0.45),
      ...qFromEuler(0, -0.02, -0.18),
      ...qFromEuler(0, 0.12, -0.35),
      ...qFromEuler(0, -0.32, 0.62),
      ...qFromEuler(0, -0.22, 0.45),
    ]),
    new THREE.VectorKeyframeTrack(
      'SpineRoot.position',
      tFlap,
      [0, -0.12, 0, 0, 0.16, 0, 0, 0.22, 0, 0, -0.04, 0, 0, -0.12, 0],
    ),
  ])

  // 2. IDLE (Lượn lơ lửng nhịp nhàng)
  const tIdle = [0.0, 0.5, 1.0]
  const idleClip = new THREE.AnimationClip('idle', 1.0, [
    new THREE.QuaternionKeyframeTrack('WingL_Shoulder.quaternion', tIdle, [
      ...qFromEuler(0.02, 0.05, -0.22),
      ...qFromEuler(-0.04, -0.04, 0.26),
      ...qFromEuler(0.02, 0.05, -0.22),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Shoulder.quaternion', tIdle, [
      ...qFromEuler(0.02, -0.05, 0.22),
      ...qFromEuler(-0.04, 0.04, -0.26),
      ...qFromEuler(0.02, -0.05, 0.22),
    ]),
    new THREE.QuaternionKeyframeTrack('WingL_Outer.quaternion', tIdle, [
      ...qFromEuler(0, 0.08, -0.12),
      ...qFromEuler(0, -0.04, 0.14),
      ...qFromEuler(0, 0.08, -0.12),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Outer.quaternion', tIdle, [
      ...qFromEuler(0, -0.08, 0.12),
      ...qFromEuler(0, 0.04, -0.14),
      ...qFromEuler(0, -0.08, 0.12),
    ]),
    new THREE.VectorKeyframeTrack('SpineRoot.position', tIdle, [0, -0.04, 0, 0, 0.05, 0, 0, -0.04, 0]),
  ])

  // 3. DIVE (Khép cánh chữ V khí động học lao vút tốc độ siêu thanh)
  const tDive = [0.0, 0.5, 1.0]
  const diveClip = new THREE.AnimationClip('dive', 1.0, [
    new THREE.QuaternionKeyframeTrack('WingL_Shoulder.quaternion', tDive, [
      ...qFromEuler(0.18, 0.52, -0.32),
      ...qFromEuler(0.20, 0.56, -0.28),
      ...qFromEuler(0.18, 0.52, -0.32),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Shoulder.quaternion', tDive, [
      ...qFromEuler(0.18, -0.52, 0.32),
      ...qFromEuler(0.20, -0.56, 0.28),
      ...qFromEuler(0.18, -0.52, 0.32),
    ]),
    new THREE.QuaternionKeyframeTrack('WingL_Outer.quaternion', tDive, [
      ...qFromEuler(0, 0.55, -0.35),
      ...qFromEuler(0, 0.58, -0.30),
      ...qFromEuler(0, 0.55, -0.35),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Outer.quaternion', tDive, [
      ...qFromEuler(0, -0.55, 0.35),
      ...qFromEuler(0, -0.58, 0.30),
      ...qFromEuler(0, -0.55, 0.35),
    ]),
    new THREE.VectorKeyframeTrack('SpineRoot.position', tDive, [0, 0, 0, 0, 0.02, 0, 0, 0, 0]),
  ])

  // 4. FLY-THROUGH (Sải cánh căng rộng lướt siêu thanh qua ống kính)
  const tFly = [0.0, 0.5, 1.0]
  const flyClip = new THREE.AnimationClip('fly-through', 1.0, [
    new THREE.QuaternionKeyframeTrack('WingL_Shoulder.quaternion', tFly, [
      ...qFromEuler(-0.02, 0.22, -0.12),
      ...qFromEuler(-0.05, 0.18, 0.08),
      ...qFromEuler(-0.02, 0.22, -0.12),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Shoulder.quaternion', tFly, [
      ...qFromEuler(-0.02, -0.22, 0.12),
      ...qFromEuler(-0.05, -0.18, -0.08),
      ...qFromEuler(-0.02, -0.22, 0.12),
    ]),
    new THREE.QuaternionKeyframeTrack('WingL_Outer.quaternion', tFly, [
      ...qFromEuler(0, 0.18, -0.08),
      ...qFromEuler(0, 0.14, 0.06),
      ...qFromEuler(0, 0.18, -0.08),
    ]),
    new THREE.QuaternionKeyframeTrack('WingR_Outer.quaternion', tFly, [
      ...qFromEuler(0, -0.18, 0.08),
      ...qFromEuler(0, -0.14, -0.06),
      ...qFromEuler(0, -0.18, 0.08),
    ]),
    new THREE.VectorKeyframeTrack('SpineRoot.position', tFly, [0, 0, 0, 0, 0.03, 0, 0, 0, 0]),
  ])

  return { idle: idleClip, flap: flapClip, dive: diveClip, fly: flyClip }
}

/**
 * Tạo một Instance Dragon Maid hoàn chỉnh (Full 3D Rig + SkinnedMesh Tail + Iridescent Wing Material + LOD + AnimationMixer)
 */
export function createDragonMaidInstance(shared, spriteSheetTex) {
  const lod = new THREE.LOD()
  lod.frustumCulled = true

  // Vật liệu cánh rồng tráng gương riêng cho từng cá thể (để đổi màu tím/xanh/đỏ, blur gần & tốc độ)
  const pal = WING_PALETTES[0]
  const eyePal = EYE_PALETTES[0]
  const wingMat = new THREE.ShaderMaterial({
    vertexShader: wingVert,
    fragmentShader: wingFrag,
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uScaleMap: { value: shared.scaleTex },
      uBaseTint: { value: new THREE.Vector3(...pal.base) },
      uIridescentA: { value: new THREE.Vector3(...pal.iridA) },
      uIridescentB: { value: new THREE.Vector3(...pal.iridB) },
      uPlasmaCol: { value: new THREE.Vector3(...eyePal.light) },
      uHolePos: { value: new THREE.Vector3(...HOLE) },
      uSpeedNorm: { value: 0.5 },
      uNearBlur: { value: 0.0 },
      uTime: { value: 0.0 },
    },
  })

  const eyeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(...eyePal.hdr),
    toneMapped: false,
  })

  // ---------------- CẤP LOD 0 (0 - 185 units): MÔ HÌNH 3D PBR + SKINNED TAIL ----------------
  const fullGroup = new THREE.Group()
  fullGroup.scale.setScalar(2.05)
  const spineRoot = new THREE.Group()
  spineRoot.name = 'SpineRoot'
  fullGroup.add(spineRoot)

  // 1. Thân giáp lụa đen thêu vàng + vòng cổ & đai vàng cổ điển
  const torso = new THREE.Mesh(shared.torsoGeo, shared.armorMat)
  spineRoot.add(torso)

  const collar = new THREE.Mesh(shared.goldCollarGeo, shared.goldMat)
  collar.position.set(0, 0.02, 0.50)
  spineRoot.add(collar)

  const belt = new THREE.Mesh(shared.beltGoldGeo, shared.goldMat)
  belt.position.set(0, 0, -0.20)
  belt.scale.set(1, 0.72, 1)
  spineRoot.add(belt)

  // Giáp vai viền vàng (pauldrons) + hai tay & hai chân chiến binh tỉ lệ người thật
  ;[-1, 1].forEach((side) => {
    const pauldron = new THREE.Mesh(shared.pauldronGeo, shared.armorMat)
    pauldron.position.set(side * 0.25, 0.06, 0.36)
    pauldron.rotation.z = -side * 0.45
    spineRoot.add(pauldron)

    const trimRing = new THREE.Mesh(shared.goldCollarGeo, shared.goldMat)
    trimRing.position.set(side * 0.25, 0.05, 0.35)
    trimRing.rotation.y = side * 0.55
    trimRing.scale.setScalar(0.95)
    spineRoot.add(trimRing)

    const arm = new THREE.Mesh(shared.limbGeo, shared.armorMat)
    arm.position.set(side * 0.26, -0.04, 0.34)
    arm.rotation.set(-0.18, side * 0.22, 0)
    spineRoot.add(arm)

    const leg = new THREE.Mesh(shared.legGeo, shared.armorMat)
    leg.position.set(side * 0.12, -0.03, -0.56)
    leg.rotation.set(-0.06, side * 0.04, 0)
    spineRoot.add(leg)
  })

  // Vạt giáp lụa đen thêu vàng bay phía sau (modest royal battle-skirt)
  const skirtL = new THREE.Mesh(shared.skirtPanelGeo, shared.armorMat)
  skirtL.position.set(-0.15, 0.02, -0.32)
  skirtL.rotation.z = 0.22
  const skirtR = new THREE.Mesh(shared.skirtPanelGeo, shared.armorMat)
  skirtR.position.set(0.15, 0.02, -0.32)
  skirtR.rotation.z = -0.22
  spineRoot.add(skirtL, skirtR)

  // 2. Đầu người thật + Mắt phát sáng Cyan/Amber + Cặp sừng rồng uốn cong
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 0.08, 0.72)
  // Hơi ngẩng đầu nhìn thẳng theo hướng bay +Z
  headGroup.rotation.x = -0.32
  spineRoot.add(headGroup)

  const headMesh = new THREE.Mesh(shared.headGeo, shared.headMat)
  headGroup.add(headMesh)

  const eyeL = new THREE.Mesh(shared.eyeGeo, eyeMat)
  eyeL.position.set(-0.068, -0.155, 0.085)
  const eyeR = new THREE.Mesh(shared.eyeGeo, eyeMat)
  eyeR.position.set(0.068, -0.155, 0.085)
  headGroup.add(eyeL, eyeR)

  const hornL = new THREE.Mesh(shared.hornLGeo, shared.hornMat)
  const hornR = new THREE.Mesh(shared.hornRGeo, shared.hornMat)
  headGroup.add(hornL, hornR)

  // 3. Cánh Rồng Tráng Gương 2 Khớp Xương (Trái & Phải) + Điểm neo đầu cánh cho Trail
  const wingShoulderL = new THREE.Group()
  wingShoulderL.name = 'WingL_Shoulder'
  wingShoulderL.position.set(-0.16, 0.14, 0.28)
  spineRoot.add(wingShoulderL)

  wingShoulderL.add(new THREE.Mesh(shared.innerWingL, wingMat))
  wingShoulderL.add(new THREE.Mesh(shared.humerusLGeo, shared.hornMat))

  const wingOuterL = new THREE.Group()
  wingOuterL.name = 'WingL_Outer'
  wingOuterL.position.set(-1.55, 0.08, 0.28)
  wingShoulderL.add(wingOuterL)
  wingOuterL.add(new THREE.Mesh(shared.outerWingL.geo, wingMat))
  shared.fingerSparsL.forEach((fg) => wingOuterL.add(new THREE.Mesh(fg, shared.hornMat)))

  const wingTipL = new THREE.Object3D()
  wingTipL.position.set(-2.88, 0.10, 0.18)
  wingOuterL.add(wingTipL)

  const wingShoulderR = new THREE.Group()
  wingShoulderR.name = 'WingR_Shoulder'
  wingShoulderR.position.set(0.16, 0.14, 0.28)
  spineRoot.add(wingShoulderR)

  wingShoulderR.add(new THREE.Mesh(shared.innerWingR, wingMat))
  wingShoulderR.add(new THREE.Mesh(shared.humerusRGeo, shared.hornMat))

  const wingOuterR = new THREE.Group()
  wingOuterR.name = 'WingR_Outer'
  wingOuterR.position.set(1.55, 0.08, 0.28)
  wingShoulderR.add(wingOuterR)
  wingOuterR.add(new THREE.Mesh(shared.outerWingR.geo, wingMat))
  shared.fingerSparsR.forEach((fg) => wingOuterR.add(new THREE.Mesh(fg, shared.hornMat)))

  const wingTipR = new THREE.Object3D()
  wingTipR.position.set(2.88, 0.10, 0.18)
  wingOuterR.add(wingTipR)

  // 4. SkinnedMesh Đuôi Rồng 6 đốt xương thật (THREE.Skeleton)
  const tailBones = []
  for (let i = 0; i < shared.tailBoneCount; i++) {
    const b = new THREE.Bone()
    b.position.set(0, 0, i === 0 ? -0.52 : -shared.tailSegLen)
    if (i > 0) tailBones[i - 1].add(b)
    tailBones.push(b)
  }
  spineRoot.add(tailBones[0])
  const tailMesh = new THREE.SkinnedMesh(shared.tailGeo, wingMat)
  const tailSkeleton = new THREE.Skeleton(tailBones)
  tailMesh.add(tailBones[0])
  tailMesh.bind(tailSkeleton)
  tailMesh.frustumCulled = false
  spineRoot.add(tailMesh)

  lod.addLevel(fullGroup, 0)

  // ---------------- CẤP LOD 1 (>= 165 units): SPRITE BILLBOARD 10-FRAME ----------------
  const fallbackTex =
    spriteSheetTex ||
    (() => {
      const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat)
      t.needsUpdate = true
      return t
    })()
  const spriteMat = new THREE.ShaderMaterial({
    vertexShader: lodSpriteVert,
    fragmentShader: lodSpriteFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSheet: { value: fallbackTex },
      uFrame: { value: 0 },
      uTotalFrames: { value: 10 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
    },
  })
  const lodBillboard = new THREE.Mesh(new THREE.PlaneGeometry(22.0, 15.0), spriteMat)
  lod.addLevel(lodBillboard, 185)

  // ---------------- ANIMATION MIXER & ACTIONS ----------------
  const mixer = new THREE.AnimationMixer(fullGroup)
  const actions = {
    idle: mixer.clipAction(shared.clips.idle),
    flap: mixer.clipAction(shared.clips.flap),
    dive: mixer.clipAction(shared.clips.dive),
    fly: mixer.clipAction(shared.clips.fly),
  }
  Object.values(actions).forEach((a) => {
    a.enabled = true
    a.setLoop(THREE.LoopRepeat, Infinity)
  })
  actions.flap.play()

  return {
    lod,
    fullGroup,
    lodBillboard,
    spriteMat,
    wingMat,
    eyeMat,
    tailBones,
    skirtL,
    skirtR,
    wingTipL,
    wingTipR,
    mixer,
    actions,
    currentActionName: 'flap',
  }
}

/**
 * Kết xuất Offscreen Sprite Sheet 10 Frame (2000x200 RGBA) trực tiếp từ mô hình 3D PBR
 * Giúp cấp độ LOD xa (>= 185 units) đồng nhất 100% tạo hình dark-fantasy với mô hình gần
 */
export function bakeDragonSpriteSheet(gl, shared) {
  const FRAMES = 10
  const fw = 200
  const fh = 200
  const rtTarget = new THREE.WebGLRenderTarget(fw * FRAMES, fh, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  })

  const bakeScene = new THREE.Scene()
  const dummyRig = createDragonMaidInstance(shared, null)
  dummyRig.fullGroup.rotation.set(-0.35, 0.55, 0.12)
  bakeScene.add(dummyRig.fullGroup)

  const cam = new THREE.PerspectiveCamera(42, 1, 0.5, 80)
  cam.position.set(0, -3.5, 23.0)
  cam.lookAt(0, 0, -0.5)

  const prevTarget = gl.getRenderTarget()
  const prevScissorTest = gl.getScissorTest()
  const prevViewport = gl.getViewport(new THREE.Vector4())
  const prevScissor = gl.getScissor(new THREE.Vector4())
  const prevClearAlpha = gl.getClearAlpha()
  const prevClearColor = new THREE.Color()
  gl.getClearColor(prevClearColor)

  gl.setRenderTarget(rtTarget)
  gl.setClearColor(0x000000, 0)
  gl.clear(true, true, true)
  gl.setScissorTest(true)

  for (let i = 0; i < FRAMES; i++) {
    dummyRig.mixer.setTime(i / FRAMES)
    // Uốn đuôi nhẹ theo pha cánh
    dummyRig.tailBones.forEach((b, bi) => {
      if (bi > 0) b.rotation.x = Math.sin((i / FRAMES) * Math.PI * 2 - bi * 0.6) * 0.12
    })
    dummyRig.fullGroup.updateMatrixWorld(true)

    gl.setViewport(i * fw, 0, fw, fh)
    gl.setScissor(i * fw, 0, fw, fh)
    gl.render(bakeScene, cam)
  }

  gl.setScissorTest(prevScissorTest)
  gl.setRenderTarget(prevTarget)
  gl.setClearColor(prevClearColor, prevClearAlpha)
  gl.setViewport(prevViewport)
  gl.setScissor(prevScissor)

  return rtTarget.texture
}
