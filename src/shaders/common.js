// Thư viện noise GLSL dùng chung (value noise + fbm)
export const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

float noise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.,0.)), f.x),
             mix(hash21(i + vec2(0.,1.)), hash21(i + vec2(1.,1.)), f.x), f.y);
}
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.,0.,0.)), f.x),
        mix(hash31(i + vec3(0.,1.,0.)), hash31(i + vec3(1.,1.,0.)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.,0.,1.)), hash31(i + vec3(1.,0.,1.)), f.x),
        mix(hash31(i + vec3(0.,1.,1.)), hash31(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
}
float fbm2(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise2(p); p = p * 2.02 + vec2(17., 9.); a *= 0.5; }
  return v;
}
float fbm3(vec3 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += a * noise3(p); p = p * 2.03 + vec3(11., 5., 3.); a *= 0.5; }
  return v;
}
`
