import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rawScore,
  scoreFor,
  availableCategories,
  totals,
  makePlayer,
  createGame,
  joinGame,
  startGame,
  roll,
  toggleHold,
  score,
  restartGame,
  CATEGORIES,
} from '../src/game.js'

test('upper section scores', () => {
  assert.equal(rawScore('ones', [1, 1, 2, 3, 1]), 3)
  assert.equal(rawScore('sixes', [6, 6, 6, 6, 1]), 24)
  assert.equal(rawScore('fours', [1, 2, 3, 5, 6]), 0)
})

test('lower section scores', () => {
  assert.equal(rawScore('threeKind', [2, 2, 2, 5, 6]), 17)
  assert.equal(rawScore('threeKind', [2, 2, 3, 5, 6]), 0)
  assert.equal(rawScore('fourKind', [4, 4, 4, 4, 1]), 17)
  assert.equal(rawScore('fullHouse', [3, 3, 3, 5, 5]), 25)
  assert.equal(rawScore('fullHouse', [3, 3, 3, 3, 5]), 0)
  assert.equal(rawScore('smallStraight', [1, 2, 3, 4, 6]), 30)
  assert.equal(rawScore('smallStraight', [3, 4, 5, 6, 6]), 30)
  assert.equal(rawScore('smallStraight', [1, 2, 3, 5, 6]), 0)
  assert.equal(rawScore('largeStraight', [2, 3, 4, 5, 6]), 40)
  assert.equal(rawScore('largeStraight', [1, 2, 3, 4, 6]), 0)
  assert.equal(rawScore('yahtzee', [5, 5, 5, 5, 5]), 50)
  assert.equal(rawScore('chance', [1, 2, 3, 4, 5]), 15)
})

test('joker rule forces the matching upper box, then lower boxes score full points', () => {
  const scores = makePlayer('a', 'A').scores
  scores.yahtzee = 50
  assert.deepEqual(availableCategories([3, 3, 3, 3, 3], scores), ['threes'])
  scores.threes = 9
  const avail = availableCategories([3, 3, 3, 3, 3], scores)
  assert.ok(avail.includes('fullHouse') && !avail.includes('ones'))
  assert.equal(scoreFor('fullHouse', [3, 3, 3, 3, 3], scores), 25)
  assert.equal(scoreFor('largeStraight', [3, 3, 3, 3, 3], scores), 40)
})

test('totals include upper bonus and yahtzee bonus', () => {
  const p = makePlayer('a', 'A')
  p.scores.ones = 3
  p.scores.twos = 6
  p.scores.threes = 9
  p.scores.fours = 12
  p.scores.fives = 15
  p.scores.sixes = 18
  p.scores.chance = 20
  p.yahtzeeBonus = 2
  const t = totals(p)
  assert.equal(t.upper, 63)
  assert.equal(t.bonus, 35)
  assert.equal(t.total, 63 + 35 + 20 + 200)
})

test('full game flow reaches finished after 13 rounds per player', () => {
  let s = createGame('ABCD', makePlayer('h', 'Host'))
  s = joinGame(s, makePlayer('g', 'Guest'))
  s = startGame(s)
  assert.equal(s.status, 'playing')
  assert.throws(() => score(s, 'chance'), /Roll before scoring/)

  const rng = () => 0.999 // always rolls a 6
  let turns = 0
  while (s.status === 'playing') {
    s = roll(s, rng)
    s = toggleHold(s, 0)
    s = roll(s, rng)
    const open = CATEGORIES.find((c) => s.players[s.turn].scores[c] == null)
    const avail = availableCategories(s.dice, s.players[s.turn].scores)
    s = score(s, avail.includes(open) ? open : avail[0])
    turns++
  }
  assert.equal(turns, 26)
  assert.equal(s.status, 'finished')
  assert.equal(s.round, 13)
  for (const p of s.players) {
    assert.ok(CATEGORIES.every((c) => p.scores[c] != null))
  }
  // Every roll was five sixes: yahtzee scored once, plus bonuses for later ones.
  assert.equal(s.players[0].scores.yahtzee, 50)
  assert.ok(s.players[0].yahtzeeBonus >= 1)

  const again = restartGame(s)
  assert.equal(again.status, 'playing')
  assert.equal(again.turn, 1)
  assert.ok(CATEGORIES.every((c) => again.players[0].scores[c] == null))
})

test('cannot join a running game', () => {
  let s = startGame(createGame('ABCD', makePlayer('h', 'Host')))
  assert.throws(() => joinGame(s, makePlayer('x', 'Late')), /already started/)
})

test('players get distinct avatars', () => {
  let s = createGame('ABCD', makePlayer('h', 'Host'))
  s = joinGame(s, makePlayer('g', 'Guest'))
  s = joinGame(s, makePlayer('x', 'Third'))
  const avatars = s.players.map((p) => p.avatar)
  assert.equal(new Set(avatars).size, 3)
  assert.equal(restartGame(startGame(s)).players[1].avatar, avatars[1])
})
