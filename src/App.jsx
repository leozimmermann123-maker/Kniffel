import React, { useEffect, useMemo, useState } from 'react'
import {
  CATEGORIES,
  UPPER,
  LOWER,
  LABELS,
  HINTS,
  ROUNDS,
  UPPER_BONUS_THRESHOLD,
  availableCategories,
  createGame,
  currentPlayer,
  hasRolled,
  joinGame,
  leaveGame,
  makePlayer,
  randomCode,
  ranking,
  restartGame,
  roll,
  score,
  scoreFor,
  startGame,
  toggleHold,
  totals,
} from './game.js'
import { useGame, createGameRow } from './useGame.js'

const STORAGE_ID = 'kniffel.playerId'
const STORAGE_NAME = 'kniffel.name'
const STORAGE_LAST = 'kniffel.lastGame'

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode or blocked storage */
  }
  return null
}

function getPlayerId() {
  let id = storage(STORAGE_ID)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    storage(STORAGE_ID, id)
  }
  return id
}

function codeFromUrl() {
  const g = new URLSearchParams(window.location.search).get('g')
  return g ? g.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : ''
}

function setUrlCode(code) {
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('g', code)
  else url.searchParams.delete('g')
  window.history.pushState({}, '', url)
}

export default function App() {
  const [playerId] = useState(getPlayerId)
  const [code, setCode] = useState(codeFromUrl)
  const [name, setName] = useState(() => storage(STORAGE_NAME) || '')

  useEffect(() => {
    const onPop = () => setCode(codeFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const goTo = (next) => {
    setUrlCode(next)
    setCode(next)
  }

  const saveName = (n) => {
    setName(n)
    storage(STORAGE_NAME, n)
  }

  if (!code) {
    return <Home name={name} onName={saveName} playerId={playerId} onEnter={goTo} />
  }
  return (
    <GameScreen
      key={code}
      code={code}
      playerId={playerId}
      name={name}
      onName={saveName}
      onLeave={() => goTo('')}
    />
  )
}

function Home({ name, onName, playerId, onEnter }) {
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lastGame = storage(STORAGE_LAST)

  const needName = () => {
    if (!name.trim()) {
      setError('Enter your name first.')
      return true
    }
    return false
  }

  const create = async () => {
    if (needName()) return
    setBusy(true)
    setError('')
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const c = randomCode()
        try {
          await createGameRow(c, createGame(c, makePlayer(playerId, name)))
          storage(STORAGE_LAST, c)
          onEnter(c)
          return
        } catch (e) {
          if (!/duplicate|23505/i.test(e.message || '')) throw e
        }
      }
      throw new Error('Could not find a free room code, try again.')
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const join = (e) => {
    e.preventDefault()
    if (needName()) return
    const c = joinCode.toUpperCase().replace(/[^A-Z]/g, '')
    if (c.length !== 4) {
      setError('Room codes have 4 letters.')
      return
    }
    onEnter(c)
  }

  return (
    <div className="page home">
      <header className="hero">
        <div className="logo">
          <Die value={5} small />
          <Die value={2} small />
        </div>
        <h1>Kniffel</h1>
        <p>Yahtzee with friends, on any device. No accounts, just a room code.</p>
      </header>

      <section className="card">
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Leo"
            maxLength={20}
            autoComplete="nickname"
          />
        </label>

        <button className="btn primary big" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'New game'}
        </button>

        <div className="divider">
          <span>or join a friend</span>
        </div>

        <form className="join" onSubmit={join}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ROOM"
            maxLength={4}
            className="code-input"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn" type="submit">
            Join
          </button>
        </form>

        {lastGame && (
          <button className="link" onClick={() => onEnter(lastGame)}>
            Rejoin your last game ({lastGame})
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <footer className="rules">
        <h2>How to play</h2>
        <ol>
          <li>Create a game and share the link or room code.</li>
          <li>Each turn you roll up to three times. Tap dice to hold them.</li>
          <li>Pick a box on the scorecard. After 13 rounds the highest total wins.</li>
        </ol>
        <p>
          63+ in the upper section earns a 35 point bonus. Extra Yahtzees are worth 100 each.
        </p>
      </footer>
    </div>
  )
}

function GameScreen({ code, playerId, name, onName, onLeave }) {
  const { game, status, error, mutate, refresh, clearError } = useGame(code)
  const [joinName, setJoinName] = useState(name)
  const [copied, setCopied] = useState(false)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    if (game) storage(STORAGE_LAST, code)
  }, [game, code])

  useEffect(() => {
    if (!error) return undefined
    const t = setTimeout(clearError, 4000)
    return () => clearTimeout(t)
  }, [error, clearError])

  if (status === 'loading' || (status === 'ready' && !game)) {
    return (
      <div className="page center">
        <div className="spinner" />
        <p>Loading room {code}…</p>
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className="page center">
        <h1>Room {code} not found</h1>
        <p>Check the code with your friend, or start a new game.</p>
        <button className="btn primary" onClick={onLeave}>
          Back to start
        </button>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="page center">
        <p className="error">{error || 'Could not load the game.'}</p>
        <button className="btn" onClick={refresh}>
          Retry
        </button>
        <button className="link" onClick={onLeave}>
          Back to start
        </button>
      </div>
    )
  }

  const me = game.players.find((p) => p.id === playerId)
  const isHost = game.hostId === playerId
  const shareUrl = `${window.location.origin}${window.location.pathname}?g=${code}`

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kniffel', text: `Join my Kniffel game: ${code}`, url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* user cancelled share */
    }
  }

  const doJoin = (e) => {
    e.preventDefault()
    const n = joinName.trim()
    if (!n) return
    onName(n)
    mutate((g) => joinGame(g, makePlayer(playerId, n)))
  }

  const doRoll = async () => {
    setRolling(true)
    const ok = await mutate((g) => roll(g))
    setTimeout(() => setRolling(false), ok ? 450 : 0)
  }

  const header = (
    <header className="topbar">
      <button className="link back" onClick={onLeave} aria-label="Back to start">
        ← Home
      </button>
      <div className="room">
        <span className="room-label">Room</span>
        <span className="room-code">{code}</span>
      </div>
      <button className="btn small" onClick={share}>
        {copied ? 'Copied!' : 'Share'}
      </button>
    </header>
  )

  if (game.status === 'lobby') {
    return (
      <div className="page">
        {header}
        <section className="card">
          <h2>Waiting for players</h2>
          <ul className="players">
            {game.players.map((p) => (
              <li key={p.id}>
                <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="pname">{p.name}</span>
                {p.id === game.hostId && <span className="tag">host</span>}
                {p.id === playerId && <span className="tag you">you</span>}
              </li>
            ))}
          </ul>

          {!me ? (
            <form className="join-form" onSubmit={doJoin}>
              <label className="field">
                <span>Your name</span>
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="e.g. Anna"
                  maxLength={20}
                  autoFocus
                />
              </label>
              <button className="btn primary big" type="submit">
                Join game
              </button>
            </form>
          ) : isHost ? (
            <button
              className="btn primary big"
              onClick={() => mutate(startGame)}
              disabled={game.players.length < 1}
            >
              Start game{game.players.length === 1 ? ' (solo)' : ''}
            </button>
          ) : (
            <p className="muted">Waiting for {game.players.find((p) => p.id === game.hostId)?.name} to start…</p>
          )}

          <div className="share-box">
            <p>Invite friends with this link or the room code <strong>{code}</strong>:</p>
            <code className="share-url">{shareUrl}</code>
            <button className="btn" onClick={share}>
              {copied ? 'Copied!' : navigator.share ? 'Share link' : 'Copy link'}
            </button>
          </div>

          {me && game.players.length > 1 && (
            <button
              className="link danger"
              onClick={async () => {
                await mutate((g) => leaveGame(g, playerId))
                onLeave()
              }}
            >
              Leave game
            </button>
          )}
        </section>
        {error && <Toast text={error} />}
      </div>
    )
  }

  const current = currentPlayer(game)
  const myTurn = me && current.id === playerId && game.status === 'playing'
  const rolled = hasRolled(game)

  return (
    <div className="page game">
      {header}

      {game.status === 'finished' ? (
        <Results game={game} playerId={playerId} onAgain={() => mutate(restartGame)} />
      ) : (
        <section className={'card turn ' + (myTurn ? 'mine' : '')}>
          <div className="turn-head">
            <span className="round">
              Round {game.round} / {ROUNDS}
            </span>
            {!me && <span className="tag">watching</span>}
          </div>
          <h2>
            {myTurn
              ? rolled
                ? game.rollsLeft > 0
                  ? 'Hold dice, roll again, or pick a box'
                  : 'Pick a box on the scorecard'
                : 'Your turn, roll the dice!'
              : `${current.name}'s turn`}
          </h2>

          <div className={'dice ' + (rolling ? 'rolling' : '')}>
            {game.dice.map((d, i) => (
              <Die
                key={i}
                value={d}
                held={game.held[i]}
                faded={!rolled}
                onClick={
                  myTurn && rolled && game.rollsLeft > 0
                    ? () => mutate((g) => toggleHold(g, i))
                    : undefined
                }
              />
            ))}
          </div>

          {myTurn ? (
            <button
              className="btn primary big roll"
              onClick={doRoll}
              disabled={game.rollsLeft === 0 || rolling}
            >
              {game.rollsLeft === 0
                ? 'No rolls left'
                : `Roll dice · ${game.rollsLeft} left`}
            </button>
          ) : (
            <p className="muted rolls-info">
              {rolled ? `${3 - game.rollsLeft} of 3 rolls used` : 'Not rolled yet'}
            </p>
          )}
          {game.lastAction && <LastAction action={game.lastAction} />}
        </section>
      )}

      <Scorecard
        game={game}
        playerId={playerId}
        canScore={Boolean(myTurn && rolled)}
        onScore={(cat) => mutate((g) => score(g, cat))}
      />

      {error && <Toast text={error} />}
    </div>
  )
}

