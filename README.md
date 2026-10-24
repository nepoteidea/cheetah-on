# Cheetah On

A full-screen phone game played on a cheetah rug. Tilt your phone to roll a tiny chrome ball
around the green pile. Touch the pink border or the cheetah and the game is over. There's no
score and no goal: you just stay in as long as you can.

Live at **https://cheetah-on.nepoteidea.com** (deployed from `main`).

## How it plays

- **Phones:** tap **Play**. On iOS, allow motion access when asked. However you're holding the
  phone when you tap counts as level, so you can play sitting or lying down.
- **Computers:** use the arrow keys or WASD.
- The game always runs in landscape. It asks the browser for fullscreen and a landscape lock.
  Where that's not supported (iOS Safari), the stage rotates itself, so a portrait screen still
  shows it in landscape.
- Collisions follow the cheetah's real outline (tail, ears, paws, the gaps between the legs and
  the space under the belly), not a bounding box.

## Code

Plain JavaScript (ES modules) on a 2D canvas, built with Vite. No framework, no runtime
dependencies.

| File              | What it does                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `src/cheetah.js`  | The cheetah's silhouette: one set of shapes used for drawing and collisions |
| `src/field.js`    | World layout (1000 units tall, screen-aspect wide), hit tests, spawn point  |
| `src/game.js`     | State machine and ball physics (fixed 240 Hz substeps, no tunnelling)       |
| `src/input.js`    | Device orientation → screen tilt for every screen rotation, keyboard backup |
| `src/geometry.js` | Distances, point-in-polygon, splines, seeded PRNG                           |
| `src/render.js`   | Rug, frame and cheetah drawn once per resize; chrome ball drawn each frame  |
| `src/main.js`     | DOM wiring: canvas sizing, fullscreen/orientation lock, wake lock, loop     |

## Development

```sh
npm install
npm run dev            # local dev server
npm run lint           # ESLint
npm run format:check   # Prettier
npm test               # Vitest unit tests (npm run test:coverage for coverage)
npx playwright install chromium
npm run test:e2e       # Playwright: desktop, phone landscape, phone portrait
```

To try tilt controls on a real phone during development, run `npm run dev -- --host` and open
the LAN URL. iOS only exposes motion sensors over HTTPS, so use a PR preview deployment there.

## Deployment

Cloudflare Workers (static assets), configured in `wrangler.jsonc`. GitHub Actions deploys
`main` to production and uploads every pull request as a preview version, then comments the
preview URL on the PR. Credentials come from the nepoteidea org:
`secrets.CLOUDFLARE_API_TOKEN` and `vars.CLOUDFLARE_ACCOUNT_ID`.
