// ============================================================================
// ACCRETION DISK FRAGMENT SHADER (accretionDisk.glsl)
// Mô phỏng đĩa bồi tụ 3 vành tốc độ (3.0 / 1.5 / 0.5 vòng/giây) + Doppler + Fresnel
// ============================================================================
precision highp float;
varying vec2 vPos;
varying vec3 vWorld;
varying vec3 vTan;
varying vec3 vNrm;

uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform float uIntensity;
uniform float uAlpha;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.,0.,0.)), f.x),
        mix(hash31(i + vec3(0.,1.,0.)), hash31(i + vec3(1.,1.,0.)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.,0.,1.)), hash31(i + vec3(1.,0.,1.)), f.x),
        mix(hash31(i + vec3(0.,1.,1.)), hash31(i + vec3(1.,1.,1.)), f.x), f.y), f.z
  );
}

float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.03 + vec3(11., 5., 3.);
    a *= 0.5;
  }
  return v;
}

vec3 ringColor(float t, float f) {
  vec3 inner = mix(vec3(0.878, 1.0, 1.0), vec3(0.0, 0.831, 1.0), f);   // #e0ffff -> #00d4ff
  vec3 mid   = mix(vec3(1.0, 0.42, 0.0),  vec3(1.0, 0.843, 0.0), f);   // #ff6b00 -> #ffd700
  vec3 outer = mix(vec3(1.0, 0.0, 0.267), vec3(0.545, 0.0, 1.0), f);   // #ff0044 -> #8b00ff
  vec3 c = mix(inner, mid, smoothstep(0.14, 0.44, t));
  return mix(c, outer, smoothstep(0.50, 0.88, t));
}

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

  float T = uTime * 6.2831853;
  float m0 = 1.0 - smoothstep(0.18, 0.42, t);
  float m2 = smoothstep(0.52, 0.80, t);
  float m1 = clamp(1.0 - m0 - m2, 0.0, 1.0);

  float f = 0.0;
  if (m0 > 0.005) f += m0 * ringNoise(ang + T * 3.0, r, 0.0);
  if (m1 > 0.005) f += m1 * ringNoise(ang + T * 1.5, r, 4.3);
  if (m2 > 0.005) f += m2 * ringNoise(ang + T * 0.5, r, 9.1);

  float radial = pow(1.0 - t, 1.75) * 1.45 + 0.12;
  float filaments = 0.58 + 0.42 * sin(r * 1.45 + f * 7.5);
  float structure = (0.32 + 1.15 * f) * filaments;

  vec3 V = normalize(cameraPosition - vWorld);
  float beta = 0.38 * sqrt(uInner / max(r, uInner));
  float D = clamp(1.0 / (1.0 - beta * dot(vTan, V)), 0.62, 1.68);
  float beam = pow(D, 2.1);

  vec3 col = ringColor(t, clamp(f * 1.25, 0.0, 1.0));
  col *= mix(vec3(1.18, 0.72, 0.55), vec3(0.82, 0.96, 1.25), smoothstep(0.75, 1.35, D));

  float fr = pow(1.0 - abs(dot(vNrm, V)), 2.2);
  col *= 1.0 + fr * 0.65;
  col += vec3(0.55, 0.92, 1.0) * exp(-t * 18.0) * 0.65;

  float edge = smoothstep(0.0, 0.045, t) * (1.0 - smoothstep(0.74, 1.0, t));
  col *= radial * structure * beam * uIntensity * 0.42;
  gl_FragColor = vec4(min(col, vec3(2.4)), edge * uAlpha);
}
