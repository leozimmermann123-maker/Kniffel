import React, { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { spring } from './ui.jsx'

const ORIENT = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
}
const FACES = [
  { cls: 'front', v: 1 },
  { cls: 'back', v: 6 },
  { cls: 'right', v: 3 },
  { cls: 'left', v: 4 },
  { cls: 'top', v: 5 },
  { cls: 'bottom', v: 2 },
]
const PIPS = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Face({ cls, v }) {
  const pips = PIPS[v]
  return (
    <span className={`cface ${cls}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={pips.includes(i) ? 'pip' : ''} />
      ))}
    </span>
  )
}

// A real 3D cube. Each roll adds full turns so the die tumbles to its new face.
export function Die({ value, held, faded, onClick, interactive = false, rollKey = 0, size = 64, index = 0, tilt = 0 }) {
  const reduce = useReducedMotion()
  const turns = useRef(0)
  const lastKey = useRef(rollKey)
  if (rollKey !== lastKey.current) {
    lastKey.current = rollKey
    if (!held) turns.current += 1
  }
  const o = ORIENT[value] || ORIENT[1]
  const k = reduce ? 0 : turns.current
  const dir = index % 2 ? -1 : 1
  const target = { rotateX: o.x + 360 * k, rotateY: o.y + 360 * k * dir }
  const Tag = interactive ? motion.button : motion.div
  const label = `Die showing ${value}${held ? ', held' : ''}`

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      disabled={interactive && !onClick ? true : undefined}
      className={['die', held ? 'held' : '', faded ? 'faded' : '', onClick ? 'clickable' : ''].filter(Boolean).join(' ')}
      style={{ '--s': `${size}px`, rotate: tilt }}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(held) : undefined}
      aria-label={label}
      initial={false}
      animate={{ y: held ? -10 : 0, scale: held ? 1.05 : 1 }}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      transition={spring}
    >
      <span className="die-shadow" aria-hidden="true" />
      <motion.span
        className="cube"
        initial={false}
        animate={target}
        transition={reduce ? { duration: 0 } : { duration: 0.95 + index * 0.06, ease: [0.2, 0.9, 0.25, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        aria-hidden="true"
      >
        {FACES.map((f) => (
          <Face key={f.cls} cls={f.cls} v={f.v} />
        ))}
      </motion.span>
      {interactive && <span className="hold-label">{held ? 'Held' : onClick ? 'Hold' : ''}</span>}
    </Tag>
  )
}
