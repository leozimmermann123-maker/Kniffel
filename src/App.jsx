import React, { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
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
  pickAvatar,
  randomCode,
  randomDie,
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

function buzz(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    /* ignore */
  }
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

/* ------------------------------------------------------------------ Home */

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
          await createGameRow(c, createGame(c, makePlayer(playerId, name, pickAvatar([]))))
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
    <div className="shell home">
      <header className="hero">
        <div className="hero-dice" aria-hidden="true">
          <Die value={5} size="md" tilt={-12} />
          <Die value={3} size="md" tilt={6} held />
          <Die value={6} size="md" tilt={14} />
        </div>
        <h1 className="brand">Kniffel</h1>
        <p className="tagline">Yahtzee with friends, on any device. No accounts, just a room code.</p>
      </header>

      <section className="panel">
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

        <button className="btn gold big" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'New game'}
        </button>

        <div className="divider">
          <span>or join a friend</span>
        </div>

        <form className="join" onSubmit={join}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={4}
            className="code-input"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Room code"
          />
          <button className="btn ghost" type="submit">
            Join
          </button>
        </form>

        {lastGame && (
          <button className="link" onClick={() => onEnter(lastGame)}>
            Rejoin your last game · {lastGame}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="howto">
        <div>
          <span className="step">1</span>
          <p>Create a game, then share the link, the code, or let friends scan the QR code.</p>
        </div>
        <div>
          <span className="step">2</span>
          <p>Roll up to three times per turn. Tap dice to hold them between rolls.</p>
        </div>
        <div>
          <span className="step">3</span>
          <p>Pick a box. After 13 rounds the highest total wins. 63+ up top earns a 35 bonus.</p>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------- Game shell */

function GameScreen({ code, playerId, name, onName, onLeave }) {
  const { game, status, error, mutate, refresh, clearError } = useGame(code)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (game) storage(STORAGE_LAST, code)
  }, [game, code])

  useEffect(() => {
    if (!error) return undefined
    const t = setTimeout(clearError, 4000)
    return () => clearTimeout(t)
  }, [error, clearError])

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

  if (status === 'loading' || (status === 'ready' && !game)) {
    return (
      <div className="shell center">
        <div className="spinner" />
        <p>Loading room {code}…</p>
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className="shell center">
        <h1 className="brand small">Room {code} not found</h1>
        <p>Check the code with your friend, or start a new game.</p>
        <button className="btn gold" onClick={onLeave}>
          Back to start
        </button>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="shell center">
        <p className="error">{error || 'Could not load the game.'}</p>
        <button className="btn ghost" onClick={refresh}>
          Retry
        </button>
        <button className="link" onClick={onLeave}>
          Back to start
        </button>
      </div>
    )
  }

  const topbar = (
    <header className="topbar">
      <button className="icon-btn" onClick={onLeave} aria-label="Back to start">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="room">
        <span className="room-label">Room</span>
        <span className="room-code">{code}</span>
      </div>
      <button className="btn ghost small" onClick={share}>
        {copied ? 'Copied' : 'Share'}
      </button>
    </header>
  )

  if (game.status === 'lobby') {
    return (
      <div className="shell">
        {topbar}
        <Lobby
          game={game}
          playerId={playerId}
          name={name}
          onName={onName}
          shareUrl={shareUrl}
          onShare={share}
          copied={copied}
          mutate={mutate}
          onLeave={onLeave}
        />
        {error && <Toast text={error} />}
      </div>
    )
  }

  return (
    <Board game={game} playerId={playerId} mutate={mutate} topbar={topbar} error={error} />
  )
}

/* ----------------------------------------------------------------- Lobby */

function Lobby({ game, playerId, name, onName, shareUrl, onShare, copied, mutate, onLeave }) {
  const [joinName, setJoinName] = useState(name)
  const [qr, setQr] = useState('')
  const me = game.players.find((p) => p.id === playerId)
  const isHost = game.hostId === playerId
  const host = game.players.find((p) => p.id === game.hostId)

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#0c2417', light: '#fffaf0' },
    })
      .then(setQr)
      .catch(() => setQr(''))
  }, [shareUrl])

  const doJoin = (e) => {
    e.preventDefault()
    const n = joinName.trim()
    if (!n) return
    onName(n)
    mutate((g) => joinGame(g, makePlayer(playerId, n, pickAvatar(g.players))))
  }

  return (
    <main className="lobby">
      <section className="panel">
        <div className="panel-head">
          <h2>Waiting for players</h2>
          <span className="pill">{game.players.length} / 8</span>
        </div>
        <ul className="players">
          {game.players.map((p) => (
            <li key={p.id}>
              <Avatar player={p} />
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
            <button className="btn gold big" type="submit">
              Join game
            </button>
          </form>
        ) : isHost ? (
          <button className="btn gold big" onClick={() => mutate(startGame)}>
            Start game{game.players.length === 1 ? ' (solo)' : ''}
          </button>
        ) : (
          <p className="muted center-text">
            Waiting for {host?.name} to start the game…
          </p>
        )}
      </section>

      <section className="panel invite">
        <h3>Invite friends</h3>
        <div className="invite-grid">
          {qr && <img className="qr" src={qr} alt={`QR code to join room ${game.code}`} />}
          <div className="invite-text">
            <p className="muted">Scan the code, or share the link. The room code is</p>
            <div className="big-code">{game.code}</div>
            <button className="btn ghost" onClick={onShare}>
              {copied ? 'Link copied' : navigator.share ? 'Share link' : 'Copy link'}
            </button>
          </div>
        </div>
      </section>

      {me && game.players.length > 1 && (
        <button
          className="link danger center-text"
          onClick={async () => {
            await mutate((g) => leaveGame(g, playerId))
            onLeave()
          }}
        >
          Leave game
        </button>
      )}
    </main>
  )
}

