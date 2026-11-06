import { Effect } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import { wrapEffect } from '@react-three/postprocessing'

/**
 * LENSING EFFECT (post-process, screen-space)
 *  1. Gravitational lensing: uv' = c + d·(1 - k),  k = strength·(Rs/r)²
 *     -> mọi thứ phía sau (sao, nebula) bị bẻ cong & kéo giãn quanh hố đen,
 *        tạo Einstein ring khi nhìn nghiêng.
 *  2. Lens distortion (barrel) nhẹ toàn màn hình.
 *  3. Sóng hấp dẫn (click): vòng méo lan toả.
 *  4. Exposure (ACES tone mapping nằm ở effect sau).
 */
const frag = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;
uniform float uAspect;
uniform vec2 uWaveC;
uniform float uWaveR;
uniform float uWaveA;
uniform float uBarrel;
uniform float uExposure;

void mainUv(inout vec2 uv){
  vec2 c = uv - vec2(0.5);
  uv += c * dot(c, c) * uBarrel;                   // barrel distortion

  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float r = length(d) + 1e-5;
  float k = min(uStrength * uRadius * uRadius / (r * r), 0.96);
  vec2 dd = d * (1.0 - k);
  dd.x /= uAspect;
  uv = uCenter + dd;

  vec2 w = uv - uWaveC;                            // sóng hấp dẫn
  w.x *= uAspect;
  float wr = length(w) + 1e-5;
  float x = (wr - uWaveR) / 0.045;
  float ring = exp(-x * x) * uWaveA;
  vec2 dir = w / wr;
  dir.x /= uAspect;
  uv += dir * ring * 0.025;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 w = uv - uWaveC;
  w.x *= uAspect;
  float x = (length(w) - uWaveR) / 0.03;
  float ring = exp(-x * x) * uWaveA;
  vec3 col = inputColor.rgb * uExposure + vec3(0.25, 0.45, 1.0) * ring * 0.25;
  outputColor = vec4(col, inputColor.a);
}
`

class LensingEffectImpl extends Effect {
  constructor({ barrel = 0.05, exposure = 1.2 } = {}) {
    super('LensingEffect', frag, {
      uniforms: new Map([
        ['uCenter', new Uniform(new Vector2(0.5, 0.6))],
        ['uRadius', new Uniform(0.05)],
        ['uStrength', new Uniform(0)],
        ['uAspect', new Uniform(1)],
        ['uWaveC', new Uniform(new Vector2(0.5, 0.5))],
        ['uWaveR', new Uniform(0)],
        ['uWaveA', new Uniform(0)],
        ['uBarrel', new Uniform(barrel)],
        ['uExposure', new Uniform(exposure)],
      ]),
    })
  }
}

export const Lensing = wrapEffect(LensingEffectImpl)
