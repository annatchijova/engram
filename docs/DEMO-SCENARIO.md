# Demo Scenario — The Compromised Memory (synthetic fixture)

All data in this scenario is synthetic, seeded through MNEME's public
API by `server/seed_demo_field.py`. Nothing here is real user data.

## Story in 30 seconds

A deploy decision was recorded citing a memory (`mem-poison`) that came
from a feed (`pipeline-feeds`) later quarantined as compromised. One
retelling of that decision is attested (`mem-note`, same actor), one is
not (`mem-omar-note`, a different actor). The investigator traces where
the poison came from, what depends on it, what changes if the gate
memory is excluded from a query, and exports evidence a third party
can verify offline.

## Cast and facts (verified by scripts/verify-fixture.py)

- Actors: `agent-ada` (recorded the decision), `pipeline-feeds`
  (compromised source, QUARANTINED), `pipeline-logs` (clean containment
  target), `analyst-omar` (investigator capabilities).
- `mem-poison`: TAINT_FLAGGED, cited by the one recorded decision.
- `mem-note`: DERIVED (attested). `mem-omar-note`: DERIVED_UNATTESTED.
- Four more memories are POSSIBLE only — co-served, never causal.
- Excluding `mem-gate` removes exactly `mem-gate` from serving.

## Run it

```sh
./scripts/dev-local.sh                 # adapter :8000 + Canvas :8081
python3 scripts/verify-fixture.py      # fixture reproducibility 8/8
python3 scripts/test-adapter.py        # adapter regressions 8/8
python3 scripts/readiness.py           # five-state readiness
```

Open `https://localhost:8081/canvas.html`, use the five guided steps
(Observe, Trace, Understand, Compare, Preserve) in the left rail.
Reset the live demo field only deliberately:
`cd server && python3 seed_demo_field.py --reset`.