function LastAction({ action }) {
  return (
    <p className="last-action">
      {action.playerName} scored <strong>{action.points}</strong> in {LABELS[action.category]}
      {action.bonus ? ' (+100 Yahtzee bonus!)' : ''}
    </p>
  )
}

function Results({ game, playerId, onAgain }) {
  const ranked = ranking(game)
  const winner = ranked[0]
  const tie = ranked.length > 1 && ranked[1].total === winner.total
  return (
    <section className="card results">
      <h2>{tie ? "It's a tie!" : `${winner.name} wins!`}</h2>
      <ol className="podium">
        {ranked.map((p, i) => (
          <li key={p.id} className={p.id === playerId ? 'you' : ''}>
            <span className="place">{i + 1}.</span>
            <span className="pname">{p.name}</span>
            <span className="total">{p.total}</span>
          </li>
        ))}
      </ol>
      <button className="btn primary big" onClick={onAgain}>
        Play again
      </button>
    </section>
  )
}

const PIPS = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Die({ value, held, faded, onClick, small }) {
  const pips = PIPS[value] || []
  const cls = ['die', held ? 'held' : '', faded ? 'faded' : '', small ? 'small' : '', onClick ? 'clickable' : '']
    .filter(Boolean)
    .join(' ')
  const content = (
    <span className="face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'pip' : 'blank'} />
      ))}
    </span>
  )
  if (!onClick) {
    return (
      <span className={cls} aria-label={`Die showing ${value}${held ? ', held' : ''}`}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={held}
      aria-label={`Die showing ${value}${held ? ', held' : ''}`}
    >
      {content}
      <span className="hold-label">{held ? 'held' : 'hold'}</span>
    </button>
  )
}

