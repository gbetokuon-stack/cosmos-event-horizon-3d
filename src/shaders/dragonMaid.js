import { NOISE } from './common'

/* =====================================================================
 * 1. IRIDESCENT METALLIC DRAGON WING & SCALE PBR SHADER
 *    - Vảy rồng da tráng gương (tím - xanh cyan - ngọc lục bảo / biến thể màu)
 *    - Normal bump vi mô từ texture vảy rồng + PBR specular & rim light từ Hố Đen
 *    - Mạch lửa/plasma rực sáng dọc rìa cánh khi bay tốc độ cao
 *    - Hiệu ứng Depth-of-Field (uNearBlur): mờ nhẹ khi lướt sát ống kính, sắc nét ở xa
 * ===================================================================== */
export const wingVert = /* glsl */ `
#ifdef USE_SKINNING
  #include <skinning_pars_vertex>
#endif
attribute float aMembrane; // 0 = xương sườn cánh cứng / đuôi, 1 = màng da đàn hồi
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vMembrane;

uniform float uTime;
uniform float uSpeedNorm; // 0..1 tương ứng 200..500 units/s

void main() {
  vUv = uv;
  vMembrane = aMembrane;

  vec3 pos = position;
  // Màng cánh rung phần phật tần số cao trong luồng gió siêu thanh
  float flutter = sin(uTime * 34.0 + pos.x * 3.2 + pos.z * 2.5) * 0.06 * aMembrane * (0.4 + uSpeedNorm);
  // Độ phồng khí động học (camber) khi đón gió
  float camber = sin(uv.x * 3.14159) * 0.14 * aMembrane;
  pos.y += flutter + camber;

  vec3 transformed = pos;
  vec3 objectNormal = vec3(normal);
  #ifdef USE_SKINNING
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
  #endif

  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const wingFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vMembrane;

uniform sampler2D uScaleMap;
uniform vec3 uBaseTint;     // Tông màu chủ đạo cánh (tím / xanh / đỏ sẫm)
uniform vec3 uIridescentA;  // Sắc tráng gương 1 (cyan / ngọc)
uniform vec3 uIridescentB;  // Sắc tráng gương 2 (tím / vàng kim)
uniform vec3 uPlasmaCol;    // Màu mắt & plasma (cyan hoặc amber)
uniform vec3 uHolePos;      // Vị trí Hố Đen (nguồn rim light chính)
uniform float uSpeedNorm;   // 0..1
uniform float uNearBlur;    // 0..1 (Depth-of-Field blur khi bay sát camera)
uniform float uTime;
${NOISE}

void main() {
  vec2 uvScaled = vUv * vec2(2.6, 2.2);

  // Depth of Field: lấy mẫu đa điểm làm dịu chi tiết khi vật thể bay sát camera (uNearBlur > 0)
  float blurStep = uNearBlur * 0.018;
  vec3 texC = texture2D(uScaleMap, uvScaled).rgb;
  if (uNearBlur > 0.02) {
    texC = 0.4 * texC
         + 0.15 * texture2D(uScaleMap, uvScaled + vec2(blurStep, 0.0)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled - vec2(blurStep, 0.0)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled + vec2(0.0, blurStep)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled - vec2(0.0, blurStep)).rgb;
  }

  // Tái tạo vector pháp tuyến vi mô (bump normal) từ độ nổi của vảy rồng
  float hL = dot(texture2D(uScaleMap, uvScaled - vec2(0.004, 0.0)).rgb, vec3(0.333));
  float hR = dot(texture2D(uScaleMap, uvScaled + vec2(0.004, 0.0)).rgb, vec3(0.333));
  float hD = dot(texture2D(uScaleMap, uvScaled - vec2(0.0, 0.004)).rgb, vec3(0.333));
  float hU = dot(texture2D(uScaleMap, uvScaled + vec2(0.0, 0.004)).rgb, vec3(0.333));

  vec3 N = normalize(vNormalW + vec3(hL - hR, hD - hU, 0.0) * (2.6 * (1.0 - uNearBlur * 0.6)));
  if (!gl_FrontFacing) N = -N;

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uHolePos - vWorldPos);
  vec3 H = normalize(L + V);

  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  float ndh = clamp(dot(N, H), 0.0, 1.0);

  // Hiệu ứng giao thoa màng mỏng tráng gương (Iridescent Thin-Film Shift: tím -> xanh -> ngọc)
  float fresnel = pow(1.0 - ndv, 2.4);
  vec3 irid = mix(uBaseTint, uIridescentA, smoothstep(0.1, 0.65, fresnel));
  irid = mix(irid, uIridescentB, smoothstep(0.55, 0.98, fresnel));

  float scaleLuma = dot(texC, vec3(0.299, 0.587, 0.114));
  vec3 albedo = texC * 0.65 + irid * (0.45 + scaleLuma * 0.85);

  // Ánh sáng PBR: Ambient bầu trời đêm + Diffuse + Metallic Specular sắc lạnh
  vec3 ambient = albedo * vec3(0.22, 0.24, 0.38);
  vec3 diffuse = albedo * ndl * 0.95;
  float spec = pow(ndh, 42.0) * (0.55 + scaleLuma * 0.95);
  vec3 specular = mix(irid, vec3(1.0), 0.35) * spec * 1.35;

  // Subsurface scattering xuyên qua màng cánh da khi ngược sáng Hố Đen
  float backLight = pow(clamp(dot(-L, V), 0.0, 1.0), 3.0) * vMembrane;
  vec3 sss = uIridescentA * backLight * 0.45;

  // Khói lửa / mạch plasma rực sáng dọc rìa sau cánh khi bay tốc độ cao
  float nPlasma = fbm2(vUv * 7.0 - vec2(uTime * 3.5, uTime * 1.8));
  float trailingEdge = smoothstep(0.58, 0.98, vUv.y) * vMembrane;
  float wingTip = smoothstep(0.65, 1.0, vUv.x);
  float plasmaMask = (trailingEdge * 0.75 + wingTip * 0.85) * smoothstep(0.35, 0.85, nPlasma);
  vec3 plasma = uPlasmaCol * plasmaMask * (0.65 + uSpeedNorm * 1.45);

  // Rim light điện ảnh sắc nét quanh viền cánh
  vec3 rim = mix(uIridescentA, uPlasmaCol, 0.45) * pow(1.0 - ndv, 4.0) * 0.85;

  vec3 col = ambient + diffuse + specular + sss + plasma + rim;
  col = min(col, vec3(2.8));

  // Viền hơi mờ nhẹ khi ở cực gần ống kính (DoF)
  float alpha = 1.0 - uNearBlur * 0.18 * pow(1.0 - ndv, 2.0);
  gl_FragColor = vec4(col, alpha);
}`

