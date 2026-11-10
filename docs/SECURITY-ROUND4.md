# Security — Round 4

Threat model and claim discipline: every CONFIRMED below names its
executed run; CODE FACT means read, not run; unresolved items stay
unresolved. Full probe table: ENGRAM-REDTEAM-ROUND3.md.

## Executed this round (scripts/test-adapter.py, throwaway field)

Unauthenticated read 401; memory id against the actor endpoint 404;
preview stages with field_version unchanged (staging is not
committing); stale commit 409; ada widening 403 with field unchanged;
omar widening 200 with read_audit RECORDED; seeded bundle VERIFIED;
tampered bundle rejected by MNEME's independent verifier. 8/8 PASS.

## Fixed defect (honest degradation)

`diagnoseConnection` mapped HTTP 503 to "connected" — an adapter that
answered without a seeded MNEME field rendered as success. Now 503 is
its own state, `mneme-unavailable`, distinct from
`empty-investigation` and from `server-unavailable`. A broken custody
link structure is flagged invalid in the inspector; the display check
covers linkage only and never claims recomputed integrity — the
bundle verifier remains authoritative. Findings travel with their
labels: DIRECT/DERIVED/DERIVED_UNATTESTED/POSSIBLE, server confidence
text, and impact/delta seals stay attached in the inspector, the
comparison panels and the export.

## Not executed

Duplicate-commit replay (would mutate the demo field), simultaneous
races, malformed-payload fuzzing, screen-reader/browser rendering,
Quest or simulator input failure (no device; simulator frontend not
running). Each reopens on the falsifier named in the Round 3 report.
