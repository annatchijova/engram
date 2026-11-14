# Round 12 — Release-candidate assessment

Baseline: `17fb052` on `feat/engram-memory-observatory`. This round
chases the intermittent interaction to its root, re-validates the whole
experience from clean states, checks the project against its own
published instructions, and ends with a recommendation. No capability
was added. MNEME, the adapter contracts and the custody and causal
vocabularies are untouched; the one server change is the juror account
that landed in Round 10.

**Evidence in this report is separated into four kinds and never mixed:**

| Label | Means |
|---|---|
| **AUTOMATED** | a suite anyone can re-run: `npm test`, typecheck, build, the Python scripts |
| **OBSERVED** | driven and asserted by me in the IWER Meta Quest 3 emulator or the flat-screen runtime, against the live adapter |
| **NEEDS HARDWARE** | can only be settled on a physical Quest |
| **NEEDS USERS** | can only be settled by watching people who have never seen MNEME |

## 1. The intermittent grab, resolved

Round 11 reported a grab that "needed a retry in one of three runs" and
guessed it was a single-frame ray miss. That guess was wrong. Repeated
instrumented trials found **two** distinct causes, one of them serious
and nothing to do with timing.

### D10 — a hidden panel still swallowed every ray crossing it (severity 1)

Hiding a panel set `display: none` on its UIKit root, which empties the
panel but leaves its scene node exactly where it was. The XR ray
intersector filters candidates with `isObjectTreeVisible`
(`@iwsdk/xr-input` `ray-pointer.js`), which the collapsed root never
changed. The welcome card sits dead ahead at eye height, so once it was
dismissed it went on intercepting rays aimed through it.

**OBSERVED, before the fix:** 8 of 8 trials aimed at the `pipeline-logs`
totem resolved to entity 12, the dismissed Welcome Panel. The actor
registry behind the card was unreachable: no authority inspection, no
staging from the cradle. The entity dump showed `isVisible: true` and a
stale `Hovered` tag on a card the operator had closed.

Round 11's composition change moved the card's shadow onto the rack,
which turned a latent defect into a constant one and produced the
"intermittent" symptom at its boundary.

**Fix:** one helper, `setPanelVisible`, moves the UIKit root's display
and the scene node's visibility together, and every gating site in the
onboarding, selection, actor and hover systems goes through it.
Regression test `O9` fails the build if any system toggles a panel
root's display on its own again.

A second-order defect was found and fixed while fixing this one: an
early version also forced `pointerEvents = 'auto'` when showing a panel,
which overrode what UIKit owns and left the welcome card visible with
dead buttons. Restoring now deletes the override instead of setting it.

### D11 — the totem's pick volume was thinner than it looked (severity 2)

An actor totem's visible body is a 9 cm capsule sitting 8 cm above its
entity origin, so a ray aimed at the object's own position grazed the
bottom edge of the collider.

**OBSERVED, after D10 was fixed but before D11:** 4 of 6 complete grabs;
the two failures hovered nothing at all.

**Fix:** a transparent 11.5 cm pick sphere centred on the visible body.
Transparent rather than `visible = false`, because the intersector drops
invisible objects. Regression test `O10`.

**OBSERVED, after both fixes:** **8/8** complete grabs at a 1.1 s
aim-to-press interval and **6/6** at 0.5 s, grab latency 0.42-0.43 s
every time, each trial ending in a real staged preview.

### A third cause belonged to the harness, not the app

Two long sessions degraded into a state where the emulator's own
`onDeviceFrame` threw every frame and no XR input was delivered at all.
A fresh managed runtime always recovered. My scripts also used a fixed
sleep after reloading, which asserted against a page that was still
booting. Both are now handled: the scripts poll for readiness, and the
report distinguishes a degraded emulator from an application defect.
**NEEDS HARDWARE** to know whether a headset session degrades the same
way over a long session.

## 2. The whole experience, re-validated from clean states

### Guided investigation — OBSERVED, 12/12

Cold page before every run. Welcome card alone; Begin reveals the first
question and the legend; selecting `mem-poison` opens its record with a
plain-language state line and the chain folded away; Show full record
unfolds hash, confidence and chain; Trace reveals the edge legend and
the chamber; the exclusion forecast reveals the intervention console and
the login; a staged preview reveals the vault; the verified bundle
completes it. Restart returns to the first question and re-hides what
came later. Explore freely opens everything. A flat-screen mouse click
on Begin works.

**The whole tour mutates nothing:** all nine `custody_status` values
equal the seed at the end.

### Free exploration — OBSERVED, 15/15

Select, inspect, trace, actor authority with the issuer of every grant,
cradle staging, both of MNEME's 403 refusals for `agent-ada` (widening
counterfactual and commit), authorized commit with the field and the
actor rack re-reading, bundle verification, chamber collapse. Field
reset afterwards.

