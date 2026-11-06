import { NOISE } from './common'

/* ---------------- SAO (Points) ---------------- */
export const starVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
uniform float uTwinkle;
uniform float uScale;
varying vec3 vColor;
varying float vTw;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // mỗi sao nhấp nháy riêng nhờ phase offset
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (1.2 + aPhase * 0.8) + aPhase * 40.0));
  vTw = tw;
  vColor = aColor;
  gl_PointSize = aSize * uPx * uScale * (0.75 + 0.5 * tw);
}`

export const starFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vTw;
uniform float uOpacity;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-d * d * 10.0);
  float halo = exp(-d * 3.5) * 0.35;
  float mask = 1.0 - smoothstep(0.9, 1.0, d);
  gl_FragColor = vec4(vColor * (core * 2.2 + halo), (core + halo) * mask * uOpacity * vTw);
}`

/* ---------------- MILKY WAY ---------------- */
export const milkyVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

export const milkyFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
${NOISE}
void main(){
  float across = (vUv.y - 0.5) * 2.0;
  float core = exp(-across * across * 9.0);
  float wide = exp(-across * across * 2.5);
  vec2 q = vec2(vUv.x * 8.0, vUv.y * 2.2);
  float n  = fbm2(q * 2.0 + uTime * 0.003);
  float n2 = fbm2(q * 6.0 + 3.0);
  float dust = smoothstep(0.45, 0.75, fbm2(q * 4.0 + vec2(9.0, 2.0))) * core;   // dải bụi tối
  float dens = (core * (0.45 + n * 1.3) + wide * 0.28 * n2) * (1.0 - dust * 0.78);
  float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  vec3 col = mix(vec3(0.30, 0.42, 0.95), vec3(1.0, 0.80, 0.58), core * n);
  col = mix(col, vec3(0.75, 0.30, 0.75), wide * 0.25 * n2);
  float grain = step(0.987, hash21(floor(vUv * vec2(1500.0, 400.0)))) * core * 1.6;   // bụi sao li ti
  gl_FragColor = vec4((col * dens * 0.8 + vec3(grain) * 0.5) * edge * uOpacity, edge * uOpacity);
}`

/* ---------------- THIÊN HÀ XA (xoắn ốc) ---------------- */
export const galaxyFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uRot;
uniform float uTilt;
uniform float uOp;
uniform vec3 uTint;
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float c = cos(uRot), s = sin(uRot);
  p = mat2(c, -s, s, c) * p;
  p.y /= uTilt;
  float r = length(p);
  float a = atan(p.y, p.x);
  float arms = pow(0.5 + 0.5 * cos(2.0 * (a - log(r + 0.05) * 3.2)), 3.0) * exp(-r * 2.6);
  float core = exp(-r * r * 38.0);
  float disk = exp(-r * 3.4) * 0.4;
  vec3 col = mix(uTint, vec3(1.0, 0.88, 0.65), core);
  float alpha = (arms * 0.75 + core * 1.5 + disk * 0.3) * (1.0 - smoothstep(0.8, 1.0, r)) * uOp;
  gl_FragColor = vec4(col * alpha, alpha);
}`

/* ---------------- SAO BĂNG ---------------- */
export const shootFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uLife;
void main(){
  float body = pow(vUv.x, 3.0) * (1.0 - pow(abs(vUv.y * 2.0 - 1.0), 2.0));
  float head = exp(-pow((vUv.x - 0.97) / 0.03, 2.0)) * exp(-pow((vUv.y - 0.5) / 0.15, 2.0));
  vec3 col = mix(vec3(0.6, 0.8, 1.0), vec3(1.0), vUv.x) * (body * 2.0 + head * 5.0);
  gl_FragColor = vec4(col * uLife, (body + head) * uLife);
}`
