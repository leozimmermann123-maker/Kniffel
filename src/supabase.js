import { createClient } from '@supabase/supabase-js'

// Publishable keys are safe to ship to the browser; access is limited by row level security.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ffcuwaqmdrwglpgfbclc.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_uV2c7ejgIRm-FLuEcVmpRg_8-f6wesz'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TABLE = 'kniffel_games'

export async function fetchGame(code) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('state, version')
    .eq('id', code)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function insertGame(code, state) {
  const { error } = await supabase.from(TABLE).insert({ id: code, state, version: 1 })
  if (error) throw error
  return 1
}

// Optimistic concurrency: only writes if nobody else has written since we last read.
// Returns the new version, or null when the write was rejected (stale version).
export async function updateGame(code, state, expectedVersion) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ state, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', code)
    .eq('version', expectedVersion)
    .select('version')
  if (error) throw error
  if (!data || !data.length) return null
  return data[0].version
}

export function subscribeGame(code, onRow) {
  const channel = supabase
    .channel('kniffel:' + code)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${code}` },
      (payload) => onRow(payload.new),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
