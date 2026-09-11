import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  UPPER,
  LOWER,
  LABELS,
  HINTS,
  ROUNDS,
  UPPER_BONUS_THRESHOLD,
  availableCategories,
  currentPlayer,
  hasRolled,
  restartGame,
  roll,
  score,
  scoreFor,
  toggleHold,
  totals,
} from './game.js'
import { leaderboard, playerStats, recordLocalResult } from './stats.js'
import { Die } from './Dice.jsx'
import { StatsPanel } from './Stats.jsx'
import { Avatar, CountUp, Segmented, Toast, spring, softSpring } from './ui.jsx'

function buzz(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    /* ignore */
  }
}

export function Board({ game, playerId, mutate, topbar, error }) {
  const me = game.players.find((p) => p.id === playerId)
  const current = currentPlayer(game)
  const myTurn = Boolean(me && current.id === playerId && game.status === 'playing')
  const rolled = hasRolled(game)
  const finished = game.status === 'finished'
  const [tab, setTab] = useState('card')
  const [rollKey, setRollKey] = useState(0)
  const [rolling, setRolling] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (finished) setTab('card')
  }, [finished])

  const doRoll = async () => {
    if (rolling || game.rollsLeft === 0) return
    buzz(20)
    setRolling(true)
    setRollKey((k) => k + 1)
    const ok = await mutate((g) => roll(g))
    timer.current = setTimeout(() => setRolling(false), ok ? 950 : 0)
  }

  let headline
  if (finished) headline = 'Game over'
  else if (myTurn) {
    if (!rolled) headline = 'Your turn, roll the dice!'
    else if (game.rollsLeft > 0) headline = 'Hold dice, roll again, or pick a box'
    else headline = 'Pick a box on the scorecard'
  } else headline = `${current.name}'s turn`

  return (
    <div className={'shell game ' + (myTurn ? 'my-turn' : '')}>
      {topbar}
      <main className="board">
        <PlayerStrip game={game} playerId={playerId} />

        {finished && (
          <Results game={game} playerId={playerId} onAgain={() => mutate(restartGame)} />
        )}

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'card', label: 'Scorecard' },
            { value: 'stats', label: 'Stats' },
          ]}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'card' ? (
              <Scorecard
                game={game}
                playerId={playerId}
                canScore={myTurn && rolled && !rolling}
                onScore={(cat) => {
                  buzz(12)
                  mutate((g) => score(g, cat))
                }}
              />
            ) : (
              <StatsPanel game={game} playerId={playerId} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!finished && (
        <footer className={'dock ' + (myTurn ? 'mine' : '')}>
          <div className="dock-head">
            <span className="round">
              Round {game.round} / {ROUNDS}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={headline}
                className="headline"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {headline}
              </motion.h2>
            </AnimatePresence>
            {!me && <span className="tag">watching</span>}
          </div>

          <div className="dice">
            {game.dice.map((d, i) => (
              <Die
                key={i}
                index={i}
                value={d}
                rollKey={rollKey}
                interactive
                held={rolled && game.held[i]}
                faded={!rolled}
                size={54}
                onClick={
                  myTurn && rolled && game.rollsLeft > 0 && !rolling
                    ? () => {
                        buzz(8)
                        mutate((g) => toggleHold(g, i))
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {myTurn ? (
            <motion.button
              className="btn primary big roll"
              onClick={doRoll}
              disabled={game.rollsLeft === 0 || rolling}
              whileTap={{ scale: 0.98 }}
            >
              {game.rollsLeft === 0 ? 'Choose a box above' : `Roll dice · ${game.rollsLeft} left`}
              <span className="roll-dots" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= game.rollsLeft ? 'on' : ''} />
                ))}
              </span>
            </motion.button>
          ) : (
            <div className="waiting">
              <Avatar player={current} size="xs" />
              <span>{rolled ? `${3 - game.rollsLeft} of 3 rolls used` : 'Not rolled yet'}</span>
            </div>
          )}

          <AnimatePresence initial={false}>
            {game.lastAction && (!myTurn || !rolled) && (
              <motion.p
                key={game.lastAction.playerId + game.lastAction.category + game.lastAction.round}
                className="last-action"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {game.lastAction.playerName} scored <strong>{game.lastAction.points}</strong> in{' '}
                {LABELS[game.lastAction.category]}
                {game.lastAction.bonus ? ' · +100 Yahtzee bonus' : ''}
              </motion.p>
            )}
          </AnimatePresence>
        </footer>
      )}
      <AnimatePresence>{error && <Toast key="toast" text={error} />}</AnimatePresence>
    </div>
  )
}

function PlayerStrip({ game, playerId }) {
  return (
    <section className="strip" aria-label="Players">
      {game.players.map((p, i) => {
        const active = game.status === 'playing' && i === game.turn
        return (
          <div key={p.id} className={'chip ' + (active ? 'active ' : '') + (p.id === playerId ? 'you' : '')}>
            {active && <motion.span layoutId="turn-ind" className="chip-ind" transition={softSpring} style={{ background: p.color }} />}
            <Avatar player={p} size="md" active={active} />
            <span className="chip-name">{p.name}</span>
            <CountUp value={totals(p).total} className="chip-score" />
          </div>
        )
      })}
    </section>
  )
}

