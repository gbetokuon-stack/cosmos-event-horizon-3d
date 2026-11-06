import * as THREE from 'three'

/**
 * ============================================================================
 * PLACEHOLDER GEOMETRY & PBR MATERIAL BUILDER (buildDragonPlaceholder.js)
 * ============================================================================
 * Xây dựng bộ hình học Placeholder phong cách PHOTOREALISTIC DARK-FANTASY AAA
 * (tuyệt đối không anime/chibi/cel-shading, không phụ thuộc URL texture ngoài).
 *
 * Cấu trúc nhân vật Placeholder gồm:
 *  - Body: CapsuleGeometry cao chuẩn 2.0 units, tinh chỉnh đường nét giáp chiến binh,
 *          vật liệu PBR metalness 0.8, roughness 0.3, da/vảy tím-xanh-ngọc iridescent (#2a1a4a -> #4a2a6a)
 *  - Wings: 2 cánh dơi/rồng khía cung võng từ THREE.Shape -> BufferGeometry (DoubleSide,
 *           emissive cyan #00d4ff intensity 0.5, opacity 0.85, có độ vòm khí động học)
 *  - Horns: 2 sừng ConeGeometry đa đoạn uốn cong nhẹ trên đỉnh đầu, đen bóng hắc diện thạch
 *  - Tail: 1 TubeGeometry uốn chữ S mềm mại vuốt thon dần về chóp đuôi
 *  - Eyes: 2 SphereGeometry nhỏ phát sáng hổ phách (#ffaa00) intensity 3.0
 */

let _cachedGeos = null

/**
 * Tự sinh procedural normal/bump DataTexture vảy rồng kim loại ngay trong RAM
 * (Self-contained 100%, không tải bất kỳ file ảnh bên ngoài nào)
 */
export function createProceduralDragonScaleTexture(size = 128) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Lưới vảy rồng xếp lớp lục giác lệch hàng (staggered reptilian scales)
      const row = (y / size) * 14.0
      const rowIdx = Math.floor(row)
      const col = (x / size) * 14.0 + (rowIdx % 2) * 0.5
      const fx = (col - Math.floor(col)) - 0.5
      const fy = (row - rowIdx) - 0.5

      // Biên dạng vảy nhọn kiểu dark-fantasy
      const dist = Math.sqrt(fx * fx * 1.35 + fy * fy * 0.95)
      const scaleHeight = Math.max(0, 1.0 - dist * 1.65)
      const ridge = Math.max(0, 1.0 - Math.abs(fx) * 6.0) * 0.25 * scaleHeight
      const v = Math.min(255, Math.floor((scaleHeight * 0.8 + ridge) * 255))

      const idx = (y * size + x) * 4
      data[idx] = v
      data[idx + 1] = v
      data[idx + 2] = Math.min(255, v + 18)
      data[idx + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.needsUpdate = true
  return tex
}

/**
 * Dựng BufferGeometry cánh dơi/rồng có 4 xương ngón và rìa màng da khoét cung võng
 * @param {number} side -1 cho cánh trái (-X), +1 cho cánh phải (+X)
 */
