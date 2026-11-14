# Round 13 — Deployment readiness

Baseline: `f5d5b50` on `feat/engram-memory-observatory`. This round closes
the gap between the validated build and what a judge would receive. No
feature was added. MNEME is untouched. Nothing has been published: the
deploy commands are below and are yours to run.

## 1. Component status

| Component | State | Detail |
|---|---|---|
| Observatory client, source | **Current** | this branch at `f5d5b50` plus this round |
| Observatory client, production build | **Built and validated** | `npm run build`, 7.7 MB, title `ENGRAM — The Memory Observatory`, all 11 panels and the 10-node scene shipped |
| Deployed client (`client-six-mu-93.vercel.app`) | **Stale** | serves `<title>client</title>` and `assets/index-*.js`: a build from before `a3c37c6`, so none of the observatory is there |
| Deployed adapter (`engram-mneme-adapter.fly.dev`) | **Unverified, not known-down** | resolves to `66.241.124.70` and an IPv6 address; neither completes TLS from this machine, while github.com, vercel.com, fly.io and httpbin all return 200. `*.fly.dev` appears unreachable from here. Check it from a normal network |
| Local adapter | **Healthy** | `/health` 200, `field_version` 22, readiness 5/5 |
| Vercel CLI | **Logged in** as `annatchijova-3438`, project `client` (`prj_IbmJ…`), org `team_ooSM…` |
| Fly CLI | **Not installed** on this machine |
| MNEME | **Untouched**, pinned in the adapter image at `124739ee` |

## 2. What the client needs to work from a public link

1. **A reachable adapter over HTTPS.** The API base is baked at build
   time; the artifact prepared here points at
   `https://engram-mneme-adapter.fly.dev`. An `http://` adapter would be
   blocked as mixed content from a Vercel page.
2. **CORS.** The adapter must list the Vercel origin in
   `ENGRAM_CLIENT_ORIGIN`, or every request fails in the browser.
3. **A read token that matches.** `VITE_ENGRAM_READ_TOKEN` in the build
   must equal the adapter's `ENGRAM_READ_TOKEN`. The artifact prepared
   here uses `devtoken123`; if the Fly app was given a different one,
   rebuild with it.
4. **The current adapter code**, for the juror account. `meta`/`metavr`
   exists only in this branch's `server/app.py`, so the adapter must be
   redeployed too, or judges cannot log in at all unless
   `ENGRAM_DEMO_PASSWORD` is set and they are told it.
5. **Nothing else.** The client is a static bundle: no server-side
   rendering, no cookies, no third-party services. Endpoints used are
   `/health`, `/api/v1/field/overview`, `/memories`, `/memories/{id}`,
   `/memories/{id}/custody`, `/memories/{id}/impact`, `/actors`,
   `/actors/{id}/authority`, `/actors/{id}/quarantine-preview`,
   `/counterfactual/exclusion-effect`, `/counterfactual/containment-effect`,
   `/bundle/export`, `/auth/login`, and the single mutating
   `/actors/{id}/quarantine`.

## 3. Blockers to publishing

| # | Blocker | Who can clear it |
|---|---|---|
| B1 | The deployed client is the pre-observatory build | you, by running the deploy command below |
| B2 | The deployed adapter predates the juror account, and its reachability is unverified from here | you, by redeploying and checking it from a normal network |
| B3 | Fly secrets are unknown to me: `ENGRAM_READ_TOKEN` must match the baked token, and `ENGRAM_CLIENT_ORIGIN` must include the Vercel origin | you, by reading or setting them |

Nothing else stands in the way. The artifact is built and validated.

## 4. Deployment commands

Run from the repo root, on this branch.

```sh
# 1. Adapter first, so the client never points at an older contract.
#    Install flyctl if needed: curl -L https://fly.io/install.sh | sh
cd server
fly secrets set \
  ENGRAM_READ_TOKEN=devtoken123 \
  ENGRAM_CLIENT_ORIGIN=https://client-six-mu-93.vercel.app
fly deploy
curl -s https://engram-mneme-adapter.fly.dev/health      # expect status ok, field_version 22

# 2. Client, with the API base baked in.
cd ../client
VITE_ENGRAM_API_BASE=https://engram-mneme-adapter.fly.dev \
VITE_ENGRAM_READ_TOKEN=devtoken123 \
  npm run build
npx -y vercel@latest deploy --prod --yes
```

If you prefer the token not to be `devtoken123` in public, choose another
value and use the same one in both commands. It unlocks read endpoints
only; that is a stated limitation, not a secret worth protecting.

## 5. Checks to run after publishing

```sh
curl -s https://engram-mneme-adapter.fly.dev/health
curl -si https://client-six-mu-93.vercel.app/ | grep -i '<title>'
#   expect: ENGRAM — The Memory Observatory
curl -s -X POST https://engram-mneme-adapter.fly.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"meta","password":"metavr"}'
#   expect 200 with analyst-omar's capabilities
```

Then open the client link in a browser and confirm, in this order: the
welcome card reads `Live field: 9 memories, field_version 22` rather
than a failure; **Begin investigation** advances to step 1 with the
START HERE marker on `mem-poison`; dragging turns the view. Those three
prove the static bundle, the adapter and CORS are all correct together.

## 6. Rollback

Both platforms keep immutable previous deployments.

