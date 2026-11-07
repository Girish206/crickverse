# RunMitra

Cricket tournaments, live scoring and stats. A Girish Creations project.

The frontend is its own app. The backend is `../runmitra-api`
(github.com/Girish206/runmitra-api): sign-in uses `/api/admin/auth/login`, and
all cricket data comes from `/api/admin/cricket/*`.

## Branches and environments

| Branch | App | API | Database | Settings |
| --- | --- | --- | --- | --- |
| `main` | app.runmitra.in | api.runmitra.in | `RunMitra` | `.env.production` |
| `dev` | dev-app.runmitra.in | dev-api.runmitra.in | `RunMitra_dev` | `.env.development` |

Work on `dev`, try it on dev-app.runmitra.in, then merge into `main`. Both env
files hold only public addresses, so they're committed; the API's own env files
(with the secrets) live in `../runmitra-api` and stay out of git.

## Run locally

```sh
# in ../runmitra-api (uses the RunMitra_dev database)
npm run dev        # API on http://localhost:4000

# here
npm install
npm run dev        # http://localhost:5174 (proxies /api to API_PROXY_TARGET)
```

`API_PROXY_TARGET` in `.env.development` is the API on this computer; set it to
`https://dev-api.runmitra.in` to use the deployed dev API instead.

## Who sees what

- **Players** sign themselves up with their mobile number. One sign-in screen
  does both: a new number goes on to a short sign-up step. They see their own
  stats, matches, tournaments and teams.
- **Anyone** can create tournaments and matches, and then manages (and
  scores) the ones they created.
- **Organisers** are super admin accounts. On top of that they see the
  dashboard and manage every player, tournament and match, and the leaderboard.

## Deploy

On Vercel: `main` on app.runmitra.in, `dev` on dev-app.runmitra.in (a domain
assigned to the `dev` branch). `vercel.json` rewrites `/api/*` to
dev-api.runmitra.in for dev-app.runmitra.in and to api.runmitra.in for every
other address, and serves `index.html` for every other path. runmitra.in and www.runmitra.in are the website (`../runmitra-website`:
home page, privacy policy, terms, account deletion), which sends links shared
before the move (`runmitra.in/matches/…`) on to the same path here.

## Android app

The same build, wrapped with [Capacitor](https://capacitorjs.com) (`android/`,
app id `in.runmitra.app`). It needs Android Studio, and `JAVA_HOME` set to its
bundled JDK (`C:\Program Files\Android\Android Studio\jbr`) to build from the
command line.

```sh
npm run android:apk    # build + sync, then android/app/build/outputs/apk/debug/app-debug.apk
npm run android:run    # build + sync, then install on a connected phone / emulator
npm run android:open   # open android/ in Android Studio (release builds, signing)
```

Those use `.env.production` (api.runmitra.in). `android:apk:dev`,
`android:run:dev` and `android:sync:dev` build against `.env.development`
(dev-api.runmitra.in) instead. Both have the same app id, so a dev build
replaces the live app on that phone.

Run `npm run android:sync` after any web change: the app carries its own copy
of `dist/`, so a website deploy doesn't update it — a new APK does.

What differs in the app is in `src/app-shell/platform.ts` (it calls the API
directly, shares app.runmitra.in links, points uploaded pictures at the API) and
`src/app-shell/nativeShell.ts` (back button, share sheet, clipboard, status
and navigation bar colours from the page's `theme-color`).
`android/.../MainActivity.java` keeps every page between the status bar and
the navigation buttons, so no screen needs its own safe-area CSS. The API
allows the app's address (`https://localhost`) in `runmitra-api`'s
`config/cors.ts`. Match notifications (Web Push) aren't in the app yet.

Icons and splash come from `assets/` (made from `public/icon-maskable.svg`):
after changing them, run

```sh
npx @capacitor/assets generate --android --iconBackgroundColor "#0f1012" --iconBackgroundColorDark "#0f1012" --splashBackgroundColor "#0f1012" --splashBackgroundColorDark "#0f1012"
```
