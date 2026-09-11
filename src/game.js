// Pure Yahtzee (Kniffel) game logic. No side effects; every action returns a new state.

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes']
export const LOWER = [
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
]
export const CATEGORIES = [...UPPER, ...LOWER]

export const LABELS = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  threeKind: '3 of a kind',
  fourKind: '4 of a kind',
  fullHouse: 'Full house',
  smallStraight: 'Small straight',
  largeStraight: 'Large straight',
  yahtzee: 'Yahtzee',
  chance: 'Chance',
}

export const HINTS = {
  ones: 'Sum of 1s',
  twos: 'Sum of 2s',
  threes: 'Sum of 3s',
  fours: 'Sum of 4s',
  fives: 'Sum of 5s',
  sixes: 'Sum of 6s',
  threeKind: 'Sum of all dice',
  fourKind: 'Sum of all dice',
  fullHouse: '25 points',
  smallStraight: '30 points',
  largeStraight: '40 points',
  yahtzee: '50 points',
  chance: 'Sum of all dice',
}

export const ROUNDS = 13
export const UPPER_BONUS_THRESHOLD = 63
export const UPPER_BONUS = 35
export const YAHTZEE_BONUS = 100

const sum = (dice) => dice.reduce((a, b) => a + b, 0)

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const d of dice) c[d]++
  return c
}

export function isYahtzee(dice) {
  return dice.length === 5 && dice.every((d) => d === dice[0])
}

function hasRun(dice, length) {
  const set = new Set(dice)
  for (let start = 1; start + length - 1 <= 6; start++) {
    let ok = true
    for (let i = 0; i < length; i++) if (!set.has(start + i)) ok = false
    if (ok) return true
  }
  return false
}

export function rawScore(category, dice) {
  const c = counts(dice)
  const upperIndex = UPPER.indexOf(category)
  if (upperIndex >= 0) {
    const face = upperIndex + 1
    return c[face] * face
  }
  switch (category) {
    case 'threeKind':
      return c.some((n) => n >= 3) ? sum(dice) : 0
    case 'fourKind':
      return c.some((n) => n >= 4) ? sum(dice) : 0
    case 'fullHouse':
      return c.includes(3) && c.includes(2) ? 25 : 0
    case 'smallStraight':
      return hasRun(dice, 4) ? 30 : 0
    case 'largeStraight':
      return hasRun(dice, 5) ? 40 : 0
    case 'yahtzee':
      return isYahtzee(dice) ? 50 : 0
    case 'chance':
      return sum(dice)
    default:
      throw new Error('Unknown category ' + category)
  }
}

// A "joker" is a Yahtzee rolled after the Yahtzee box has already been filled.
export function jokerActive(dice, scores) {
  return isYahtzee(dice) && scores.yahtzee != null
}

export function scoreFor(category, dice, scores) {
  if (jokerActive(dice, scores)) {
    if (category === 'fullHouse') return 25
    if (category === 'smallStraight') return 30
    if (category === 'largeStraight') return 40
  }
  return rawScore(category, dice)
}

// Categories the current player may choose given the dice and the joker rule.
export function availableCategories(dice, scores) {
  const open = CATEGORIES.filter((c) => scores[c] == null)
  if (!jokerActive(dice, scores)) return open
  const upperCat = UPPER[dice[0] - 1]
  if (scores[upperCat] == null) return [upperCat]
  const lowerOpen = LOWER.filter((c) => scores[c] == null)
  if (lowerOpen.length) return lowerOpen
  return open
}

export function totals(player) {
  const s = player.scores || {}
  const upper = UPPER.reduce((a, c) => a + (s[c] || 0), 0)
  const bonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0
  const lower = LOWER.reduce((a, c) => a + (s[c] || 0), 0)
  const yahtzeeBonus = (player.yahtzeeBonus || 0) * YAHTZEE_BONUS
  return { upper, bonus, lower, yahtzeeBonus, total: upper + bonus + lower + yahtzeeBonus }
}

export function emptyScores() {
  const s = {}
  for (const c of CATEGORIES) s[c] = null
  return s
}

export const AVATARS = ['🦁', '🐨', '🦊', '🐼', '🐸', '🐙', '🦉', '🐯', '🦄', '🐧', '🐻', '🐺']

export function pickAvatar(players = []) {
  const used = new Set(players.map((p) => p.avatar))
  return AVATARS.find((a) => !used.has(a)) || AVATARS[players.length % AVATARS.length]
}

