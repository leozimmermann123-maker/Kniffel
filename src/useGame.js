import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGame, insertGame, subscribeGame, updateGame } from './supabase.js'

const POLL_MS = 3000

// Keeps a game row in sync with Supabase: initial fetch, realtime updates, and a
// polling fallback for networks where websockets are unreliable.
export function useGame(code) {
  const [game, setGame] = useState(null)
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState(code ? 'loading' : 'idle')
  const [error, setError] = useState(null)
  const versionRef = useRef(0)

  const apply = useCallback((row) => {
    if (!row || !row.state) return
    if (row.version < versionRef.current) return
    versionRef.current = row.version
    setVersion(row.version)
    setGame(row.state)
    setStatus('ready')
  }, [])

  const refresh = useCallback(async () => {
    if (!code) return
    try {
      const row = await fetchGame(code)
      if (!row) {
        setStatus('missing')
        return
      }
      apply(row)
      setError(null)
    } catch (e) {
      setError(e.message || String(e))
    }
  }, [code, apply])

  useEffect(() => {
    if (!code) return undefined
    versionRef.current = 0
    setGame(null)
    setStatus('loading')
    refresh()
    const unsubscribe = subscribeGame(code, apply)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, refresh, apply])

  // Apply a pure state transition and persist it. Rejected writes trigger a refresh.
  const mutate = useCallback(
    async (fn) => {
      if (!code || !game) return false
      let next
      try {
        next = fn(game)
      } catch (e) {
        setError(e.message || String(e))
        return false
      }
      if (next === game) return true
      const expected = versionRef.current
      setGame(next)
      try {
        const newVersion = await updateGame(code, next, expected)
        if (newVersion == null) {
          await refresh()
          setError('Someone else moved first. Refreshed the game.')
          return false
        }
        if (newVersion > versionRef.current) {
          versionRef.current = newVersion
          setVersion(newVersion)
        }
        setError(null)
        return true
      } catch (e) {
        setError(e.message || String(e))
        await refresh()
        return false
      }
    },
    [code, game, refresh],
  )

  const clearError = useCallback(() => setError(null), [])

  return { game, version, status, error, mutate, refresh, clearError }
}

export async function createGameRow(code, state) {
  return insertGame(code, state)
}
