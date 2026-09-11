# Kniffel · Yahtzee with friends

A multiplayer Yahtzee (Kniffel) web app. Create a room, share the link or the
4-letter code, and play with friends on any device. No accounts.

## Stack

- Vite + React + Framer Motion, deployed as a static site on Vercel
- Light and dark themes (follows the system, with a manual toggle)
- Supabase (Postgres + Realtime) holds one row per game in `kniffel_games`
- Every move is written with optimistic concurrency (`version` column), so two
  devices can never overwrite each other. Realtime pushes updates instantly and
  a 3 s poll covers networks where websockets are blocked.

## Rules implemented

- 13 rounds, up to 3 rolls per turn, tap dice to hold them
- Upper section bonus: 35 points at 63 or more
- Yahtzee bonus: 100 points per extra Yahtzee, plus the standard joker rule
- Up to 8 players per room; anyone with the link can watch a running game
- Live stats: standings, points per round, upper-bonus progress, averages and projections
- All-time personal stats (games, win rate, best, average) kept on the device

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # game-engine unit tests
npm run build    # production build into dist/
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` to point at your own Supabase
project. The publishable key that ships in `src/supabase.js` is safe for the
browser; access is governed by row level security. The schema lives in
`supabase/schema.sql`.