/* ----------------------------------------------------------------- Board */

function Board({ game, playerId, mutate, topbar, error }) {
  const me = game.players.find((p) => p.id === playerId)
  const current = currentPlayer(game)
  const myTurn = Boolean(me && current.id === playerId && game.status === 'playing')
  const rolled = hasRolled(game)
  const finished = game.status === 'finished'

  const [rolling, setRolling] = useState(false)
  const [faces, setFaces] = useState(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const doRoll = async () => {
    if (rolling || game.rollsLeft === 0) return
    buzz(25)
    setRolling(true)
    const heldNow = rolled ? game.held : [false, false, false, false, false]
    const base = game.dice
    const tick = (n) => {
      if (n >= 7) return
      setFaces(base.map((d, i) => (heldNow[i] ? d : randomDie())))
      timers.current.push(setTimeout(() => tick(n + 1), 70))
    }
    tick(0)
    const ok = await mutate((g) => roll(g))
    timers.current.push(
      setTimeout(
        () => {
          setFaces(null)
          setRolling(false)
        },
        ok ? 560 : 0,
      ),
    )
  }

  const shownDice = faces || game.dice

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
        <Scorecard
          game={game}
          playerId={playerId}
          canScore={myTurn && rolled && !rolling}
          onScore={(cat) => {
            buzz(15)
            mutate((g) => score(g, cat))
          }}
        />
      </main>

      {!finished && (
        <footer className={'dock ' + (myTurn ? 'mine' : '')}>
          <div className="dock-head">
            <span className="round">
              Round {game.round} / {ROUNDS}
            </span>
            <h2 className="headline">{headline}</h2>
            {!me && <span className="tag">watching</span>}
          </div>

          <div className={'dice ' + (rolling ? 'rolling' : '')}>
            {shownDice.map((d, i) => (
              <Die
                key={i}
                value={d}
                held={rolled && game.held[i]}
                faded={!rolled && !rolling}
                size="lg"
                onClick={
                  myTurn && rolled && game.rollsLeft > 0 && !rolling
                    ? () => {
                        buzz(10)
                        mutate((g) => toggleHold(g, i))
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {myTurn ? (
            <button
              className="btn gold big roll"
              onClick={doRoll}
              disabled={game.rollsLeft === 0 || rolling}
            >
              {game.rollsLeft === 0 ? 'Choose a box above' : `Roll dice · ${game.rollsLeft} left`}
              <span className="roll-dots" aria-hidden="true">
                {[3, 2, 1].map((n) => (
                  <i key={n} className={n <= game.rollsLeft ? 'on' : ''} />
                ))}
              </span>
            </button>
          ) : (
            <div className="waiting">
              <Avatar player={current} size="sm" />
              <span>
                {rolled ? `${3 - game.rollsLeft} of 3 rolls used` : 'Not rolled yet'}
              </span>
            </div>
          )}

          {game.lastAction && !myTurn && <LastAction action={game.lastAction} />}
          {game.lastAction && myTurn && !rolled && <LastAction action={game.lastAction} />}
        </footer>
      )}
      {error && <Toast text={error} />}
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
            <Avatar player={p} size="md" ring={active} />
            <span className="chip-name">{p.name}</span>
            <span className="chip-score">{totals(p).total}</span>
          </div>
        )
      })}
    </section>
  )
}

function LastAction({ action }) {
  return (
    <p className="last-action">
      {action.playerName} scored <strong>{action.points}</strong> in {LABELS[action.category]}
      {action.bonus ? ' · +100 Yahtzee bonus!' : ''}
    </p>
  )
}

function Results({ game, playerId, onAgain }) {
  const ranked = ranking(game)
  const winner = ranked[0]
  const tie = ranked.length > 1 && ranked[1].total === winner.total
  const medals = ['🥇', '🥈', '🥉']
  return (
    <section className="panel results">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--i': i }} />
        ))}
      </div>
      <div className="winner-avatar">{winner.avatar || '🏆'}</div>
      <h2>{tie ? "It's a tie!" : `${winner.name} wins!`}</h2>
      <ol className="podium">
        {ranked.map((p, i) => (
          <li key={p.id} className={p.id === playerId ? 'you' : ''}>
            <span className="place">{medals[i] || `${i + 1}.`}</span>
            <span className="pname">{p.name}</span>
            <span className="total">{p.total}</span>
          </li>
        ))}
      </ol>
      <button className="btn gold big" onClick={onAgain}>
        Play again
      </button>
    </section>
  )
}