/* =====================================================================
 * 2. MOTION BLUR & WINGTIP PLASMA RIBBON TRAIL SHADER
 *    Dải lụa khói lửa / vệt sáng kéo dài theo quỹ đạo bay (additive blending)
 * ===================================================================== */
export const ribbonVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const ribbonFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uOpacity;
${NOISE}

void main() {
  // vUv.x: 0 (đầu cánh hiện tại) -> 1 (đuôi vệt khói phơi sáng phía sau)
  // vUv.y: 0..1 bề ngang dải lụa
  float headToTail = 1.0 - vUv.x;
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  across = pow(max(across, 0.0), 1.6);

  float smoke = fbm2(vec2(vUv.x * 6.0 - uTime * 4.5, vUv.y * 3.0 + uTime * 0.8));
  float core = pow(across, 3.0) * pow(headToTail, 1.35);
  float wake = across * pow(headToTail, 2.1) * (0.45 + 0.85 * smoke);

  vec3 col = mix(uColorB, uColorA, pow(headToTail, 0.75));
  col += vec3(1.0, 0.96, 0.9) * core * 0.85;

  float a = (core * 0.9 + wake * 0.65) * smoothstep(0.0, 0.04, vUv.x) * uOpacity;
  gl_FragColor = vec4(min(col * 1.4, vec3(2.4)), a);
}`

/* =====================================================================
 * 3. SUPERSONIC SHOCKWAVE RING SHADER (Vòng xung kích khi phá vỡ bức tường âm thanh)
 * ===================================================================== */
export const shockVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const shockFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uProgress; // 0 -> 1
uniform vec3 uTint;
${NOISE}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float targetR = mix(0.18, 0.92, pow(uProgress, 0.65));
  float width = mix(0.10, 0.035, uProgress);
  float wave = exp(-pow((r - targetR) / width, 2.0));
  float mach = 0.65 + 0.35 * fbm2(vec2(cos(ang) * 4.0, sin(ang) * 4.0) + uProgress * 3.0);

  float fade = (1.0 - uProgress) * smoothstep(0.0, 0.08, uProgress);
  vec3 col = mix(vec3(0.88, 0.96, 1.0), uTint, 0.45) * wave * mach * 1.8;
  gl_FragColor = vec4(min(col, vec3(2.2)), wave * fade * 0.85);
}`

/* =====================================================================
 * 4. EMBER & PLASMA SPARKS SHADER (Tàn lửa vàng-cam rơi từ cánh)
 * ===================================================================== */
export const emberVert = /* glsl */ `
attribute float aSize;
attribute float aLife;
attribute vec3 aColor;
uniform float uPx;
varying float vLife;
varying vec3 vColor;

void main() {
  vLife = aLife;
  vColor = aColor;
  if (aLife <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx * (95.0 / max(-mv.z, 1.0)), 1.2, 22.0);
}`

