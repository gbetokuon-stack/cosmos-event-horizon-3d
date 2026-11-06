// ============================================================================
// GRAVITATIONAL LENSING & WAVE POST-PROCESS SHADER (gravitationalLensing.glsl)
// Uốn cong ánh sáng các ngôi sao & tinh vân phía sau Hố Đen + Sóng hấp dẫn khi click
// ============================================================================
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;
uniform float uAspect;
uniform vec2 uWaveC;
uniform float uWaveR;
uniform float uWaveA;
uniform float uBarrel;
uniform float uExposure;

void mainUv(inout vec2 uv) {
  // 1. Biến dạng thấu kính góc rộng nhẹ (Lens Barrel Distortion)
  vec2 c = uv - vec2(0.5);
  uv += c * dot(c, c) * uBarrel;

  // 2. Thấu kính hấp dẫn Einstein quanh Chân trời sự kiện: θ_E ~ Rs / r
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float r = length(d) + 1e-5;
  float k = min(uStrength * uRadius * uRadius / (r * r), 0.96);
  vec2 dd = d * (1.0 - k);
  dd.x /= uAspect;
  uv = uCenter + dd;

  // 3. Gợn sóng hấp dẫn (Gravitational Wave) lan tỏa từ vị trí click
  vec2 w = uv - uWaveC;
  w.x *= uAspect;
  float wr = length(w) + 1e-5;
  float x = (wr - uWaveR) / 0.045;
  float ring = exp(-x * x) * uWaveA;
  vec2 dir = w / wr;
  dir.x /= uAspect;
  uv += dir * ring * 0.025;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 w = uv - uWaveC;
  w.x *= uAspect;
  float x = (length(w) - uWaveR) / 0.03;
  float ring = exp(-x * x) * uWaveA;
  vec3 col = inputColor.rgb * uExposure + vec3(0.25, 0.45, 1.0) * ring * 0.25;
  outputColor = vec4(col, inputColor.a);
}
