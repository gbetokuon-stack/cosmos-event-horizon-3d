/**
 * Phát hiện "GPU tier" nhẹ (không cần tải dữ liệu benchmark ngoài).
 *  tier 0: không WebGL / GPU phần mềm / máy rất yếu  -> ảnh tĩnh (Fallback)
 *  tier 1: mobile
 *  tier 2: desktop tầm trung
 *  tier 3: desktop mạnh
 * Có thể ép bằng ?tier=0..3 trên URL.
 */
export function getQuality() {
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth < 768
  const params = new URLSearchParams(window.location.search)

  let renderer = ''
  let hasGL = false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (gl) {
      hasGL = true
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''
    }
  } catch (e) {
    hasGL = false
  }

  const software = /SwiftShader|llvmpipe|Software|Basic Render|softpipe/i.test(renderer)
  const mem = navigator.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4

  let tier
  if (!hasGL || software || mem <= 1 || cores <= 2) tier = 0
  else if (mobile) tier = 1
  else tier = mem >= 8 && cores >= 8 ? 3 : 2

  if (params.has('tier')) tier = Math.max(0, Math.min(3, parseInt(params.get('tier'), 10) || 0))

  const mobileLike = mobile || tier === 1
  return {
    tier,
    mobile: mobileLike,
    scale: mobileLike ? 0.5 : 1, // giảm 50% số hạt trên mobile
    dpr: Math.min(window.devicePixelRatio || 1, 2), // clamp DPR
    ssao: tier >= 2 && !mobileLike, // tắt SSAO trên mobile
    msaa: mobileLike ? 0 : tier >= 3 ? 4 : 2,
    reflRes: mobileLike ? 512 : 1024,
    godRaySamples: mobileLike ? 30 : 60,
  }
}
