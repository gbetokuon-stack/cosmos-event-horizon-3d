// ============================================================================
// IRIDESCENT DRAGON WING PBR FRAGMENT SHADER (dragonWingIridescent.glsl)
// Mô phỏng vảy rồng tráng gương (tím - xanh cyan - ngọc lục bảo), khói plasma
// rìa cánh, và hiệu ứng Depth-of-Field khi lướt sát camera.
// ============================================================================
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vMembrane;

uniform sampler2D uScaleMap;
uniform vec3 uBaseTint;
uniform vec3 uIridescentA;
uniform vec3 uIridescentB;
uniform vec3 uPlasmaCol;
uniform vec3 uHolePos;
uniform float uSpeedNorm;
uniform float uNearBlur;
uniform float uTime;

void main() {
  vec2 uvScaled = vUv * vec2(2.6, 2.2);
  float blurStep = uNearBlur * 0.018;
  vec3 texC = texture2D(uScaleMap, uvScaled).rgb;
  if (uNearBlur > 0.02) {
    texC = 0.4 * texC
         + 0.15 * texture2D(uScaleMap, uvScaled + vec2(blurStep, 0.0)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled - vec2(blurStep, 0.0)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled + vec2(0.0, blurStep)).rgb
         + 0.15 * texture2D(uScaleMap, uvScaled - vec2(0.0, blurStep)).rgb;
  }

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

  float fresnel = pow(1.0 - ndv, 2.4);
  vec3 irid = mix(uBaseTint, uIridescentA, smoothstep(0.1, 0.65, fresnel));
  irid = mix(irid, uIridescentB, smoothstep(0.55, 0.98, fresnel));

  float scaleLuma = dot(texC, vec3(0.299, 0.587, 0.114));
  vec3 albedo = texC * 0.65 + irid * (0.45 + scaleLuma * 0.85);

  vec3 col = albedo * (vec3(0.22, 0.24, 0.38) + ndl * 0.95)
           + mix(irid, vec3(1.0), 0.35) * pow(ndh, 42.0) * (0.55 + scaleLuma * 0.95) * 1.35;
  gl_FragColor = vec4(min(col, vec3(2.8)), 1.0);
}
