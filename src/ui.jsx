import React, { useEffect, useRef, useState } from 'react'
import { motion, animate, useReducedMotion } from 'framer-motion'

export const spring = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }
export const softSpring = { type: 'spring', stiffness: 260, damping: 26 }

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ player, size = 'md', active }) {
  return (
    <span
      className={`avatar ${size} ${active ? 'active' : ''}`}
      style={{ '--c': player.color || '#6366f1' }}
      aria-hidden="true"
    >
      {initials(player.name)}
    </span>
  )
}

// Animates numeric changes with a short count-up.
export function CountUp({ value, className, duration = 0.7 }) {
  const ref = useRef(null)
  const prev = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (!ref.current) return undefined
    if (reduce || from === value) {
      ref.current.textContent = String(value)
      return undefined
    }
    const ctrl = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => ctrl.stop()
  }, [value, duration, reduce])
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}

export function Segmented({ value, onChange, options, id = 'seg' }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={'seg-btn ' + (value === o.value ? 'on' : '')}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <motion.span layoutId={id} className="seg-ind" transition={spring} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Ring({ progress, size = 56, stroke = 5, color = 'var(--accent)', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, progress))) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ rotate: -90, transformOrigin: '50% 50%' }}
        />
      </svg>
      <span className="ring-inner">{children}</span>
    </span>
  )
}

export function Toast({ text }) {
  return (
    <motion.div
      className="toast"
      role="status"
      initial={{ y: -16, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -10, opacity: 0, scale: 0.98 }}
      transition={spring}
    >
      {text}
    </motion.div>
  )
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('kniffel.theme') || 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem('kniffel.theme')
      else localStorage.setItem('kniffel.theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  const toggle = () => setTheme(isDark ? 'light' : 'dark')
  return { theme, isDark, toggle }
}

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button className="icon-btn" onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

export function Icon({ name, size = 20 }) {
  const common = { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  switch (name) {
    case 'back':
      return (
        <svg {...common}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      )
    case 'share':
      return (
        <svg {...common}>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      )
    default:
      return null
  }
}