function buildBatDragonWingGeometry(side = 1) {
  const s = side
  const shape = new THREE.Shape()

  // Vẽ biên dạng cánh dơi/rồng từ khớp vai gốc (0, 0)
  shape.moveTo(0, 0.25)
  // Cạnh dẫn hướng (leading edge) vươn rộng ra đầu mút cánh (4.4 units mỗi bên)
  shape.quadraticCurveTo(s * 1.35, 0.92, s * 2.65, 0.74)
  shape.quadraticCurveTo(s * 3.72, 0.54, s * 4.42, 0.16)

  // Rìa sau khoét 3 cung võng cánh dơi/rồng sắc nhọn (scalloped trailing membrane)
  shape.quadraticCurveTo(s * 3.58, -0.24, s * 3.28, -0.78)
  shape.quadraticCurveTo(s * 2.55, -0.48, s * 2.18, -1.08)
  shape.quadraticCurveTo(s * 1.48, -0.72, s * 1.08, -1.16)
  shape.quadraticCurveTo(s * 0.52, -0.74, 0, -0.52)
  shape.closePath()

  const geo = new THREE.ShapeGeometry(shape, 14)

  // Tạo độ vòm khí động học 3D (camber) trước khi xoay sang mặt phẳng bay ngang XZ
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const spanRatio = Math.min(1, Math.abs(x) / 4.42)
    const arch =
      Math.sin(spanRatio * Math.PI) * 0.24 +
      Math.cos((y + 0.5) * 2.4) * 0.06 * spanRatio
    pos.setZ(i, arch)
  }

  // Đưa cánh vào mặt phẳng bay ngang XZ (+Z hướng tới trước, +Y vòm lên lưng)
  // để điều khiển đập cánh lên/xuống trực tiếp bằng `mesh.rotation.z`
  geo.rotateX(-Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

/**
 * Dựng ConeGeometry sừng rồng vuốt cong về phía sau (-Z) và chĩa lên (+Y)
 * @param {number} side -1 (trái) hoặc +1 (phải)
 */
function buildCurvedHornGeometry(side = 1) {
  const geo = new THREE.ConeGeometry(0.048, 0.54, 10, 10)
  geo.translate(0, 0.27, 0)

  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const t = Math.max(0, y / 0.54)
    // Sừng mở nhẹ sang hai bên thái dương và uốn cong khí động học về phía sau (-Z)
    pos.setX(i, x + side * Math.pow(t, 1.3) * 0.11)
    pos.setY(i, y * 0.65)
    pos.setZ(i, z - Math.pow(t, 1.35) * 0.46)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Dựng CapsuleGeometry thân nữ chiến binh chiều cao chuẩn 2.0 units,
 * điêu khắc nhẹ tỷ lệ giáp ngực - eo - hông chuẩn giải phẫu người thật (1:7.5)
 */
function buildWarriorCapsuleBodyGeometry() {
  // radius = 0.24, length = 1.52 => tổng chiều cao = 1.52 + 0.24 * 2 = đúng 2.00 units
  const geo = new THREE.CapsuleGeometry(0.24, 1.52, 12, 24)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i) // -1.0 (gót chân) -> +1.0 (đỉnh đầu)
    const z = pos.getZ(i)

    let scaleX = 1.0
    let scaleZ = 0.76

    if (y > 0.62) {
      const headT = (y - 0.62) / 0.38
      const neckPinch = 1.0 - Math.sin(Math.min(1, headT * 2.2) * Math.PI) * 0.28
      scaleX = 0.78 * neckPinch
      scaleZ = 0.78 * neckPinch
    } else if (y > 0.12) {
      const chestT = (y - 0.12) / 0.5
      scaleX = 0.88 + Math.sin(chestT * Math.PI) * 0.34
      scaleZ = 0.72 + Math.sin(chestT * Math.PI) * 0.16
    } else if (y > -0.22) {
      scaleX = 0.72
      scaleZ = 0.62
    } else if (y > -0.58) {
      const hipT = (-0.22 - y) / 0.36
      scaleX = 0.74 + Math.sin(hipT * Math.PI) * 0.32
      scaleZ = 0.66 + Math.sin(hipT * Math.PI) * 0.18
    } else {
      const legT = (-0.58 - y) / 0.42
      scaleX = 0.68 * (1.0 - legT * 0.42)
      scaleZ = 0.64 * (1.0 - legT * 0.38)
    }

    pos.setXYZ(i, x * scaleX, y, z * scaleZ)
  }

  geo.computeVertexNormals()
  return geo
}

/**
 * Dựng TubeGeometry đuôi rồng cong nhẹ hình chữ S kéo dài về phía sau (-Z)
 */
function buildDragonTailGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.14, -0.58),
    new THREE.Vector3(0, -0.06, -1.25),
    new THREE.Vector3(0, 0.08, -1.85),
    new THREE.Vector3(0, -0.04, -2.42),
  ])

  const segments = 24
  const radialSegments = 8
  const geo = new THREE.TubeGeometry(curve, segments, 0.085, radialSegments, false)

  const pos = geo.attributes.position
  const center = new THREE.Vector3()
  const v = new THREE.Vector3()
  const ringVerts = radialSegments + 1

  for (let i = 0; i < pos.count; i++) {
    const segIdx = Math.min(segments, Math.floor(i / ringVerts))
    const t = segIdx / segments
    curve.getPointAt(t, center)
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center)
    const taper = Math.max(0.08, 1.0 - Math.pow(t, 0.82))
    v.multiplyScalar(taper).add(center)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  geo.computeVertexNormals()
  return geo
}

/**
 * Tạo vật liệu PBR vảy rồng kim loại chuyển sắc Iridescent (#2a1a4a -> #4a2a6a)
 * Tích hợp Fresnel rim-sheen để nổi khối sắc nét ngay cả trong không gian vũ trụ tối không có đèn toàn cục.
 */
export function createIridescentBodyMaterial(scaleTexture) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2a1a4a'),
    emissive: new THREE.Color('#1c1036'),
    emissiveIntensity: 0.55,
    metalness: 0.8,
    roughness: 0.3,
    iridescence: 1.0,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [180, 540],
    bumpMap: scaleTexture,
    bumpScale: 0.035,
  })

  // Bổ sung chuyển sắc Fresnel (#2a1a4a -> #4a2a6a + ánh ngọc lục bảo viền mỏng) trực tiếp trên GPU
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      /* glsl */ `
      float fresnelDragon = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
      vec3 iridShift = mix(vec3(0.165, 0.102, 0.290), vec3(0.290, 0.165, 0.416), fresnelDragon);
      vec3 jadeEdge = vec3(0.04, 0.38, 0.46) * pow(fresnelDragon, 2.5);
      gl_FragColor.rgb += iridShift * 0.42 + jadeEdge * 0.55;
      #include <dithering_fragment>
      `,
    )
  }
  mat.customProgramCacheKey = () => 'dragon-iridescent-body-v1'
  return mat
}

/**
 * Hàm Builder chính: Khởi tạo & trả về bộ Geometries + Shared Materials dùng chung cho toàn Pool
 */
export function buildDragonPlaceholderGeometries() {
  if (_cachedGeos) return _cachedGeos

  const scaleTex = createProceduralDragonScaleTexture(128)
  const bodyGeo = buildWarriorCapsuleBodyGeometry()
  const wingLeftGeo = buildBatDragonWingGeometry(-1)
  const wingRightGeo = buildBatDragonWingGeometry(1)
  const hornLeftGeo = buildCurvedHornGeometry(-1)
  const hornRightGeo = buildCurvedHornGeometry(1)
  const tailGeo = buildDragonTailGeometry()
  const eyeGeo = new THREE.SphereGeometry(0.034, 10, 10)

  // Vật liệu dùng chung cho Sừng đen bóng & Mắt hổ phách HDR
  const hornMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#09080f'),
    emissive: new THREE.Color('#120e1c'),
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.16,
  })

  const eyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffaa00'),
    emissive: new THREE.Color('#ffaa00'),
    emissiveIntensity: 3.0,
    roughness: 0.1,
    toneMapped: false,
  })

  const bodyMat = createIridescentBodyMaterial(scaleTex)

  _cachedGeos = {
    scaleTex,
    bodyGeo,
    wingLeftGeo,
    wingRightGeo,
    hornLeftGeo,
    hornRightGeo,
    tailGeo,
    eyeGeo,
    bodyMat,
    hornMat,
    eyeMat,
  }

  return _cachedGeos
}