export function makePlayer(id, name, avatar = AVATARS[0]) {
  return {
    id,
    name: String(name).trim().slice(0, 20),
    avatar,
    scores: emptyScores(),
    yahtzeeBonus: 0,
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export function randomCode(rng = Math.random) {
  let out = ''
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]
  return out
}

export function randomDie(rng = Math.random) {
  return 1 + Math.floor(rng() * 6)
}

function freshTurn() {
  return { dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rollsLeft: 3 }
}

export function createGame(code, host) {
  return {
    code,
    status: 'lobby',
    hostId: host.id,
    players: [host],
    turn: 0,
    round: 1,
    startIndex: 0,
    lastAction: null,
    ...freshTurn(),
  }
}

export function joinGame(state, player) {
  if (state.players.some((p) => p.id === player.id)) return state
  if (state.status !== 'lobby') throw new Error('Game already started')
  if (state.players.length >= 8) throw new Error('Game is full (max 8 players)')
  const avatar = state.players.some((p) => p.avatar === player.avatar)
    ? pickAvatar(state.players)
    : player.avatar
  return { ...state, players: [...state.players, { ...player, avatar }] }
}

export function leaveGame(state, playerId) {
  if (state.status !== 'lobby') throw new Error('Cannot leave a running game')
  const players = state.players.filter((p) => p.id !== playerId)
  if (!players.length) return state
  const hostId = players.some((p) => p.id === state.hostId) ? state.hostId : players[0].id
  return { ...state, players, hostId }
}

export function startGame(state) {
  if (state.status !== 'lobby') throw new Error('Game already started')
  if (state.players.length < 1) throw new Error('Need at least one player')
  return {
    ...state,
    status: 'playing',
    turn: 0,
    round: 1,
    startIndex: 0,
    lastAction: null,
    ...freshTurn(),
  }
}

export function currentPlayer(state) {
  return state.players[state.turn]
}

export function hasRolled(state) {
  return state.rollsLeft < 3
}

export function roll(state, rng = Math.random) {
  if (state.status !== 'playing') throw new Error('Game is not running')
  if (state.rollsLeft <= 0) throw new Error('No rolls left')
  const first = !hasRolled(state)
  const dice = state.dice.map((d, i) => (!first && state.held[i] ? d : randomDie(rng)))
  return { ...state, dice, rollsLeft: state.rollsLeft - 1 }
}

export function toggleHold(state, index) {
  if (state.status !== 'playing') throw new Error('Game is not running')
  if (!hasRolled(state)) throw new Error('Roll first')
  if (state.rollsLeft === 0) return state
  const held = state.held.slice()
  held[index] = !held[index]
  return { ...state, held }
}

export function score(state, category) {
  if (state.status !== 'playing') throw new Error('Game is not running')
  if (!hasRolled(state)) throw new Error('Roll before scoring')
  const player = currentPlayer(state)
  if (!availableCategories(state.dice, player.scores).includes(category)) {
    throw new Error('That box is not available')
  }
  const points = scoreFor(category, state.dice, player.scores)
  const bonus = isYahtzee(state.dice) && player.scores.yahtzee === 50 ? 1 : 0
  const updated = {
    ...player,
    scores: { ...player.scores, [category]: points },
    yahtzeeBonus: (player.yahtzeeBonus || 0) + bonus,
  }
  const players = state.players.map((p, i) => (i === state.turn ? updated : p))

  let turn = (state.turn + 1) % players.length
  let round = state.round
  if (turn === state.startIndex) round += 1
  const status = round > ROUNDS ? 'finished' : 'playing'

  return {
    ...state,
    players,
    turn,
    round: Math.min(round, ROUNDS),
    status,
    lastAction: {
      playerId: player.id,
      playerName: player.name,
      category,
      points,
      dice: state.dice.slice(),
      bonus,
    },
    ...freshTurn(),
  }
}

export function restartGame(state) {
  const players = state.players.map((p) => makePlayer(p.id, p.name, p.avatar))
  const startIndex = (state.startIndex + 1) % players.length
  return {
    ...state,
    status: 'playing',
    players,
    turn: startIndex,
    startIndex,
    round: 1,
    lastAction: null,
    ...freshTurn(),
  }
}

export function ranking(state) {
  return state.players
    .map((p) => ({ ...p, total: totals(p).total }))
    .sort((a, b) => b.total - a.total)
}
