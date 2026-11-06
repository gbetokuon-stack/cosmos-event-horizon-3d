import { NOISE } from './common'

/* ---------------- NEBULA volumetric (domain-warped fbm + Dragon Maid plasma illumination) ---------------- */
export const nebulaFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
uniform float uSeed; uniform float uTime; uniform float uOpacity;
uniform vec4 uDragonPos[4];
uniform vec3 uDragonCol[4];
${NOISE}
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  vec2 q = p * 1.6 + uSeed * 10.0;
  vec2 w = vec2(fbm2(q + uTime * 0.010), fbm2(q + 5.2 - uTime * 0.008));
  float n = fbm2(q + 2.5 * w);
  float m = smoothstep(1.0, 0.12, r);
  float d = pow(smoothstep(0.25, 0.92, n), 1.4) * m;
  vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, n));
  col = mix(col, uC, smoothstep(0.55, 1.0, w.x) * 0.6);
  col += uC * pow(max(n - 0.7, 0.0), 2.0) * 6.0;

  // Ánh sáng cyan/amber từ Dragon Maids bay ngang hắt lên dải mây tinh vân cùng hướng nhìn
  vec3 viewDir = normalize(vWorldPos);
  for(int i = 0; i < 4; i++){
    if(uDragonPos[i].w > 0.01){
      vec3 dDir = normalize(uDragonPos[i].xyz);
      float align = max(dot(viewDir, dDir), 0.0);
      float scatter = pow(align, 18.0) * uDragonPos[i].w * (0.5 + n);
      col += uDragonCol[i] * scatter * 1.35;
    }
  }

  gl_FragColor = vec4(col * d * uOpacity, d * uOpacity);
}`

export const spriteVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

/* ---------------- SKY DOME: gradient #1a0b2e (chân trời) -> đen ---------------- */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
export const skyFrag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uOpacity;
void main(){
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 horizon = vec3(0.102, 0.043, 0.18);   // #1a0b2e
  vec3 mid     = vec3(0.039, 0.039, 0.122);  // #0a0a1f
  vec3 top     = vec3(0.004, 0.004, 0.015);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
  col = mix(col, top, smoothstep(0.15, 0.9, h));
  float glow = exp(-h * 9.0) * (0.5 + 0.5 * smoothstep(-1.0, -0.2, vDir.z * -1.0));
  col += vec3(0.10, 0.06, 0.22) * glow * 0.6;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}`

/* ---------------- COSMIC DUST (Points) ---------------- */
export const dustVert = /* glsl */ `
attribute float aSize; attribute float aPhase; attribute vec3 aColor;
uniform float uTime; uniform float uPx; uniform float uOpacity;
varying vec3 vColor; varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.10 + aPhase * 20.0) * 2.0;
  p.y += sin(uTime * 0.07 + aPhase * 13.0) * 1.5 + uTime * 0.15 * (0.3 + fract(aPhase * 7.0));
  p.y = mod(p.y, 40.0);
  p.z += cos(uTime * 0.08 + aPhase * 9.0) * 2.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = clamp(aSize * uPx * (55.0 / max(dist, 1.0)), 0.8, 14.0);
  float tw = 0.45 + 0.55 * sin(uTime * (0.6 + aPhase) + aPhase * 50.0);
  vA = smoothstep(2.0, 8.0, dist) * (1.0 - smoothstep(35.0, 75.0, dist)) * tw * uOpacity;
  vColor = aColor;
}`
export const dustFrag = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-d * d * 4.0) * (1.0 - smoothstep(0.9, 1.0, d));
  gl_FragColor = vec4(vColor * g * 1.4, g * vA * 0.7);
}`

/* ---------------- SƯƠNG MÙ SÁT MẶT ĐẤT (có hắt sáng động từ Dragon Maids) ---------------- */
export const fogVert = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
export const fogFrag = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime; uniform float uOp; uniform float uSc; uniform vec3 uCam;
uniform vec4 uDragonPos[4];
uniform vec3 uDragonCol[4];
${NOISE}
void main(){
  vec2 q = vWorld.xz * 0.012 * uSc + vec2(uTime * 0.012, -uTime * 0.008);
  float n = fbm2(q) * 1.4;
  float d = length(vWorld.xz - uCam.xz);
  float fade = 1.0 - smoothstep(60.0, 420.0, d);
  float a = smoothstep(0.25, 0.9, n) * uOp * fade;
  vec3 col = mix(vec3(0.102, 0.043, 0.18), vec3(0.17, 0.23, 0.48), n);

  // Ánh sáng cyan/amber từ Dragon Maids bay tầm thấp hắt trực tiếp xuống màn sương mặt đất
  for(int i = 0; i < 4; i++){
    if(uDragonPos[i].w > 0.01){
      float dist3 = length(vWorld - uDragonPos[i].xyz);
      float att = uDragonPos[i].w * 520.0 / (dist3 * dist3 + 180.0);
      col += uDragonCol[i] * att;
      a = min(1.0, a + att * 0.22 * fade);
    }
  }

  gl_FragColor = vec4(col * a, a);
}`
