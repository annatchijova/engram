# XR Round 10 — Guided First Contact

Baseline: `a3c37c6` on `feat/engram-memory-observatory`. Same branch,
later commit. The observatory from Round 9 is unchanged in architecture;
this round makes it understandable to someone who has never heard of
MNEME, without hiding any capability. Every claim carries an evidence
label; nothing is promoted beyond what was executed.

## What a newcomer now sees

1. **The welcome card**, inside the room, over the field: *Can this memory
   be trusted?* A recorded decision relied on a memory whose source was
   later quarantined. Two choices: **Begin investigation** or **Explore
   freely**. The card also carries the live field state (or the adapter
   failure, verbatim). Nothing else is shown yet.
2. **Five questions**, one at a time, each answered by one real operation
   and each pointing at the one object that answers it with a white
   START HERE / NEXT marker in the room:

   | Step | Question | Answered by | Reveals |
   |---|---|---|---|
   | 1 | Which memory deserves our attention? | selecting `mem-poison` | custody legend |
   | 2 | Where did this memory come from? | the custody tower + inspector | (inspector opens on selection) |
   | 3 | What depended on this information? | Trace impact | edge-class legend, counterfactual chamber |
   | 4 | What would change without it? | Exclusion forecast | intervention console, operator login |
   | 5 | What would an intervention do, and who may do it? | a staged preview (read-only) | verification instrument |
   | done | The investigation is preserved. | Export & Verify | everything, explore freely |

3. **Progressive disclosure** everywhere else: core labels carry identity,
   state and a one-line plain gloss; topic and excerpt live on the hover
   card; the inspector shows state and content first and the hash, exact
   confidence and event-by-event chain behind **Show full record**; while
   one memory is open, the other labels step back so the tower and edges
   have room to read.

Progress depends only on `OnboardingEvents`, which fire only from a
server-confirmed success path. There are no timers. A failed operation
emits nothing and advances nothing. "Explore freely" and "Restart the
investigation" are explicit operator choices.

## Words were checked against MNEME, not written from memory

| Phrase in the room | Source |
|---|---|
| TAINT_FLAGGED: *its source actor was quarantined; needs investigation, can be rehabilitated* | `mneme/custody.py` 316-323 (`TAINT_FLAGGED` is transitive, `REHABILITATED` valid only from it) |
| SUPERSEDED: *a newer version exists; this record is kept, not deleted* | `custody.py` M4: nothing is deleted |
| QUARANTINED: *direct evidence against it; withheld from recall* | `server/app.py` `CUSTODY_STATUS_MEANING` |
| DERIVED vs DERIVED (unattested): *same actor* vs *a different actor made the claim, so it is weaker and says so* | `mneme/causality.py` 60-78 |
| POSSIBLE: *served alongside it, which is contact, not a cause* | `causality.py` 80-84: "reported, never acted on, and never a custody status" |
| World A / World B, *never merges into the field* | `mneme/counterfactual.py` `compare_worlds`: neither world is privileged; widening needs `COUNTERFACTUAL` |
| The verifier *does not decide whether any memory's content is true* | `verify_offline.py` checks B0-B9 (structure and hashes) |

No sentence says a flagged memory is false. Test `T8` refuses the words
*false*, *untrue*, *fake*, *lie* in any gloss or tour text.

## Juror account

`meta` / `metavr`, acting as `analyst-omar`, with its own published
password so judges can log in from the README. `omar` and `ada` still
require `ENGRAM_DEMO_PASSWORD`. Everything the account can reach is the
declared synthetic field, and the authority gate it meets is the real one.
Verified: `meta`/`metavr` → 200 with analyst-omar's grants; wrong
password → 401; `omar` unchanged.

## Verification actually executed

Environment as in Round 9: IWSDK managed Chromium, IWER emulated
**Meta Quest 3**, live adapter, seeded synthetic field. Assertions are on
ECS values and live UIKit element state.

