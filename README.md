# Namma Aaata (ನಮ್ಮ ಆಟ)

Cricket tournaments, live scoring and stats. A Girish Creations project.

The frontend is its own app. The backend is shared with Girish Creations
(`../portfolio-server`): sign-in uses `/api/admin/auth/login`, and all cricket
data comes from `/api/admin/cricket/*`.

## Run locally

```sh
# in ../portfolio-server
npm run dev        # API on http://localhost:4000

# here
npm install
npm run dev        # http://localhost:5174 (proxies /api to :4000)
```

## Who sees what

- **Organisers** (super admins on the Girish Creations account) see the
  dashboard and manage players, tournaments, matches, live scoring and the
  leaderboard.
- **Players** sign in with the mobile number on their player profile (an
  organiser turns on "App login" for them in Players) and see their own stats,
  matches and tournaments.

## Deploy

`vercel.json` rewrites `/api/*` to the shared API
(`girish-creations-api.vercel.app`) and serves `index.html` for every other
path.
