import { create } from 'zustand'

/**
 * Zustand: state "React" (ảnh hưởng UI / mount component).
 */
export const useStore = create((set) => ({
  sceneReady: false, // Canvas đã mount + frame đầu đã render
  started: false, // Loading xong, intro bắt đầu
  soundOn: false,
  sun: null, // mesh nguồn sáng cho GodRays
  setSceneReady: (v) => set({ sceneReady: v }),
  setStarted: (v) => set({ started: v }),
  setSoundOn: (v) => set({ soundOn: v }),
  setSun: (m) => set({ sun: m }),
}))

/**
 * "rt" = runtime state mutable, đọc/ghi mỗi frame trong useFrame
 * (không đi qua React để tránh re-render 60 lần/giây).
 */
export const rt = {
  time: 0, // giây, tích luỹ (đã clamp delta)
  dt: 0.016,
  diskT: 0, // thời gian xoay của đĩa (tích luỹ theo tốc độ)
  scroll: 0, // 0..1 từ ScrollTrigger
  sm: 0, // scroll đã làm mượt
  e: 0, // scroll sau easing (tiến gần hố đen)
  mouse: { x: 0, y: 0 }, // -1..1
  mx: 0,
  my: 0,
  hoverTarget: 0,
  hover: 0, // 0..1 (làm mượt)
  wave: { t0: -100, x: 0.5, y: 0.5 }, // sóng hấp dẫn khi click
  // Chấn động camera (độ, 0.3 - 0.5°) khi Dragon Maid vụt sát qua bán kính <= 5 units
  shake: { amp: 0, freq: 26 },
  // Tối đa 4 nguồn sáng động từ Dragon Maids đang bay (x, y, z, intensity; r, g, b) để hắt sáng mây/nebula/sương mù
  dragonGlowPos: [
    [0, -9999, 0, 0],
    [0, -9999, 0, 0],
    [0, -9999, 0, 0],
    [0, -9999, 0, 0],
  ],
  dragonGlowCol: [
    [0, 0.9, 1],
    [1, 0.65, 0.1],
    [0, 0.9, 1],
    [1, 0.65, 0.1],
  ],
  // Các giá trị GSAP intro điều khiển
  intro: { hole: 0, disk: 0, stars: 0 },
}