### Guided tour — emulated XR, 12/12

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | Welcome card first; guide, chamber, containment, login, vault hidden | **PASS** | `welcome-status = Live field: 9 memories, field_version 22.` |
| G2 | Begin: step 1 question, legend revealed, welcome gone | **PASS** | `Which memory deserves our attention?` |
| G3 | Selecting `mem-poison` → ORIGIN; plain state line; chain hidden until asked | **PASS** | `its source actor was quarantined; needs investigation, can be rehabilitated - stored by pipeline-feeds` |
| G3b | Show full record reveals hash, confidence, chain | **PASS** | `sha256 c709169d…` displayed |
| G4 | Trace → CONSEQUENCES; chamber + edge legend revealed; containment still hidden | **PASS** | `What depended on this information?` |
| G5 | Exclusion forecast → ALTERNATIVES; containment + login revealed; vault hidden | **PASS** | `What would change without it?` |
| G6 | Staged preview → INTERVENTION, no commit; vault revealed | **PASS** | preview: would TAINT_FLAG `mem-log-ingest` |
| G7 | Verified bundle completes the tour | **PASS** | `INVESTIGATION - COMPLETE`, verifier `VERIFIED` |
| G8 | The tour mutated nothing | **PASS** | all nine `custodyStatus` values equal the seed |
| G9 | Restart returns to step 1 and hides later surfaces | **PASS** | containment and vault hidden again |
| G10 | Explore freely reveals every surface | **PASS** | all roots displayed |
| G11 | Desktop mouse click on Begin starts the investigation | **PASS** | click at canvas (x, y) found by hover probe; guide shown |

### Round 9 regression — emulated XR, 15/15 (explore mode)

The full loop from Round 9 (select, inspect, trace, actor authority,
cradle staging, ada refused twice with 403, omar commit, verify,
collapse) still passes after leaving the tour with Explore freely. The
demo field was reset afterwards.

### Juror account and degradation — emulated XR, 3/3

| # | Check | Result | Evidence |
|---|---|---|---|
| J1 | In-world login as `meta`/`metavr` | **PASS** | `logged in as Juror (as Analyst Omar)` |
| J2 | Commit as the juror mutates MNEME and the field re-reads | **PASS** | `committed: sweep sweep-a138…`; `mem-log-ingest CLEAN → TAINT_FLAGGED`; field reset afterwards |
| R7' | Cold start with the adapter down: the welcome card carries the failure, zero cores rendered | **PASS** | `FAILED to load the field: … unreachable or timed out`, `cores=0` |

### Suites

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS**, 39/39 (8 tour tests replace the 5 Round-8 gating tests; 8 observatory invariants unchanged) |
| `npm run build` | **PASS** |
| adapter login paths (`meta`, wrong password, `omar`) | **PASS** by direct request |

### NOT TESTED

- **Any physical headset**; no Quest was connected. Comfort, real hand
  pinch, text legibility at real IPD: unverified.
- **Usability with new users.** The functional tests prove the tour can
  be completed and gates correctly. They do not prove a first-time
  researcher understands it; that needs a session with real people.
- The in-headset keyboard for the juror login.

## Files changed

| File | Change |
|---|---|
| `server/app.py` | juror account `meta`/`metavr` with its own password; operator accounts unchanged |
| `client/src/onboarding-stage-machine.ts` | rewritten: WELCOME → DISCOVER → ORIGIN → CONSEQUENCES → ALTERNATIVES → INTERVENTION → COMPLETE; `beginTour`, `exploreFreely`, `restartTour`, `revealedAt` |
| `client/src/tour-script.ts` | new: question, explanation, action and spatial target per stage; `CUSTODY_GLOSS` |
| `client/src/onboarding-system.ts` | rewritten around the script and the reveal schedule; milestones incl. the optional real commit |
| `client/src/guide-system.ts` | new: START HERE / NEXT marker on the object that answers the current question |
| `client/src/tour-state.ts` | new: stage pub/sub |
| `client/src/field-system.ts` | two-line labels + plain gloss; focus mode hides other labels while one memory is open; welcome carries the field state or the failure |
| `client/src/selection-system.ts` | plain-language state line; Show full record toggle |
| `client/public/ui/welcome.uikitml` | new |
| `client/public/ui/next-step.uikitml` | guide card: question, explanation, next action, progress, Explore / Restart |
| `client/public/ui/detail.uikitml` | progressive layout |
| `client/public/ui/legend.uikitml`, `login.uikitml` | gated roots; juror hint |
| `client/public/scenes/main.iwsdk.scene.json` | welcome node; side consoles moved clear of the station consoles |
| `client/tests/onboarding-gating.test.mjs` | rewritten for the new machine and script (T1-T8) |
