#!/usr/bin/env python3
"""ENGRAM fixture check: The Compromised Memory, seeded twice, compared.

Seeds two throwaway fields through MNEME's own public API (via
server/seed_demo_field.py), then asserts the scenario structure is
identical across runs: memory ids, custody states, provenance actors,
impact lists and the exclusion counterfactual serving sets. Timestamps
and hashes embed wall-clock time, so seals differ across seeds by
design; this check proves structural reproducibility, not bit-identical
bundles. Exit 0 = fixture reproducible. No live field is touched.
"""
from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MNEME = Path(os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme"))
sys.path.insert(0, str(MNEME))
from mneme import causality, counterfactual, field  # noqa: E402


def seed(db: Path) -> None:
    env = {**os.environ, "MNEME_DB_PATH": str(db), "MNEME_REPO_PATH": str(MNEME)}
    subprocess.run([sys.executable, str(ROOT / "server" / "seed_demo_field.py"), "--reset"],
                   check=True, env=env, capture_output=True, text=True)


def structure(db: Path) -> dict:
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        cur = conn.cursor()
        mems = cur.execute(
            "SELECT memory_id, topic, field_state, custody_status, created_by "
            "FROM memories ORDER BY memory_id").fetchall()
        impact = causality.impact(cur, "mem-poison")
        delta = counterfactual.exclusion_effect(
            cur, query_embedding=field.quantize_embedding([0.97, 0.02, 0.0]),
            excluded=["mem-gate"])
        return {
            "memories": [list(m) for m in mems],
            "impact": {
                "direct_receipts": len(impact.direct_receipts),
                # Decision/receipt ids are random per seed; counts are the structure.
                "direct_decisions": len(impact.direct_decisions),
                "derived_memories": list(impact.derived_memories),
                "derived_unattested": list(impact.derived_unattested),
                "possible_memories": list(impact.possible_memories),
            },
            "exclusion": {
                "served_a": list(delta.served_a), "served_b": list(delta.served_b),
                "removed": list(delta.removed_from_serving), "entered": list(delta.entered_top_k),
            },
        }
    finally:
        conn.close()


def main() -> int:
    a, b = Path("/tmp/engram-fixture-a.db"), Path("/tmp/engram-fixture-b.db")
    seed(a); seed(b)
    sa, sb = structure(a), structure(b)
    ok = sa == sb
    by_id = {m[0]: m for m in sa["memories"]}
    checks = {
        "two seeds structurally identical": ok,
        "mem-poison is TAINT_FLAGGED (compromised source quarantined)":
            by_id["mem-poison"][3] == "TAINT_FLAGGED",
        "mem-forged-report is QUARANTINED": by_id["mem-forged-report"][3] == "QUARANTINED",
        "mem-gate stays CLEAN and REINFORCED":
            by_id["mem-gate"][3] == "CLEAN" and by_id["mem-gate"][2] == "REINFORCED",
        "impact finds the recorded decision on mem-poison":
            sa["impact"]["direct_decisions"] == 1,
        "impact derives mem-note": sa["impact"]["derived_memories"] == ["mem-note"],
        "exclusion removes mem-gate from serving":
            sa["exclusion"]["removed"] == ["mem-gate"],
    }
    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'}  {name}")
    print(json.dumps(sa["impact"], indent=1))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
