# Round 14 — Deployment audit and plan (awaiting authorization)

Audited on 2026-11-14 against the real Vercel and Fly configuration.
**Nothing remote has been changed and nothing has been published.** No
secret value appears in this document, in any log, or in any commit.
Deadline: 2026-11-18, afternoon.

## 1. What the audit found

### The publishing pipeline has been failing for a day, silently

The Vercel project is connected to GitHub and builds on every push to
this branch. **Twenty of those builds have failed**, including two
aimed at production, each in three to five seconds:

```
Cloning github.com/annatchijova/engram (Branch: feat/engram-memory-observatory, Commit: f8adec5)
Running "vercel build"
sh: line 1: vite: command not found
Error: [BUILD_UTILS_SPAWN_127] Command "vite build" exited with 127
```

The cause is structural, not a code fault: the client lives in `client/`
while Vercel builds from the repository root, where there is no
`package.json` and therefore no `vite`. The build never even starts.
This is why the public link still serves the 10 October bundle: every
attempt to replace it since has failed before compiling a line.

**Prepared fix, already in the working tree and validated locally:** a
root `vercel.json` declaring `cd client && npm ci` for install,
`cd client && npm run build` for build, and `client/dist` as the output.
Running exactly that from the repository root produces
`client/dist/index.html` with the title `ENGRAM — The Memory
Observatory` and all ten panels. It is committed locally and **not
pushed**, because pushing is a remote action.

### The client token must not be touched

The live bundle carries a read token that is **not** the local
`devtoken123`, and the Vercel project holds `VITE_ENGRAM_READ_TOKEN`
and `VITE_ENGRAM_API_BASE` as Production variables, created 35 days ago.
The live bundle already points at `https://engram-mneme-adapter.fly.dev`.

This means the deployed client and the deployed adapter were paired with
their own token, and that pairing is intact. **Round 13's plan was wrong
on this point**: baking `devtoken123` into the production build would
have broken the pair. The corrected plan rebuilds on Vercel so the
existing variable is used, and sets no secret that already exists.

I verified the match without reading either value: the live bundle does
not contain the local token, and the Vercel variables exist under the
Production environment. Whether the adapter's `ENGRAM_READ_TOKEN` still
equals the one in that variable can only be proven by a request that
returns 200, which is step V2 below.

### CORS is an allowlist, and its default excludes the public client

```python
DEV_ORIGINS = [... os.environ.get("ENGRAM_CLIENT_ORIGIN",
               "https://localhost:8081,http://localhost:8081") ...]
allow_origins=DEV_ORIGINS, allow_methods=["GET", "POST"],
allow_headers=["Authorization", "Content-Type"]
```

No wildcard, two methods, two headers. If `ENGRAM_CLIENT_ORIGIN` is not
set on Fly, the deployed adapter allows **only localhost**, and every
request from the public client is blocked by the browser. Whether it is
set cannot be read without a Fly session.

### The juror account is minimal, and reaches nothing else

- The adapter has exactly **two** POST routes: `/auth/login` and
  `/actors/{id}/quarantine`. Everything else is read-only, enforced with
  `PRAGMA query_only` on the read connection.
- `meta` acts as `analyst-omar`, so it meets MNEME's real authority gate.
  Its only added power over an anonymous visitor is that one quarantine
  endpoint; every read it can perform is already open to the read token,
  which is public in the bundle by design.
- The adapter's entire data scope is one SQLite file of synthetic records
  (`MNEME_DB_PATH=/app/data/demo_field.db`), seeded through MNEME's own
  authorized API. There is no other data source to reach.
- `agent-ada` stays deliberately under-privileged so a judge can watch a
  403 happen for real.

### Tooling

- `flyctl` **is installed** at `~/.fly/bin/flyctl` (v0.4.115); it is
  simply not on `PATH`. Round 13 said it was missing: that was wrong.
- Its **session has expired**: `fly auth whoami` returns
  "your flyctl session has expired". Logging in is interactive and is
  yours to do.
- Fly's control plane is reachable from here (`api.fly.io`,
  `api.machines.dev`, `registry.fly.io` all answer), so a deploy from
  this machine is technically possible once authenticated.
- Only `*.fly.dev` application hostnames fail here, at the TLS handshake,
  while github.com, vercel.com, fly.io and httpbin all return 200. The
  adapter's liveness therefore **cannot be judged from this machine**,
  and I am not treating that as an outage.

### Commit identity