/* ----------------------------------------------------------------- Bits */

function Avatar({ player, size = 'sm', ring }) {
  const initial = (player.name || '?').slice(0, 1).toUpperCase()
  return (
    <span className={`avatar ${size} ${ring ? 'ring' : ''}`} aria-hidden="true">
      {player.avatar || initial}
    </span>
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

function Die({ value, held, faded, onClick, size = 'md', tilt }) {
  const pips = PIPS[value] || []
  const cls = ['die', size, held ? 'held' : '', faded ? 'faded' : '', onClick ? 'clickable' : '']
    .filter(Boolean)
    .join(' ')
  const style = tilt ? { '--tilt': `${tilt}deg` } : undefined
  const face = (
    <span className="face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'pip' : 'blank'} />
      ))}
    </span>
  )
  const label = `Die showing ${value}${held ? ', held' : ''}`
  if (!onClick) {
    return (
      <span className={cls} style={style} aria-label={label}>
        {face}
      </span>
    )
  }
  return (
    <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={held} aria-label={label}>
      {face}
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
  const previews = useMemo(() => {
    if (!canScore) return {}
    const out = {}
    for (const c of available) out[c] = scoreFor(c, game.dice, current.scores)
    return out
  }, [canScore, available, game.dice, current.scores])
  const best = useMemo(() => {
    const vals = Object.values(previews)
    return vals.length ? Math.max(...vals) : 0
  }, [previews])
  const allTotals = useMemo(() => game.players.map(totals), [game.players])

  const cell = (p, pi, cat) => {
    const v = p.scores[cat]
    const isCurrent = game.status === 'playing' && pi === game.turn
    if (v != null) {
      return (
        <td key={p.id} className={(v === 0 ? 'zero ' : 'filled ') + (isCurrent ? 'col-active' : '')}>
          {v}
        </td>
      )
    }
    if (isCurrent && canScore) {
      const ok = available.includes(cat)
      const preview = previews[cat]
      const cls = !ok ? 'blocked' : preview === 0 ? 'zero' : preview === best ? 'best' : 'good'
      return (
        <td key={p.id} className="pick col-active">
          <button
            className={'pick-btn ' + cls}
            disabled={!ok}
            onClick={() => onScore(cat)}
            title={ok ? `Score ${preview} in ${LABELS[cat]}` : 'Not allowed with this Yahtzee (joker rule)'}
          >
            {ok ? preview : '–'}
          </button>
        </td>
      )
    }
    return <td key={p.id} className={'empty ' + (isCurrent ? 'col-active' : '')} />
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
    <section className="panel scorecard-wrap">
      <div className="scorecard-scroll">
        <table className="scorecard">
          <thead>
            <tr>
              <th scope="col" className="corner">
                <span className="section-label">Upper section</span>
              </th>
              {game.players.map((p, pi) => (
                <th
                  key={p.id}
                  scope="col"
                  className={
                    (game.status === 'playing' && pi === game.turn ? 'active ' : '') +
                    (p.id === playerId ? 'you' : '')
                  }
                >
                  <Avatar player={p} size="sm" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows(UPPER)}
            {sub(
              'Bonus',
              `35 at ${UPPER_BONUS_THRESHOLD}+`,
              allTotals.map((t) => ({
                text: t.bonus ? '+35' : `${t.upper} / ${UPPER_BONUS_THRESHOLD}`,
                cls: t.bonus ? 'good' : 'muted',
              })),
            )}
            <tr className="section">
              <th scope="row" colSpan={game.players.length + 1}>
                <span className="section-label">Lower section</span>
              </th>
            </tr>
            {rows(LOWER)}
            {sub(
              'Yahtzee bonus',
              '100 each',
              game.players.map((p) => ({
                text: p.yahtzeeBonus ? `+${p.yahtzeeBonus * 100}` : '–',
                cls: p.yahtzeeBonus ? 'good' : 'muted',
              })),
            )}
            {sub(
              'Total',
              null,
              allTotals.map((t) => ({ text: t.total })),
              'total',
            )}
          </tbody>
        </table>
      </div>
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
