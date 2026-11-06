/* =====================================================================
 *  RELATIVISTIC JETS + HAWKING RADIATION
 *  Toàn bộ vị trí tính trong vertex shader từ (aSeed, uTime) -> 0 CPU / frame.
 * ===================================================================== */

export const jetVert = /* glsl */ `
attribute float aSeed;
attribute float aSign;
uniform float uTime;
uniform float uLen;
uniform float uRH;
uniform float uPx;
uniform float uHover;
varying vec3 vColor;
varying float vA;
void main(){
  float life = fract(aSeed * 7.13 + uTime * 0.2 * (0.7 + aSeed * 0.6));
  float t = life;
  float ang = aSeed * 6.2831853 * 13.0 + t * 9.0;               // xoắn ốc quanh trục
  float spread = 0.25 + 0.75 * fract(aSeed * 91.7);
  float rad = mix(0.4, 6.5, t) * spread;                         // jet loe dần
  vec3 pos = vec3(cos(ang) * rad, sin(ang) * rad, aSign * (uRH * 0.9 + t * uLen));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((3.0 + 7.0 * (1.0 - t)) * uPx * (140.0 / -mv.z), 1.0, 26.0);
  vColor = mix(vec3(0.255, 0.412, 1.0), vec3(1.0, 0.0, 1.0), smoothstep(0.1, 0.9, t)) * (1.4 + uHover * 1.2);
  vA = pow(1.0 - t, 1.5) * smoothstep(0.0, 0.05, t);
}`

export const jetFrag = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vA;
uniform float uAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d));
  gl_FragColor = vec4(vColor * g, g * vA * uAlpha * 0.55);
}`

export const hawkVert = /* glsl */ `
attribute vec3 aDir;
attribute float aSeed;
uniform float uTime;
uniform float uRH;
uniform float uRange;
uniform float uPx;
varying float vA;
void main(){
  float t = fract(aSeed + uTime * 0.12 * (0.5 + aSeed));
  vec3 pos = aDir * (uRH * 1.02 + t * uRange * (0.4 + fract(aSeed * 13.7)));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.2 * uPx * (150.0 / -mv.z), 1.0, 6.0);
  vA = pow(1.0 - t, 2.0) * smoothstep(0.0, 0.05, t);
}`

export const hawkFrag = /* glsl */ `
precision highp float;
varying float vA;
uniform float uAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-d * d * 4.0);
  gl_FragColor = vec4(vec3(0.75, 0.92, 1.0) * g * 1.6, g * vA * uAlpha);
}`
