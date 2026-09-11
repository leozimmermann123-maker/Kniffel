import { CATEGORIES, UPPER_BONUS_THRESHOLD, LABELS, totals } from './game.js'

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

export function playerStats(state, player) {
  const entries = (state.history || []).filter((e) => e.playerId === player.id)
  const t = totals(player)
  const filled = CATEGORIES.filter((c) => player.scores[c] != null).length
  const points = entries.map((e) => e.points)
  const rolls = entries.map((e) => e.rolls)
  const best = entries.reduce((a, e) => (a == null || e.points > a.points ? e : a), null)
  const yahtzees = (player.scores.yahtzee === 50 ? 1 : 0) + (player.yahtzeeBonus || 0)
  const avgPerTurn = entries.length ? sum(points) / entries.length : 0
  const boxesLeft = CATEGORIES.length - filled
  return {
    total: t.total,
    upper: t.upper,
    bonus: t.bonus,
    upperProgress: Math.min(1, t.upper / UPPER_BONUS_THRESHOLD),
    upperNeeded: Math.max(0, UPPER_BONUS_THRESHOLD - t.upper),
    turns: entries.length,
    boxesLeft,
    avgPerTurn,
    avgRolls: rolls.length ? sum(rolls) / rolls.length : 0,
    zeros: points.filter((p) => p === 0).length,
    yahtzees,
    best,
    bestLabel: best ? `${best.points} · ${LABELS[best.category]}` : '–',
    projected: Math.round(t.total + avgPerTurn * boxesLeft),
    pointsPerRound: entries.map((e) => ({ round: e.round, points: e.points })),
  }
}

export function leaderboard(state) {
  return state.players
    .map((p) => ({ player: p, stats: playerStats(state, p) }))
    .sort((a, b) => b.stats.total - a.stats.total)
}

/* ------------------------------------------------ local all-time stats */

const KEY = 'kniffel.stats.v1'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { games: 0, wins: 0, best: 0, totalPoints: 0, yahtzees: 0, recorded: [], recent: [] }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function loadLocalStats() {
  const d = read()
  return {
    ...d,
    average: d.games ? Math.round(d.totalPoints / d.games) : 0,
    winRate: d.games ? Math.round((d.wins / d.games) * 100) : 0,
  }
}

// Records a finished game once per (room, gameNo). Returns the updated stats.
export function recordLocalResult(state, playerId) {
  const key = `${state.code}#${state.gameNo || 1}`
  const d = read()
  if (d.recorded.includes(key)) return loadLocalStats()
  const me = state.players.find((p) => p.id === playerId)
  if (!me) return loadLocalStats()
  const ranked = leaderboard(state)
  const myTotal = totals(me).total
  const won = ranked[0].stats.total === myTotal
  const next = {
    ...d,
    games: d.games + 1,
    wins: d.wins + (won ? 1 : 0),
    best: Math.max(d.best, myTotal),
    totalPoints: d.totalPoints + myTotal,
    yahtzees: d.yahtzees + playerStats(state, me).yahtzees,
    recorded: [...d.recorded, key].slice(-100),
    recent: [
      { key, date: Date.now(), score: myTotal, won, players: state.players.length },
      ...d.recent,
    ].slice(-20),
  }
  write(next)
  return loadLocalStats()
}