```sh
npx -y vercel@latest ls client                 # find the previous deployment URL
npx -y vercel@latest promote <previous-url>    # instant, no rebuild
fly releases --app engram-mneme-adapter
fly deploy --image <previous-image-ref>        # or: fly releases rollback
```

The demo field is ephemeral by design: no Fly volume is mounted, so
`fly apps restart engram-mneme-adapter` reseeds the declared synthetic
scenario. That is also the reset procedure after judges commit a
quarantine.

## 7. Security and isolation

- **Mutating surface: two POST routes in the whole adapter** — `/auth/login`
  and `/actors/{id}/quarantine`. Everything else is read-only, enforced
  by `PRAGMA query_only` on the read connection.
- **The juror account acts as `analyst-omar`**, so it meets MNEME's real
  authority gate rather than bypassing it. Its blast radius is the single
  quarantine endpoint against a synthetic field. `agent-ada` is kept
  deliberately under-privileged so a judge can watch MNEME refuse.
- **Published on purpose:** `meta`/`metavr` and the read token. Anyone who
  finds the adapter can quarantine a demo actor; the field is synthetic,
  nothing else is reachable, and a restart restores it.
- **Not published:** no API keys, tokens or private material in the
  artifact. A scan of the shipped bundle for key-shaped strings found
  none beyond the documented read token.
- **Data:** one SQLite file of synthetic records seeded through MNEME's
  own authorized API. No user data, no connection to anything else.

## 8. Validation, by category

**Local, against the dev server (AUTOMATED + OBSERVED)**

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS, 42/42 |
| `scripts/test-adapter.py` | PASS, 8/8 |
| `scripts/readiness.py` | PASS, 5/5 |
| `./scripts/dev-local.sh` exactly as published | PASS: adapter 17347, client 8081, both pages 200 |

**The production build (OBSERVED, in the maintainer's own Chrome, served
as a static site against the live adapter)**

| Check | Result |
|---|---|
| Artifact contents: title, 11 panels, 10-node scene, baked API base | PASS |
| Page loads, welcome card renders, `Live field: 9 memories, field_version 22` | PASS |
| **Begin investigation** advances to step 1 with the marker on `mem-poison` | PASS |
| Clicking the marked core opens the record and raises the custody tower; step 2 question, explanation and next action all render | PASS |
| Look control: drag turns the view, arrow taps nudge, `Home` recentres | PASS |
| A real MNEME operation from the deployed-style bundle | PASS: `GET /api/v1/bundle/export` → 200 in the adapter log |

**Emulated Quest 3 (OBSERVED)**

| Check | Result |
|---|---|
| Guided investigation from a cold page | PASS, 12/12 |
| Free exploration, both 403 refusals, authorized commit, verification | PASS, 16/16 |
| Totem grab, carry, release, stage | PASS: 8/8, 6/6 and 5/5 across three series |
| Carry a totem out and back, then select a memory | PASS |

**Pending on physical hardware (NOT TESTED, not a delivery blocker)**

The hackathon accepts emulator development and testing. Everything
reachable in the emulator has been exercised; these need a headset:
comfort over a session, hand-tracking pinch on a 2.4 cm target,
legibility at true IPD, on-device frame time and thermals, and the Quest
Browser virtual keyboard for the juror login. The artifact requests
`immersive-vr` with `local-floor` and `hand-tracking`, and
`offer: always`, so Quest Browser shows Enter XR without any extra step.

**Pending with real users (NOT TESTED)**

Whether a first-time researcher finds it intuitive. The tests show the
tour completes, gates correctly and never overclaims. They cannot show
comprehension.

**Not verifiable from here**

The deployed adapter's liveness, for the IPv6/TLS reason in section 1.

## 9. Defects found and fixed this round

| # | Sev | Defect | Fix |
|---|---|---|---|
| D12 | 1 | Step one of the guided tour rendered its question with **no explanation and no next action**. UIKit drops a text update aimed at a hidden panel, and an element that ships empty never creates a text node to receive one. No functional test caught it: the two lines that did render were markup defaults that happened to match step one. | Panels are shown before they are written to, and every element the code fills now ships with a first-paint default. Regression test `O11` |
| D13 | 1 | The flat-screen look control **did nothing in the production build** while working on the dev server: the camera is re-synced from the player rig every frame outside an immersive session, so a one-shot write was overwritten before it was drawn. | Yaw turns the player rig, pitch tilts the camera, and both are re-applied every frame |
| D14 | 2 | A tapped arrow key did nothing: the key was released before the next frame. | A tap nudges, a hold keeps turning |
| D15 | 2 | A quick drag did nothing: the look-versus-grab decision waited a frame that a fast flick never reached. | The decision is made on the first movement |

## 10. The intermittent grab, finally quantified

Round 12 fixed two real causes and measured 8/8. A later series read 1/8,
which I chased rather than averaged. The difference is the harness: the
trial script's own return-to-rack step teleports the controller pose
twice more per cycle with no settling, and after the first cycle the
emulated pointer keeps resolving to a panel. With that step removed the
same build gives 5/5, aim acquired on the first command every time, and
the user-shaped sequence — carry a totem to the cradle, carry it back,
then select a memory — passes cleanly. The app-level behaviour is sound;
the flake belongs to the test harness and is recorded here rather than
averaged away.
