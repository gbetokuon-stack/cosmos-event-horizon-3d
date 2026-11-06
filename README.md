# COSMOS ∞ — Beyond the Event Horizon & Realistic Dragon Maids

Trải nghiệm 3D điện ảnh tương tác chủ đề **"Đứng dưới Vũ Trụ, Hố Đen & Thực Thể Dragon Maid Tả Thực"**, xây dựng bằng **React 18 + Three.js (r160) + React Three Fiber + Drei + Postprocessing + GSAP ScrollTrigger + Custom GLSL Shaders + TailwindCSS + Zustand**.

## Cài đặt & Chạy dự án

```bash
cd cosmos-bh
npm install --legacy-peer-deps
npm run dev
```

Build bản Production tối ưu:

```bash
npm run build
npm run preview
```

## Cấu trúc thư mục

```text
cosmos-bh/
├── index.html                              # Entry HTML + Google Fonts (Orbitron, Space Grotesk, Inter)
├── package.json                            # Dependencies (Three r160, R3F, Drei, Postprocessing, GSAP, Zustand)
├── public/
│   └── textures/                           # PBR Textures tả thực (Dark-Fantasy AAA, không anime)
│       ├── face_albedo.jpg                 # Khuôn mặt nữ chiến binh người thật chi tiết lỗ chân lông
│       ├── armor_brocade.jpg               # Giáp lụa đen thêu chỉ vàng kim & da hắc diện thạch
│       └── wing_scales.jpg                 # Vảy rồng tráng gương & gân cánh da chi tiết cao
└── src/
    ├── main.jsx                            # Khởi tạo React 18 root
    ├── App.jsx                             # Phân tầng chất lượng GPU (Fallback tĩnh cho tier 0) + Scroll 700vh
    ├── index.css                           # Glassmorphism, conic-gradient xoay, glow pulse animations
    ├── store.js                            # Zustand store + biến runtime `rt` (kèm camera shake & dragon glow lights)
    ├── constants.js                        # Tham số vật lý & bố cục Hố Đen / Camera
    ├── components/
    │   ├── Experience.jsx                  # R3F Canvas, ACES Filmic, Fog #0a0a1f, PerformanceMonitor
    │   ├── BlackHole.jsx                   # Event Horizon #000000, Accretion Disk 3 vành, Photon Ring, Einstein Halo
    │   ├── Jets.jsx                        # Relativistic Plasma Jets (2 cực) + Hawking Radiation particles
    │   ├── DragonMaidRig.js                # Mô hình 3D PBR tỉ lệ người thật 1:7.5, SkinnedMesh đuôi 6 đốt, AnimationMixer & LOD Baker
    │   ├── DragonMaids.jsx                 # Object Pool 10 cá thể, Cubic Bézier 4 hướng, Banking Roll, Ribbon Trails, Shockwaves, Embers
    │   ├── StarField.jsx                   # 50,000+ sao 3 tầng sâu, Milky Way chéo, 26 thiên hà xoắn ốc, 5 sao băng
    │   ├── Nebula.jsx                      # SkyDome, 7 lớp Nebula volumetric (nhận hắt sáng từ Dragon Maids), 10,000 hạt bụi
    │   ├── Ground.jsx                      # Gương nước đen phản chiếu + Sine Wave + Sương mù hắt sáng động + Đá/Cỏ
    │   ├── CameraRig.jsx                   # FOV 80->90, breathing ±0.5°, mouse parallax, scroll zoom & fly-by camera shake
    │   └── PostFX.jsx                      # HalfFloat HDR Composer: Lensing -> GodRays -> Bloom -> SSAO -> ACES -> CA -> Film -> Vignette
    ├── effects/
    │   └── LensingEffect.js                # Custom Postprocessing Effect: Gravitational Lensing + Barrel Distortion + Gravitational Wave
    ├── shaders/
    │   ├── common.js                       # Hash, 2D/3D Value Noise & FBM dùng chung
    │   ├── blackhole.js                    # GLSL Shaders cho Accretion Disk (Doppler + Fresnel), Einstein Halo, Photon Ring, Rim
    │   ├── dragonMaid.js                   # Iridescent Wing PBR Shader (kèm DoF blur gần), Plasma Ribbon, Supersonic Shockwave, Embers & LOD Sprite
    │   ├── jets.js                         # GPU Vertex/Fragment Shaders cho Relativistic Jets & Hawking Radiation
    │   ├── stars.js                        # GLSL Shaders cho Sao nhấp nháy theo nhiệt độ, Milky Way, Thiên hà & Sao băng
    │   ├── nebula.js                       # Domain-warped FBM Nebula, SkyDome, Cosmic Dust & Volumetric Ground Fog
    │   └── glsl/                           # Các file .glsl độc lập tham khảo
    │       ├── accretionDisk.glsl
    │       ├── gravitationalLensing.glsl
    │       └── dragonWingIridescent.glsl
    ├── ui/
    │   ├── Loader.jsx                      # Màn hình tải vòng tròn Hố Đen + GSAP Entrance Timeline (0s -> 4s+)
    │   ├── Overlay.jsx                     # HUD Glassmorphism tối giản, chữ hiện từng ký tự, nút EXPLORE, ScrollTrigger
    │   └── Fallback.jsx                    # Chế độ tĩnh tự động cho thiết bị GPU yếu / không có WebGL
    └── utils/
        ├── quality.js                      # Nhận diện GPU Tier, DPR clamp <= 2, giảm 50% hạt & tắt SSAO trên mobile
        ├── QualityContext.js               # React Context truyền cấu hình hiệu năng xuống toàn bộ cây 3D
        └── audio.js                        # Web Audio Synth: Vũ trụ nền + Spatial Whoosh (pan trái/phải), Wing Flap & Dragon Rumble
```
