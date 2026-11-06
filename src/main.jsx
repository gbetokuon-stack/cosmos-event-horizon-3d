import React from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import App from './App'
import './index.css'

// Chỉ để debug/test trên GPU phần mềm rất chậm: ?nolag
if (new URLSearchParams(window.location.search).has('nolag')) gsap.ticker.lagSmoothing(0)

// Không dùng StrictMode để tránh double-mount làm khởi tạo GSAP / WebGL hai lần
createRoot(document.getElementById('root')).render(<App />)
