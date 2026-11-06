import { NOISE } from './common'

/* =====================================================================
 *  ĐĨA BỒI TỤ (ACCRETION DISK SHADER)
 *  - Chia 3 vành tốc độ góc khác nhau theo đúng đặc tả vật lý:
 *      + Vành trong: xoay 3.0 vòng/giây, màu trắng-xanh cyan (#e0ffff -> #00d4ff)
 *      + Vành giữa : xoay 1.5 vòng/giây, màu cam-vàng (#ff6b00 -> #ffd700)
 *      + Vành ngoài: xoay 0.5 vòng/giây, màu đỏ-tím (#ff0044 -> #8b00ff)
 *  - Kết hợp FBM 3D noise (tránh đường nối ±π) + Fresnel + Relativistic Doppler Shift
 * ===================================================================== */
export const diskVert = /* glsl */ `
varying vec2 vPos;
varying vec3 vWorld;
varying vec3 vTan;
varying vec3 vNrm;

void main() {
  vPos = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  // Vector tiếp tuyến theo chiều quay ngược chiều kim đồng hồ của plasma
  vTan = normalize(mat3(modelMatrix) * vec3(-position.y, position.x, 0.0));
  vNrm = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const diskFrag = /* glsl */ `
precision highp float;
varying vec2 vPos;
varying vec3 vWorld;
varying vec3 vTan;
varying vec3 vNrm;

uniform float uTime;      // Thời gian xoay đĩa bồi tụ
uniform float uInner;     // Bán kính trong (DISK_IN)
uniform float uOuter;     // Bán kính ngoài (DISK_OUT)
uniform float uIntensity; // Hệ số cường độ sáng (tăng khi hover)
uniform float uAlpha;     // Độ mờ điều khiển bởi GSAP timeline
${NOISE}

// Pha màu theo 3 vùng nhiệt độ plasma từ trong ra ngoài
vec3 ringColor(float t, float f) {
  vec3 inner = mix(vec3(0.878, 1.0, 1.0), vec3(0.0, 0.831, 1.0), f);   // #e0ffff -> #00d4ff
  vec3 mid   = mix(vec3(1.0, 0.42, 0.0),  vec3(1.0, 0.843, 0.0), f);   // #ff6b00 -> #ffd700
  vec3 outer = mix(vec3(1.0, 0.0, 0.267), vec3(0.545, 0.0, 1.0), f);   // #ff0044 -> #8b00ff
  vec3 c = mix(inner, mid, smoothstep(0.14, 0.44, t));
  return mix(c, outer, smoothstep(0.50, 0.88, t));
}

// Nhiễu xoắn plasma liên tục trên toạ độ cực
float ringNoise(float ang, float r, float seed) {
  float spiral = ang + log(max(r, 1.0)) * 2.6;
  vec3 a = vec3(cos(spiral) * 2.8, sin(spiral) * 2.8, r * 0.14 + seed);
  vec3 b = vec3(cos(spiral) * 9.0, sin(spiral) * 9.0, r * 0.55 + seed * 2.0);
  return fbm3(a) * 0.72 + noise3(b) * 0.38;
}

