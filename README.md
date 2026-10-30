# RunMitra

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

- **Players** sign themselves up with their mobile number. One sign-in screen
  does both: a new number goes on to a short sign-up step. They see their own
  stats, matches, tournaments and teams.
- **Anyone** can create tournaments and matches, and then manages (and
  scores) the ones they created.
- **Organisers** are super admins on the Girish Creations account. On top of
  that they see the dashboard and manage every player, tournament and match,
  and the leaderboard.

## Deploy

`vercel.json` rewrites `/api/*` to the shared API
(`girish-creations-api.vercel.app`) and serves `index.html` for every other
path.
