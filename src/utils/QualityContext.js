import { createContext, useContext } from 'react'

// Context chia sẻ cấu hình chất lượng (tier, scale, dpr...) cho mọi component 3D
export const QualityContext = createContext({ scale: 1, dpr: 1, tier: 2, mobile: false })
export const useQuality = () => useContext(QualityContext)
