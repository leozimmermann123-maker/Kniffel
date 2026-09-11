import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { createGame, joinGame, leaveGame, makePlayer, pickColor, randomCode, startGame } from './game.js'
import { useGame, createGameRow } from './useGame.js'
import { loadLocalStats } from './stats.js'
import { Board } from './Board.jsx'
import { Die } from './Dice.jsx'
import { Avatar, CountUp, Icon, ThemeToggle, Toast, softSpring, spring } from './ui.jsx'

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

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!code ? (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <Home name={name} onName={saveName} playerId={playerId} onEnter={goTo} />
        </motion.div>
      ) : (
        <motion.div key={code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <GameScreen code={code} playerId={playerId} name={name} onName={saveName} onLeave={() => goTo('')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ Home */

const stagger = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { ...softSpring, delay: 0.06 * i } }),
}

function Home({ name, onName, playerId, onEnter }) {
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats] = useState(loadLocalStats)
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
          await createGameRow(c, createGame(c, makePlayer(playerId, name, pickColor([]))))
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
      <header className="topbar minimal">
        <span className="wordmark">Kniffel</span>
        <ThemeToggle />
      </header>

      <motion.section className="hero" custom={0} variants={stagger} initial="hidden" animate="show">
        <div className="hero-dice" aria-hidden="true">
          <Die value={5} size={54} tilt={-10} />
          <Die value={2} size={54} tilt={4} />
          <Die value={6} size={54} tilt={12} />
        </div>
        <h1>Yahtzee with friends.</h1>
        <p className="lead">Play on any device, in real time. No accounts, just a room code.</p>
      </motion.section>

      <motion.section className="card" custom={1} variants={stagger} initial="hidden" animate="show">
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Leo" maxLength={20} autoComplete="nickname" />
        </label>
        <motion.button className="btn primary big" onClick={create} disabled={busy} whileTap={{ scale: 0.98 }}>
          {busy ? 'Creating…' : 'New game'}
        </motion.button>
        <div className="divider">
          <span>or join a room</span>
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
          <button className="btn big" type="submit">
            Join
          </button>
        </form>
        {lastGame && (
          <button className="link" onClick={() => onEnter(lastGame)}>
            Rejoin your last game · {lastGame}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </motion.section>

      <motion.section className="card" custom={2} variants={stagger} initial="hidden" animate="show">
        <div className="card-head">
          <h3>Your stats</h3>
          <span className="muted small">this device</span>
        </div>
        {stats.games ? (
          <div className="tiles">
            <div className="tile">
              <span className="tile-label">Games</span>
              <CountUp value={stats.games} className="tile-value" />
            </div>
            <div className="tile">
              <span className="tile-label">Win rate</span>
              <span className="tile-value">
                <CountUp value={stats.winRate} />%
              </span>
            </div>
            <div className="tile">
              <span className="tile-label">Best score</span>
              <CountUp value={stats.best} className="tile-value" />
            </div>
            <div className="tile">
              <span className="tile-label">Average</span>
              <CountUp value={stats.average} className="tile-value" />
            </div>
            <div className="tile">
              <span className="tile-label">Yahtzees</span>
              <CountUp value={stats.yahtzees} className="tile-value" />
            </div>
            <div className="tile">
              <span className="tile-label">Last game</span>
              <span className="tile-value">
                {stats.recent[0]?.score ?? '–'}
                {stats.recent[0]?.won ? ' 🏆' : ''}
              </span>
            </div>
          </div>
        ) : (
          <p className="muted">Finish a game and your record, best score and averages show up here.</p>
        )}
      </motion.section>

      <motion.section className="howto" custom={3} variants={stagger} initial="hidden" animate="show">
        <div>
          <span className="step">1</span>
          <p>Create a game and share the link, the code, or the QR code.</p>
        </div>
        <div>
          <span className="step">2</span>
          <p>Roll up to three times per turn. Tap dice to hold them.</p>
        </div>
        <div>
          <span className="step">3</span>
          <p>Pick a box. After 13 rounds the highest total wins.</p>
        </div>
      </motion.section>
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
      /* cancelled */
    }
  }

  if (status === 'loading' || (status === 'ready' && !game)) {
    return (
      <div className="shell center">
        <div className="spinner" />
        <p className="muted">Loading room {code}…</p>
      </div>
    )
  }
  if (status === 'missing') {
    return (
      <div className="shell center">
        <h1>Room {code} not found</h1>
        <p className="muted">Check the code with your friend, or start a new game.</p>
        <button className="btn primary" onClick={onLeave}>
          Back to start
        </button>
      </div>
    )
  }
  if (!game) {
    return (
      <div className="shell center">
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

  const topbar = (
    <header className="topbar">
      <button className="icon-btn" onClick={onLeave} aria-label="Back to start">
        <Icon name="back" />
      </button>
      <div className="room">
        <span className="wordmark">Kniffel</span>
        <span className="room-code">{code}</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <button className="icon-btn" onClick={share} aria-label="Share link">
          <Icon name={copied ? 'check' : 'share'} />
        </button>
      </div>
    </header>
  )

  if (game.status === 'lobby') {
    return (
      <div className="shell">
        {topbar}
        <Lobby game={game} playerId={playerId} name={name} onName={onName} shareUrl={shareUrl} onShare={share} copied={copied} mutate={mutate} onLeave={onLeave} />
        <AnimatePresence>{error && <Toast key="toast" text={error} />}</AnimatePresence>
      </div>
    )
  }

  return <Board game={game} playerId={playerId} mutate={mutate} topbar={topbar} error={error} />
}

/* ----------------------------------------------------------------- Lobby */

function Lobby({ game, playerId, name, onName, shareUrl, onShare, copied, mutate, onLeave }) {
  const [joinName, setJoinName] = useState(name)
  const [qr, setQr] = useState('')
  const me = game.players.find((p) => p.id === playerId)
  const isHost = game.hostId === playerId
  const host = game.players.find((p) => p.id === game.hostId)

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { margin: 1, width: 360, color: { dark: '#111118', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [shareUrl])

  const doJoin = (e) => {
    e.preventDefault()
    const n = joinName.trim()
    if (!n) return
    onName(n)
    mutate((g) => joinGame(g, makePlayer(playerId, n, pickColor(g.players))))
  }

  return (
    <main className="lobby">
      <motion.section className="card" custom={0} variants={stagger} initial="hidden" animate="show">
        <div className="card-head">
          <h3>Waiting for players</h3>
          <span className="pill">{game.players.length} / 8</span>
        </div>
        <ul className="players">
          <AnimatePresence initial={false}>
            {game.players.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={spring}>
                <Avatar player={p} size="sm" />
                <span className="name">{p.name}</span>
                {p.id === game.hostId && <span className="tag">host</span>}
                {p.id === playerId && <span className="tag you">you</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!me ? (
          <form className="join-form" onSubmit={doJoin}>
            <label className="field">
              <span>Your name</span>
              <input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="e.g. Anna" maxLength={20} autoFocus />
            </label>
            <button className="btn primary big" type="submit">
              Join game
            </button>
          </form>
        ) : isHost ? (
          <motion.button className="btn primary big" onClick={() => mutate(startGame)} whileTap={{ scale: 0.98 }}>
            Start game{game.players.length === 1 ? ' (solo)' : ''}
          </motion.button>
        ) : (
          <p className="muted center-text waiting-text">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Waiting for {host?.name} to start
          </p>
        )}
      </motion.section>

      <motion.section className="card invite" custom={1} variants={stagger} initial="hidden" animate="show">
        <div className="card-head">
          <h3>Invite friends</h3>
        </div>
        <div className="invite-grid">
          {qr && <img className="qr" src={qr} alt={`QR code to join room ${game.code}`} />}
          <div className="invite-text">
            <span className="muted small">Room code</span>
            <div className="big-code">{game.code}</div>
            <p className="muted small">Scan the QR code or share the link.</p>
            <button className="btn" onClick={onShare}>
              <Icon name={copied ? 'check' : 'share'} size={18} />
              {copied ? 'Link copied' : navigator.share ? 'Share link' : 'Copy link'}
            </button>
          </div>
        </div>
      </motion.section>

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
