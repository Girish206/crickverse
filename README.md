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

On app.runmitra.in. `vercel.json` rewrites `/api/*` to the shared API
(`girish-creations-api.vercel.app`) and serves `index.html` for every other
path. runmitra.in and www.runmitra.in are the website (`../runmitra-website`:
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

Run `npm run android:sync` after any web change: the app carries its own copy
of `dist/`, so a website deploy doesn't update it — a new APK does.

What differs in the app is in `src/app-shell/platform.ts` (it calls the API
directly, shares app.runmitra.in links, points uploaded pictures at the API) and
`src/app-shell/nativeShell.ts` (back button, share sheet, clipboard, status
and navigation bar colours from the page's `theme-color`).
`android/.../MainActivity.java` keeps every page between the status bar and
the navigation buttons, so no screen needs its own safe-area CSS. The API
allows the app's address (`https://localhost`) in `portfolio-server`'s
`config/cors.ts`. Match notifications (Web Push) aren't in the app yet.

Icons and splash come from `assets/` (made from `public/icon-maskable.svg`):
after changing them, run

```sh
npx @capacitor/assets generate --android --iconBackgroundColor "#0f1012" --iconBackgroundColorDark "#0f1012" --splashBackgroundColor "#0f1012" --splashBackgroundColorDark "#0f1012"
```