function Scorecard({ game, playerId, canScore, onScore }) {
  const current = currentPlayer(game)
  const available = useMemo(
    () => (canScore ? availableCategories(game.dice, current.scores) : []),
    [canScore, game.dice, current.scores],
  )
  const allTotals = useMemo(() => game.players.map(totals), [game.players])

  const cell = (p, pi, cat) => {
    const v = p.scores[cat]
    if (v != null) return <td key={p.id} className={v === 0 ? 'zero' : ''}>{v}</td>
    const isCurrent = game.status === 'playing' && pi === game.turn
    if (isCurrent && canScore) {
      const ok = available.includes(cat)
      const preview = scoreFor(cat, game.dice, current.scores)
      return (
        <td key={p.id} className="pick">
          <button
            className={'pick-btn ' + (preview > 0 ? 'good' : 'zero')}
            disabled={!ok}
            onClick={() => onScore(cat)}
            title={ok ? `Score ${preview} in ${LABELS[cat]}` : 'Not allowed with this Yahtzee (joker rule)'}
          >
            {ok ? preview : '–'}
          </button>
        </td>
      )
    }
    return <td key={p.id} className="empty" />
  }

  const sectionRows = (cats) =>
    cats.map((cat) => (
      <tr key={cat}>
        <th scope="row">
          <span className="cat">{LABELS[cat]}</span>
          <span className="hint">{HINTS[cat]}</span>
        </th>
        {game.players.map((p, pi) => cell(p, pi, cat))}
      </tr>
    ))

  return (
    <section className="card scorecard-wrap">
      <div className="scorecard-scroll">
        <table className="scorecard">
          <thead>
            <tr>
              <th scope="col" />
              {game.players.map((p, pi) => (
                <th
                  key={p.id}
                  scope="col"
                  className={
                    (game.status === 'playing' && pi === game.turn ? 'active ' : '') +
                    (p.id === playerId ? 'you' : '')
                  }
                >
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span className="pname">{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectionRows(UPPER)}
            <tr className="sub">
              <th scope="row">
                <span className="cat">Upper total</span>
                <span className="hint">Bonus at {UPPER_BONUS_THRESHOLD}</span>
              </th>
              {allTotals.map((t, i) => (
                <td key={i}>{t.upper}</td>
              ))}
            </tr>
            <tr className="sub">
              <th scope="row">
                <span className="cat">Bonus</span>
              </th>
              {allTotals.map((t, i) => (
                <td key={i} className={t.bonus ? 'good' : 'zero'}>
                  {t.bonus ? '+35' : '–'}
                </td>
              ))}
            </tr>
            {sectionRows(LOWER)}
            <tr className="sub">
              <th scope="row">
                <span className="cat">Yahtzee bonus</span>
                <span className="hint">100 each</span>
              </th>
              {game.players.map((p) => (
                <td key={p.id} className={p.yahtzeeBonus ? 'good' : 'zero'}>
                  {p.yahtzeeBonus ? `+${p.yahtzeeBonus * 100}` : '–'}
                </td>
              ))}
            </tr>
            <tr className="total">
              <th scope="row">
                <span className="cat">Total</span>
              </th>
              {allTotals.map((t, i) => (
                <td key={i}>{t.total}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {CATEGORIES.length && (
        <p className="muted small-print">
          {game.status === 'playing' ? `${current.name} is up.` : ''}
        </p>
      )}
    </section>
  )
}

function Toast({ text }) {
  return (
    <div className="toast" role="status">
      {text}
    </div>
  )
}