function Results({ game, playerId, onAgain }) {
  const board = useMemo(() => leaderboard(game), [game])
  const winner = board[0]
  const tie = board.length > 1 && board[1].stats.total === winner.stats.total
  const mine = game.players.find((p) => p.id === playerId)
  const myStats = mine ? playerStats(game, mine) : null

  useEffect(() => {
    if (mine) recordLocalResult(game, playerId)
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const colors = game.players.map((p) => p.color)
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors, scalar: 0.9 })
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors }), 250)
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors }), 400)
  }, [game.code, game.gameNo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.section className="card results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <span className="eyebrow">Final result</span>
      <h2>{tie ? "It's a tie" : `${winner.player.name} wins`}</h2>
      <ol className="podium">
        {board.map(({ player, stats }, i) => (
          <motion.li
            key={player.id}
            className={player.id === playerId ? 'you' : ''}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.08 * i }}
          >
            <span className="rank">{i + 1}</span>
            <Avatar player={player} size="sm" />
            <span className="name">{player.name}</span>
            <span className="muted small">{stats.yahtzees ? `${stats.yahtzees}× Yahtzee` : `${stats.avgPerTurn.toFixed(1)} avg`}</span>
            <CountUp value={stats.total} className="num" />
          </motion.li>
        ))}
      </ol>
      {myStats && (
        <div className="tiles compact">
          <div className="tile">
            <span className="tile-label">Best turn</span>
            <span className="tile-value text">{myStats.bestLabel}</span>
          </div>
          <div className="tile">
            <span className="tile-label">Avg / turn</span>
            <span className="tile-value">{myStats.avgPerTurn.toFixed(1)}</span>
          </div>
          <div className="tile">
            <span className="tile-label">Upper bonus</span>
            <span className={'tile-value ' + (myStats.bonus ? '' : 'text')}>{myStats.bonus ? '+35' : 'Missed'}</span>
          </div>
        </div>
      )}
      <button className="btn primary big" onClick={onAgain}>
        Play again
      </button>
    </motion.section>
  )
}

function Scorecard({ game, playerId, canScore, onScore }) {
  const current = currentPlayer(game)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  const available = useMemo(
    () => (canScore ? availableCategories(game.dice, current.scores) : []),
    [canScore, game.dice, current.scores],
  )
  const previews = useMemo(() => {
    const out = {}
    if (canScore) for (const c of available) out[c] = scoreFor(c, game.dice, current.scores)
    return out
  }, [canScore, available, game.dice, current.scores])
  const best = useMemo(() => Math.max(0, ...Object.values(previews)), [previews])
  const allTotals = useMemo(() => game.players.map(totals), [game.players])

  const cell = (p, pi, cat) => {
    const v = p.scores[cat]
    const isCurrent = game.status === 'playing' && pi === game.turn
    const col = isCurrent ? 'col-active' : ''
    if (v != null) {
      return (
        <td key={p.id} className={`${v === 0 ? 'zero' : 'filled'} ${col}`}>
          <motion.span
            className="val"
            initial={mounted.current ? { scale: 0.4, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
          >
            {v}
          </motion.span>
        </td>
      )
    }
    if (isCurrent && canScore) {
      const ok = available.includes(cat)
      const preview = previews[cat]
      const cls = !ok ? 'blocked' : preview === 0 ? 'zero' : preview === best ? 'best' : 'good'
      return (
        <td key={p.id} className={`pick ${col}`}>
          <motion.button
            className={'pick-btn ' + cls}
            disabled={!ok}
            onClick={() => onScore(cat)}
            whileTap={ok ? { scale: 0.9 } : undefined}
            title={ok ? `Score ${preview} in ${LABELS[cat]}` : 'Not allowed with this Yahtzee (joker rule)'}
          >
            {ok ? preview : '–'}
          </motion.button>
        </td>
      )
    }
    return <td key={p.id} className={`empty ${col}`} />
  }

  const rows = (cats) =>
    cats.map((cat) => (
      <tr key={cat}>
        <th scope="row">
          <span className="cat">{LABELS[cat]}</span>
          <span className="hint">{HINTS[cat]}</span>
        </th>
        {game.players.map((p, pi) => cell(p, pi, cat))}
      </tr>
    ))

  const sub = (label, hint, values, cls) => (
    <tr className={'sub ' + (cls || '')}>
      <th scope="row">
        <span className="cat">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </th>
      {values.map((v, i) => (
        <td key={i} className={v.cls || ''}>
          {v.text}
        </td>
      ))}
    </tr>
  )

  return (
    <section className="card scorecard-wrap">
      <div className="scorecard-scroll">
        <table className="scorecard">
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span className="section-label">Upper</span>
              </th>
              {game.players.map((p, pi) => (
                <th key={p.id} scope="col" className={game.status === 'playing' && pi === game.turn ? 'active' : ''}>
                  <Avatar player={p} size="sm" active={game.status === 'playing' && pi === game.turn} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows(UPPER)}
            {sub(
              'Bonus',
              `+35 at ${UPPER_BONUS_THRESHOLD}`,
              allTotals.map((t) => ({
                text: t.bonus ? '+35' : `${t.upper}/${UPPER_BONUS_THRESHOLD}`,
                cls: t.bonus ? 'good' : 'muted',
              })),
            )}
            <tr className="section">
              <th scope="row" colSpan={game.players.length + 1}>
                <span className="section-label">Lower</span>
              </th>
            </tr>
            {rows(LOWER)}
            {sub(
              'Yahtzee bonus',
              '+100 each',
              game.players.map((p) => ({
                text: p.yahtzeeBonus ? `+${p.yahtzeeBonus * 100}` : '–',
                cls: p.yahtzeeBonus ? 'good' : 'muted',
              })),
            )}
            {sub('Total', null, allTotals.map((t) => ({ text: t.total })), 'total')}
          </tbody>
        </table>
      </div>
    </section>
  )
}