export const emberFrag = /* glsl */ `
precision highp float;
varying float vLife;
varying vec3 vColor;

void main() {
  if (vLife <= 0.001) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-d * d * 8.0);
  float glow = exp(-d * 2.8) * 0.45;
  float a = (core + glow) * smoothstep(0.0, 0.15, vLife) * min(vLife * 1.4, 1.0);
  vec3 col = mix(vColor, vec3(1.0, 0.96, 0.82), core * 0.65);
  gl_FragColor = vec4(col * 1.6, a);
}`

/* =====================================================================
 * 5. FAR-LOD ANIMATED 10-FRAME SPRITE SHEET SHADER
 *    Hiển thị các cá thể ở xa (>= 165 units) bằng Sprite Sheet PBR 10 frame
 * ===================================================================== */
export const lodSpriteVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const lodSpriteFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSheet;
uniform float uFrame;      // 0..9
uniform float uTotalFrames;
uniform vec3 uTint;

void main() {
  float f0 = floor(mod(uFrame, uTotalFrames));
  float f1 = mod(f0 + 1.0, uTotalFrames);
  float blend = fract(uFrame);

  vec2 uv0 = vec2((vUv.x + f0) / uTotalFrames, vUv.y);
  vec2 uv1 = vec2((vUv.x + f1) / uTotalFrames, vUv.y);

  vec4 c0 = texture2D(uSheet, uv0);
  vec4 c1 = texture2D(uSheet, uv1);
  vec4 c = mix(c0, c1, blend);

  if (c.a < 0.03) discard;
  vec3 col = c.rgb * mix(vec3(1.0), uTint, 0.35);
  gl_FragColor = vec4(col, c.a);
}`

/* =====================================================================
 * 6. DEDICATED PBR CHARACTER SHADER (Skin, Obsidian-Gold Silk Armor, Horns)
 *    Chiếu sáng PBR vật lý từ Hố Đen & Tinh Vân mà không làm chói gương nước mặt đất
 * ===================================================================== */
export const charPbrVert = /* glsl */ `
#ifdef USE_SKINNING
  #include <skinning_pars_vertex>
#endif
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vUv = uv;
  vec3 transformed = vec3(position);
  vec3 objectNormal = vec3(normal);
  #ifdef USE_SKINNING
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
  #endif
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const charPbrFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uBaseColor;
uniform float uMetalness;
uniform float uRoughness;
uniform float uBumpStrength;
uniform vec2 uUvRepeat;
uniform vec3 uHolePos;
uniform vec3 uAccentLight;
uniform float uNearBlur;

void main() {
  vec2 uv = vUv * uUvRepeat;
  vec3 texCol = vec3(1.0);
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;

  if (uUseMap > 0.5) {
    float bStep = uNearBlur * 0.012;
    texCol = texture2D(uMap, uv).rgb;
    if (uNearBlur > 0.02) {
      texCol = 0.5 * texCol
             + 0.25 * texture2D(uMap, uv + vec2(bStep, bStep)).rgb
             + 0.25 * texture2D(uMap, uv - vec2(bStep, bStep)).rgb;
    }
    if (uBumpStrength > 0.001) {
      float hL = dot(texture2D(uMap, uv - vec2(0.004, 0.0)).rgb, vec3(0.333));
      float hR = dot(texture2D(uMap, uv + vec2(0.004, 0.0)).rgb, vec3(0.333));
      float hD = dot(texture2D(uMap, uv - vec2(0.0, 0.004)).rgb, vec3(0.333));
      float hU = dot(texture2D(uMap, uv + vec2(0.0, 0.004)).rgb, vec3(0.333));
      N = normalize(N + vec3(hL - hR, hD - hU, 0.0) * uBumpStrength * 18.0);
    }
  }

  vec3 albedo = texCol * uBaseColor;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uHolePos - vWorldPos);
  vec3 H = normalize(L + V);

  float ndl = clamp(dot(N, L), 0.0, 1.0);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float ndh = clamp(dot(N, H), 0.0, 1.0);

  // Ánh sáng bầu trời tinh vân + ánh sáng vành đĩa bồi tụ + rim light
  vec3 hemi = mix(vec3(0.10, 0.08, 0.18), vec3(0.34, 0.38, 0.62), N.y * 0.5 + 0.5);
  vec3 diff = albedo * (1.0 - uMetalness * 0.75) * (hemi + vec3(0.95, 0.92, 1.05) * ndl * 1.15);

  float shininess = mix(12.0, 96.0, 1.0 - uRoughness);
  vec3 f0 = mix(vec3(0.04), albedo, uMetalness);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - ndv, 4.0);
  vec3 spec = fresnel * pow(ndh, shininess) * (0.4 + 1.6 * (1.0 - uRoughness));

  // Hắt sáng plasma nhẹ từ mắt & cánh lên viền giáp thêu vàng
  vec3 rim = uAccentLight * pow(1.0 - ndv, 3.5) * 0.42;

  vec3 col = min(diff + spec + rim, vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
}`
