import React, { useMemo, useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { ROUNDS, UPPER_BONUS_THRESHOLD } from './game.js'
import { leaderboard, playerStats } from './stats.js'
import { Avatar, CountUp, Ring, spring } from './ui.jsx'

export function StatsPanel({ game, playerId }) {
  const board = useMemo(() => leaderboard(game), [game])
  const [selected, setSelected] = useState(playerId)
  const selectedPlayer = game.players.find((p) => p.id === selected) || board[0].player
  const s = playerStats(game, selectedPlayer)
  const leaderTotal = board[0].stats.total

  return (
    <div className="stats">
      <section className="card">
        <div className="card-head">
          <h3>Standings</h3>
          <span className="muted small">Round {game.round} of {ROUNDS}</span>
        </div>
        <LayoutGroup>
          <ol className="board-list">
            {board.map(({ player, stats }, i) => (
              <motion.li key={player.id} layout transition={spring} className={player.id === playerId ? 'you' : ''}>
                <span className="rank">{i + 1}</span>
                <Avatar player={player} size="sm" />
                <span className="name">{player.name}</span>
                <span className="delta muted small">
                  {i === 0 ? 'leading' : `−${leaderTotal - stats.total}`}
                </span>
                <CountUp value={stats.total} className="num" />
              </motion.li>
            ))}
          </ol>
        </LayoutGroup>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Points per round</h3>
        </div>
        <PointsChart game={game} />
        <div className="legend">
          {game.players.map((p) => (
            <span key={p.id} className="legend-item">
              <i style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Player details</h3>
          <div className="picker">
            {game.players.map((p) => (
              <button
                key={p.id}
                className={'picker-btn ' + (p.id === selectedPlayer.id ? 'on' : '')}
                onClick={() => setSelected(p.id)}
                aria-label={p.name}
              >
                <Avatar player={p} size="sm" active={p.id === selectedPlayer.id} />
              </button>
            ))}
          </div>
        </div>

        <div className="detail-top">
          <Ring progress={s.upperProgress} size={72} stroke={6} color={selectedPlayer.color}>
            <span className="ring-num">{s.upper}</span>
            <span className="ring-cap">/ {UPPER_BONUS_THRESHOLD}</span>
          </Ring>
          <div>
            <div className="detail-name">{selectedPlayer.name}</div>
            <div className="muted small">
              {s.bonus ? 'Upper bonus secured (+35)' : `${s.upperNeeded} more for the upper bonus`}
            </div>
          </div>
        </div>

        <div className="tiles">
          <Tile label="Avg / turn" value={s.avgPerTurn.toFixed(1)} />
          <Tile label="Avg rolls" value={s.avgRolls.toFixed(1)} />
          <Tile label="Yahtzees" value={s.yahtzees} />
          <Tile label="Zeros" value={s.zeros} />
          <Tile label="Best turn" value={s.bestLabel} wide />
          <Tile label="Projected" value={s.turns ? s.projected : '–'} />
          <Tile label="Boxes left" value={s.boxesLeft} />
        </div>
      </section>
    </div>
  )
}

function Tile({ label, value, wide }) {
  return (
    <motion.div className={'tile ' + (wide ? 'wide' : '')} layout transition={spring}>
      <span className="tile-label">{label}</span>
      <span className={'tile-value ' + (typeof value === 'string' && isNaN(Number(value)) ? 'text' : '')}>{value}</span>
    </motion.div>
  )
}

export function PointsChart({ game, height = 150 }) {
  const n = game.players.length
  const W = 520
  const H = height
  const padL = 26
  const padB = 20
  const padT = 8
  const innerW = W - padL - 8
  const innerH = H - padB - padT
  const groupW = innerW / ROUNDS
  const gap = 2
  const barW = Math.max(3, (groupW - 6) / n - gap)
  const history = game.history || []
  const maxPts = Math.max(50, ...history.map((e) => e.points))
  const y = (v) => padT + innerH - (v / maxPts) * innerH
  const ticks = [0, 25, 50].concat(maxPts > 50 ? [maxPts] : [])

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Points per round">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" />
          <text x={padL - 6} y={y(t) + 3} className="tick" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {Array.from({ length: ROUNDS }, (_, r) => (
        <text key={r} x={padL + r * groupW + groupW / 2} y={H - 5} className="tick" textAnchor="middle">
          {r + 1}
        </text>
      ))}
      {game.players.map((p, pi) =>
        history
          .filter((e) => e.playerId === p.id)
          .map((e) => {
            const x = padL + (e.round - 1) * groupW + 3 + pi * (barW + gap)
            const h = Math.max(2, innerH * (e.points / maxPts))
            return (
              <motion.rect
                key={`${p.id}-${e.round}`}
                x={x}
                width={barW}
                rx={2}
                fill={p.color}
                initial={{ height: 0, y: padT + innerH }}
                animate={{ height: h, y: padT + innerH - h }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.02 * e.round }}
              />
            )
          }),
      )}
    </svg>
  )
}