### What a judge is asked to understand, and where the evidence for it is

| The judge should be able to | Evidence |
|---|---|
| see what ENGRAM is for, from the welcome | OBSERVED: the card states the question, the task and the live field size. **NEEDS USERS** for whether it lands |
| identify a memory and read its content | OBSERVED G3 |
| investigate provenance and the custody chain | OBSERVED G3/G3b, chain in server `seq` order with `entry_hash` |
| read causal relations without reading them as certainties | OBSERVED G4; AUTOMATED `O4` pins that POSSIBLE differs from DIRECT on colour, form, radius and motion, and `T8` refuses any gloss claiming falsity |
| explore a counterfactual and see its limits | OBSERVED G5, both worlds' served sets and the sealed delta, labelled never executed and never merged |
| understand an intervention before authorizing it | OBSERVED G6 and free-mode 10/12: preview rings, then a separate authorized commit that MNEME refuses for an actor without the grant |
| obtain and verify exported evidence | OBSERVED G7 and free-mode 13: the verifier subprocess's own verdict |

## 3. Judge readiness

**OBSERVED:** `./scripts/dev-local.sh`, exactly as published, brings up
the adapter on 17347 and the client on 8081, prints readiness 5/5, and
serves both `/` and `/canvas.html` with HTTP 200.

Three documentation defects were found and fixed:

| # | Sev | Defect | Fix |
|---|---|---|---|
| J1 | 2 | `docs/DEMO-SCENARIO.md` named port 8000; the script uses 17347 | corrected |
| J2 | 1 | Every published run instruction pointed only at `canvas.html`. A judge following the docs would never find the observatory. | the script and both docs now name the observatory first, with how to look around, how to enter XR, and the juror login |
| J3 | 1 | **The advertised live client serves the pre-observatory build.** `client-six-mu-93.vercel.app` returns `<title>client</title>` and `assets/index-*.js`; the current build is `<title>ENGRAM — The Memory Observatory</title>` with `assets/xr-*.js`. A judge clicking the README link sees none of this work. | README now says so next to the link, with the redeploy commands. **The redeploy itself has not been done: it publishes to your accounts and is yours to run.** |

**UNVERIFIED, not known-down:** `engram-mneme-adapter.fly.dev` did not
answer from this machine. The hostname resolves only to IPv6 here and
this machine has no IPv6 route (`Network is unreachable`), so its state
cannot be determined from here. Check it from a normal network before
relying on the live links.

## 4. Suites

**AUTOMATED**, all re-run after the fixes:

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS, 41/41 (two new: `O9` panel visibility, `O10` pick volume) |
| `npm run build` | PASS |
| `scripts/test-adapter.py` | PASS, 8/8 |
| `scripts/readiness.py` | PASS, 5/5 |

## 5. Risks still open

| Risk | Sev | Status |
|---|---|---|
| The live client serves the old build | 1 | Fix is a redeploy you run; README warns in the meantime |
| The live adapter's state is unknown from here | 1 | Needs a check from a normal network |
| No physical Quest has ever run this | 2 | NEEDS HARDWARE: comfort over a session, hand-tracking pinch on a 2.4 cm target, legibility at true IPD, frame time, the virtual keyboard for the juror login |
| No one who has never seen MNEME has used it | 2 | NEEDS USERS. Functional completion is not comprehension |
| A long emulator session can degrade until no XR input is delivered | 3 | OBSERVED twice, always cured by a fresh runtime; unknown on hardware |
| The demo field is mutated by any commit the judge performs | 3 | By design and documented; `seed_demo_field.py --reset` restores it |

## 6. Recommendation

**Ready for evaluation when a judge runs it locally or in a headset
against the local adapter. Not ready to be judged through the links
currently advertised in the README.**

The functional and semantic claims hold: every operation is real, every
refusal comes from MNEME, the guided path completes without writing, and
the bundle verdict is an independent process's own output. The flat
screen and the emulated headset both complete the full investigation
from a cold page.

Two things stand between that and an unqualified yes, and only one of
them is mine to close. The live client must be redeployed and the live
adapter confirmed, or the README must keep pointing judges at the local
commands. And nobody outside this project has yet used it: I can show
that the tour cannot be completed by accident and that it never
overclaims, but **whether a first-time researcher finds it intuitive is
not something these tests can establish**, and I am not claiming it.

## Running it

```sh
cd server && python3 seed_demo_field.py --reset      # clean state
./scripts/dev-local.sh                               # adapter + client, prints both URLs
```

Flat screen: open `https://localhost:8081/`, drag to look around, click
to select, `Home` to recentre. Headset: open the LAN URL Vite prints in
Quest Browser and press Enter XR. Juror login for the committing steps:
`meta` / `metavr`. `agent-ada` (`ada`) holds fewer grants and is refused
by MNEME, which is the point of that account.
