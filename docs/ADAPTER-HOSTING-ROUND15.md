# Round 15 — Where the adapter runs, and the final publish plan

Read-only verification only. **No remote resource was created or
changed.** No secret value appears here.

## 1. The old adapter: corrected, with evidence

Round 14 said the previous app was "irrecoverable". That was an
inference beyond the evidence, and the correction matters. What is now
established, from Fly's own mail to Anna:

- The machine hosting `engram-mneme-adapter` in `gru` (machine
  `080752da993518`) **suffered a hardware failure** and is down for an
  extended period. Fly's advice is to recreate machines elsewhere and
  restore from backups rather than wait.
- The **trial on that account ended**; keeping apps running there needs
  a card.
- The current account, `annia.tchi.comepasto@gmail.com`, is admin of one
  personal organisation with **zero apps**: it cannot manage, restart or
  roll back that app.

So the accurate statement is not "lost" but: **unreachable, unmanageable
from here, and down for reasons outside our control.** Either way it
cannot serve judges, and waiting on it is not a plan.

## 2. What the adapter actually needs from a host

Verified by building and running the real image locally, not assumed:

| Requirement | Evidence |
|---|---|
| Builds from the repo Dockerfile, cloning MNEME at the pinned commit | image built, 269 MB |
| Seeds the synthetic field at boot | `field written to /app/data/demo_field.db`, `field_version` 22 |
| Keeps state across requests in a running instance | an authorized commit moved `field_version` 22 → 23 and the next request saw it |
| Spawns a subprocess at runtime | the bundle's independent verifier ran inside the container: `VERIFIED exit 0`, 9 memories |
| Serves on whatever port the host injects | same image answered on 8080 and on `PORT=7860` |
| Needs no persistent volume | reseeds on restart, which is the documented reset procedure |
| ~512 MB, one shared CPU | what the previous deployment used |

The Dockerfile now reads `$PORT` with 8080 as the default, so one image
serves Fly, Hugging Face Spaces, Render and Cloud Run unchanged.

## 3. Authorization controls, verified against the running container

The public read token must not become a privileged credential. It does
not, and the guarantee is structural: two disjoint authentication paths.
`require_token` compares a bearer against `ENGRAM_READ_TOKEN` and guards
only GET routes; `require_session` looks a bearer up in the in-memory
session map, which only `login` ever writes with a freshly generated
token. Measured against the container:

| Check | Result |
|---|---|
| Read with the token | 200 |
| Read with no token | 401 |
| **The public read token used against the mutation** | **401 from the session guard** |
| Juror login `meta` | 200, acts as `analyst-omar`, 7 capabilities |
| Operator login with no `ENGRAM_DEMO_PASSWORD` set | 503, fail-closed, no default credential |
| Quarantine preview | 200, flags `mem-log-ingest`, mutates nothing |
| Authorized commit with a session token | 200, `field_version` 22 → 23 |
| Bundle export | `VERIFIED exit 0` from the independent verifier |
| CORS preflight from the Vercel origin | allowed |
| CORS preflight from an unlisted origin | refused, no allow header |

Ten of ten. The juror account works with no server secret configured at
all, which is what makes a card-free host viable.

## 4. Host options, with what is verified and what is only documented

| | Fly (new app) | Hugging Face Spaces (Docker) | Render free |
|---|---|---|---|
| Card required | **Yes.** Fly's pay-as-you-go needs one, and the trial is spent | No | No, for free web services |
| Image compatibility | verified locally | verified locally, needs `app_port: 7860` | verified locally |
| Sleep behaviour | none with `min_machines_running = 1` | documented: free Spaces idle out after ~48 h, not minutes | documented: spins down after 15 min idle, cold start tens of seconds |
| Judge-facing risk | none | a judge arriving after a long idle waits for one cold start | **a judge is likely to hit a cold start**, since gaps between visits will exceed 15 minutes |
| Account needed | exists | a free Hugging Face account | a free Render account |

"Verified locally" means the container itself was proven; the sleep,
uptime and quota rows are each platform's **documentation**, not
something I measured, and I am not presenting them as measured.

**Recommendation: Hugging Face Spaces with the Docker SDK**, because it
needs no card, does not idle out on a timescale that would catch a
judge, and runs the image unchanged. Fly stays the better home the day
there is a card on the account: the plan below swaps hosts by changing
one hostname.

## 5. The final publish plan: five remote operations

Each one still needs your explicit go-ahead.

| # | Operation | Changes | Undo |
|---|---|---|---|
| **P1** | Create a Space, Docker SDK, public, from your Hugging Face account | a new empty Space | delete the Space |
| **P2** | Push `server/` plus a Space `README.md` (with `app_port: 7860`) and set `ENGRAM_READ_TOKEN` and `ENGRAM_CLIENT_ORIGIN` as Space **secrets** | the adapter goes live at `https://<user>-engram-adapter.hf.space` | delete the Space, or push the previous commit |
| **P3** | Update the two Vercel Production variables: `VITE_ENGRAM_API_BASE` to the new host, `VITE_ENGRAM_READ_TOKEN` to the token set in P2 | the next client build targets the new adapter | restore the previous values, which I record by name before changing |
| **P4** | `git push` this branch, carrying the `vercel.json` build fix and the Dockerfile `$PORT` change | GitHub gets the fix; Vercel builds a **preview**, not production; `main` untouched | revert and push |
| **P5** | `npx vercel deploy --prod --yes` from `client/` | the public alias serves the observatory against the new adapter | `vercel promote https://client-lr91iui0d-anna-tchijova.vercel.app` |

The read token is public by design: it rides inside the client bundle
and unlocks read endpoints only, as section 3 proves. Choosing a fresh
value for it in P2 and P3 costs nothing and removes the guesswork about
what the dead adapter was paired with. `ENGRAM_DEMO_PASSWORD` stays
unset, so `omar` and `ada` return a clean 503 on the public instance
while the juror account works.

## 6. Verification after publishing

In order, stopping at the first failure: health; an authenticated read;
the read token refused by the mutation; juror login; a preview that
mutates nothing; an authorized commit; the bundle verifier's own
verdict; a CORS preflight allowed from the Vercel origin and refused
from another. Then from the public link: the title, the welcome card
reading `Live field: 9 memories` rather than a failure, **Begin
investigation** reaching step one with the marker on `mem-poison`,
dragging to turn, and the full guided path through to the verified
bundle. Then the local suites and the emulator tour, to confirm nothing
in the repo moved to make the deployment work.

Reset after judging: restart the Space, which reseeds the declared
scenario.

## 7. What I need

1. **A decision on the host**: Hugging Face Spaces, or Fly if you would
   rather add a card.
2. **Hugging Face access**, if that is the choice: either you create the
   Space and paste its name, or a write token so I can create and push
   it. I will not ask for or handle your account password.
3. **Authorization for P1 to P5**, or for any prefix of them.