Commit `f8adec5` was checked out into a clean worktree and built from
scratch with `npm ci`: it produces the observatory (title, ten scene
nodes, ten panels, the welcome card, the guide card's first-paint text).
`client/package.json` differs from the deployed build's commit only in
the `test` script, so the remote build has no new inputs to trip on.
`dist/` is gitignored and no build output is committed.

## 2. Alternative ways to verify the adapter

Since `*.fly.dev` is unreachable from here, pick one:

1. **You run one command** on your own network (simplest, no third party):
   `curl -s https://engram-mneme-adapter.fly.dev/health`
2. **`fly logs -a engram-mneme-adapter`** after logging in: the control
   plane is reachable from here, so this works even though the app edge
   does not.
3. **`fly status -a engram-mneme-adapter`**: reports whether a machine is
   running, without touching the app edge at all.
4. The verification in step V2 below doubles as a liveness check.

## 3. The remote actions I propose, and what each one does

Nothing below has been executed. Each line says what changes and how to
undo it.

| # | Action | What it changes | Reversible by |
|---|---|---|---|
| **A0** | *You* run `fly auth login` | a local session token on this machine; nothing remote | `fly auth logout` |
| **A1** | `fly status`, `fly secrets list`, `fly releases` (all read) | nothing. `secrets list` prints names and digests, never values | n/a |
| **A2** | `fly secrets set ENGRAM_CLIENT_ORIGIN=https://client-six-mu-93.vercel.app` — **only if A1 shows it absent or wrong** | the adapter stops allowing any other origin, including localhost; the machine restarts, which reseeds the synthetic field | re-set the previous value, which A1 will have recorded by name; a restart reseeds again |
| **A3** | `fly deploy` from `server/` | ships the current `server/app.py`, which is what adds the juror account; the machine is replaced, a few seconds of downtime, the field reseeds to the declared scenario | `fly releases` then `fly deploy --image <previous-ref>` |
| **A4** | `git push` of this branch | GitHub receives the `vercel.json` fix; Vercel builds a **preview** for the branch, not production | `git revert` and push, or ignore the preview |
| **A5** | `npx vercel deploy --prod --yes` from `client/` | Vercel builds with the existing Production variables and the public alias starts serving the observatory | `npx vercel promote https://client-lr91iui0d-anna-tchijova.vercel.app`, the 10 October deployment, which is still Ready |

**I will not touch `ENGRAM_READ_TOKEN` or `ENGRAM_DEMO_PASSWORD`.**
Rotating the read token would break the already-paired Vercel variable;
`ENGRAM_DEMO_PASSWORD` is not needed for the juror account, which
carries its own password, and changing it would invalidate the `omar`
and `ada` logins the documentation describes.

Note on A2: setting the origin to the Vercel alias alone means the
deployed adapter will no longer answer a browser on localhost. That is
correct — local development uses the local adapter that
`./scripts/dev-local.sh` starts — but say so if you would rather keep
both.

## 4. Order of execution, and the check after each step

1. **A0, A1** — authenticate, read the app state and the secret *names*.
2. **A2** if needed, then **A3** — adapter first, so the client never
   points at an older contract.
3. **V1 — health**: `curl -s .../health` → `status ok`,
   `demo_password_configured`, a `field_version` of 22 on a fresh seed.
4. **V2 — authentication and the token pairing**: log in as `meta` and
   expect 200 with `analyst-omar`'s capabilities; then one authenticated
   read with the token from the Vercel variable, which proves the pair
   still matches. An unauthenticated read must still return 401.
5. **V3 — CORS**: a preflight from the Vercel origin must be allowed and
   one from an unrelated origin must not.
6. **V4 — a real operation**: `/api/v1/bundle/export` returns the
   independent verifier's own verdict, and
   `/actors/pipeline-logs/quarantine-preview` returns a preview without
   mutating anything.
7. **A4, A5** — push the build fix, then publish the client.
8. **V5 — from the public link**: the title is
   `ENGRAM — The Memory Observatory`; the welcome card reads
   `Live field: 9 memories` rather than a failure; **Begin
   investigation** reaches step 1 with the marker on `mem-poison`;
   dragging turns the view.
9. **V6 — the full juror path on the public link**: select, inspect,
   trace, compare worlds, stage a preview, log in as `meta`, commit,
   export and read the verifier's verdict.
10. **V7 — regression**: the local suites again (42 client tests,
    adapter 8/8, readiness 5/5) and the emulator tour, to confirm
    nothing in the repo moved to make the deployment work.
11. **Reset**: `fly apps restart engram-mneme-adapter` returns the demo
    field to the declared scenario after V6's commit.

## 5. If something fails

| Symptom | Most likely cause | Response |
|---|---|---|
| The client loads but the welcome card shows a load failure | CORS, or the adapter is down | check V3, then V1; A2 fixes the origin |
| Every request returns 401 | the adapter's read token no longer matches the Vercel variable | rebuild the client with the adapter's token, or re-set the adapter's token to the variable's value. Either way, change one side only |
| The Vercel build fails again | the root `vercel.json` was not picked up | set the project's Root Directory to `client` in the dashboard, which makes `vercel.json` unnecessary |
| The published client is wrong or broken | — | `vercel promote` the 10 October deployment, which is unaffected and still Ready |
| The adapter misbehaves after deploy | — | `fly deploy --image <previous-ref>` from `fly releases` |

## 6. What I need from you

1. **`fly auth login`**, since it is interactive and the session here has
   expired.
2. **Authorization for A2 to A5**, or for a subset. I will stop before
   any of them otherwise.
3. A decision on A2's scope: the Vercel alias only, or the alias plus
   localhost.

Everything else is ready: the build fix is written and validated, the
artifact is verified, and the verification and rollback steps above are
written out so they can be run in order.