void main() {
  float r = length(vPos);
  float ang = atan(vPos.y, vPos.x);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

  // T = uTime * 2π -> nhân 3.0 / 1.5 / 0.5 tương ứng đúng số vòng/giây của từng vành
  float T = uTime * 6.2831853;
  float m0 = 1.0 - smoothstep(0.18, 0.42, t);
  float m2 = smoothstep(0.52, 0.80, t);
  float m1 = clamp(1.0 - m0 - m2, 0.0, 1.0);

  float f = 0.0;
  if (m0 > 0.005) f += m0 * ringNoise(ang + T * 3.0, r, 0.0);
  if (m1 > 0.005) f += m1 * ringNoise(ang + T * 1.5, r, 4.3);
  if (m2 > 0.005) f += m2 * ringNoise(ang + T * 0.5, r, 9.1);

  // Độ sáng giảm dần từ tâm ra rìa + vân sợi mảnh kiểu Gargantua
  float radial = pow(1.0 - t, 1.75) * 1.45 + 0.12;
  float filaments = 0.58 + 0.42 * sin(r * 1.45 + f * 7.5);
  float structure = (0.32 + 1.15 * f) * filaments;

  // Hiệu ứng Doppler tương đối tính (Relativistic Beaming & Color Shift)
  vec3 V = normalize(cameraPosition - vWorld);
  float beta = 0.38 * sqrt(uInner / max(r, uInner));
  float D = clamp(1.0 / (1.0 - beta * dot(vTan, V)), 0.62, 1.68);
  float beam = pow(D, 2.1);

  vec3 col = ringColor(t, clamp(f * 1.25, 0.0, 1.0));
  // Dịch chuyển phổ xanh (blueshift) bên tiến lại gần và đỏ (redshift) bên lùi xa
  col *= mix(vec3(1.18, 0.72, 0.55), vec3(0.82, 0.96, 1.25), smoothstep(0.75, 1.35, D));

  // Fresnel khi nhìn nghiêng qua lớp plasma mỏng
  float fr = pow(1.0 - abs(dot(vNrm, V)), 2.2);
  col *= 1.0 + fr * 0.65;

  // Vành trong ISCO phát sáng trắng-cyan sắc nét nhưng không cháy sáng
  col += vec3(0.55, 0.92, 1.0) * exp(-t * 18.0) * 0.65;

  float edge = smoothstep(0.0, 0.045, t) * (1.0 - smoothstep(0.74, 1.0, t));
  col *= radial * structure * beam * uIntensity * 0.42;
  col = min(col, vec3(2.4));

  gl_FragColor = vec4(col, edge * uAlpha);
}`

/* =====================================================================
 *  GRAVITATIONAL LENSED HALO & EINSTEIN RING (Billboard quanh Chân Trời Sự Kiện)
 *  Tái tạo ánh sáng từ nửa sau của đĩa bồi tụ bị trường hấp dẫn bẻ cong
 *  vòng qua phía trên & phía dưới bóng đen (Shadow / Event Horizon).
 * ===================================================================== */
export const haloVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const haloFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uIntensity;
uniform float uAlpha;
uniform float uRoll;
${NOISE}

void main() {
  // Quy đổi toạ độ mặt phẳng về đơn vị bán kính Event Horizon (R_HORIZON = 1.0)
  vec2 p = (vUv - 0.5) * 9.0;
  float c = cos(uRoll), s = sin(uRoll);
  p = mat2(c, -s, s, c) * p;

  float r = length(p);
  float a = atan(p.y, p.x);

  // Tập trung vòm bẻ cong ở cực trên và cực dưới của bóng hố đen
  float vert = pow(abs(p.y) / max(r, 1e-3), 1.35);
  float flow = fbm3(vec3(cos(a - uTime * 1.1) * 2.6, sin(a - uTime * 1.1) * 2.6, r * 2.4 - uTime * 0.35));

  // Vòm chính & vòm phụ (ảnh bậc 1 và bậc 2 của đĩa bồi tụ sau hố đen)
  float archInner = exp(-pow((r - 1.36) / 0.24, 2.0)) * vert;
  float archMid   = exp(-pow((r - 1.72) / 0.48, 2.0)) * vert * 0.72;
  float archOuter = exp(-pow((r - 2.35) / 0.75, 2.0)) * vert * 0.32;

  // Bất đối xứng Doppler nhẹ đồng bộ với chiều quay của đĩa bồi tụ
  float dopplerAsym = 0.82 + 0.36 * smoothstep(1.2, -1.2, p.x);

  // Vòng Einstein (Einstein Ring) + Vòng Photon mảnh bao quanh bóng tối
  float einstein = exp(-pow((r - 1.18) / 0.09, 2.0)) * 0.55;
  float photon   = exp(-pow((r - 1.07) / 0.028, 2.0)) * (1.15 + 0.3 * sin(uTime * 2.6 + a * 3.0));

  vec3 cCyan   = vec3(0.72, 0.96, 1.00);
  vec3 cGold   = vec3(1.00, 0.62, 0.14);
  vec3 cViolet = vec3(0.72, 0.12, 0.85);

  vec3 col = cCyan * archInner * 0.95
           + cGold * archMid * 0.85
           + cViolet * archOuter * 0.75;
  col *= (0.55 + 0.75 * flow) * dopplerAsym;
  col += vec3(0.70, 0.92, 1.00) * (einstein * 0.45 + photon * 0.85);

  // Cắt tuyệt đối vùng r <= 1.02 để giữ lõi Event Horizon đen tuyền #000000
  float inside  = smoothstep(1.02, 1.10, r);
  float outside = 1.0 - smoothstep(3.5, 4.45, r);
  col = min(col * uIntensity, vec3(2.2));

  gl_FragColor = vec4(col, inside * outside * uAlpha);
}`

/* =====================================================================
 *  PHOTON RING (Torus mảnh phát sáng trắng-cyan với hiệu ứng xung nhịp)
 * ===================================================================== */
export const ringVert = /* glsl */ `
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const ringFrag = /* glsl */ `
precision highp float;
varying vec3 vP;
uniform float uTime;
uniform float uIntensity;
uniform float uAlpha;

void main() {
  float a = atan(vP.y, vP.x);
  float pulse = 0.72 + 0.28 * sin(uTime * 3.2 - a * 2.0) + 0.12 * sin(uTime * 6.5 + a * 5.0);
  vec3 col = mix(vec3(0.72, 0.95, 1.0), vec3(1.0), 0.45) * 1.35 * pulse * uIntensity;
  gl_FragColor = vec4(min(col, vec3(2.2)), uAlpha);
}`

/* =====================================================================
 *  EVENT HORIZON RIM DISTORTION (Viền biến dạng Fresnel sát mép chân trời)
 * ===================================================================== */
export const rimVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

export const rimFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vV;
uniform float uIntensity;
uniform float uAlpha;
uniform float uTime;

void main() {
  float ndv = max(dot(normalize(vN), normalize(vV)), 0.0);
  // Chỉ phát sáng ở sát rìa tiếp tuyến (ndv -> 0), tâm hướng về camera bằng 0 tuyệt đối
  float f = pow(1.0 - ndv, 7.0) * smoothstep(0.45, 0.0, ndv);
  vec3 col = mix(vec3(0.15, 0.65, 1.0), vec3(1.0, 0.58, 0.22), 0.5 + 0.5 * sin(uTime * 0.7));
  gl_FragColor = vec4(col * f * 1.15 * uIntensity, f * uAlpha);
}`
