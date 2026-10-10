#!/usr/bin/env python3
"""ENGRAM — seed a demo MNEME field for Nivel 1 (Provenance Field).

Writes a persistent SQLite field at server/data/demo_field.db using ONLY
MNEME's public, authorized API (bootstrap_root, register_actor, grant,
store, reinforce, supersede, quarantine_actor, quarantine_memory). No row
in memories/custody_chain/authority_chain is ever inserted by hand here —
every row this script produces is custody- and authority-correct exactly
the way an operator's MNEME would produce it, which is the whole point:
ENGRAM inspects a genuinely verifiable field, not a mock.

The story (steps 0-4) is the same poisoned-RAG incident narrated end to
end in /home/labestiadevigia/mneme/demo.py: a persisted recall receipt and
a decision citing mem-poison (step 2) give Nivel 3's causality.impact() a
real DIRECT/DERIVED chain to trace, and a supersession plus a direct
memory quarantine (steps 3-4) give Nivel 1 a real example of every
custody_status in the ontology table: CLEAN, TAINT_FLAGGED, QUARANTINED,
SUPERSEDED, plus REINFORCED field_state.

Usage:
    python3 seed_demo_field.py           # refuses if the db already has data
    python3 seed_demo_field.py --reset   # deletes the db file first, then seeds
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

MNEME_REPO_PATH = os.environ.get("MNEME_REPO_PATH", "/home/labestiadevigia/mneme")
sys.path.insert(0, MNEME_REPO_PATH)

from mneme import authority, causality, field, trust  # noqa: E402

HERE = Path(__file__).parent
DB_PATH = Path(os.environ.get("MNEME_DB_PATH", HERE / "data" / "demo_field.db"))
SCHEMA_PATH = Path(MNEME_REPO_PATH) / "mneme" / "schema.sql"

e = field.quantize_embedding


def section(title: str) -> None:
    print(f"\n{'=' * 72}\n{title}\n{'=' * 72}")


def seed(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    section("0. Authority ledger")
    root_grant = authority.bootstrap_root(
        cur, actor_id="root-ops", display_name="Root Operator", kind="HUMAN",
        reason="field genesis: operator provisioned out of band")
    print(f"root-ops bootstrapped the ledger (grant {root_grant[:18]}...)")

    for aid, kind, caps, why in [
        ("agent-ada", "AGENT", ["STORE", "REINFORCE", "DECIDE"],
         "runbook ingestion and on-call answers"),
        ("pipeline-feeds", "PIPELINE", ["STORE", "REINFORCE"], "feed sync duty"),
        ("pipeline-logs", "PIPELINE", ["STORE"], "log ingestion duty"),
        ("analyst-omar", "HUMAN",
         ["STORE", "SUPERSEDE", "REINFORCE", "QUARANTINE_ACTOR",
          "QUARANTINE_MEMORY", "REHABILITATE", "COUNTERFACTUAL"],
         "incident response duty"),
    ]:
        authority.register_actor(cur, actor_id=aid, display_name=aid, kind=kind,
                                  issuer_id="root-ops", reason=why)
        authority.grant(cur, subject_id=aid, capabilities=caps,
                         issuer_id="root-ops", reason=why)
        print(f"  {aid:<16} granted {', '.join(caps)}")
    conn.commit()

    section("1. The field grows - including a compromised pipeline's write")
    stored = field.store(
        cur, memory_id="mem-gate", actor_id="agent-ada", reason="runbook ingestion",
        content="Production deploys require the staging gate to pass.",
        embedding=e([1.0, 0.1, 0.0]), embedding_model="demo",
        topic="deploy-policy", claim="gate-required")
    print(f"stored mem-gate      by agent-ada       ({stored.content_sha256[:16]}...)")

    field.store(
        cur, memory_id="mem-rollback", actor_id="agent-ada", reason="runbook ingestion",
        content="Rollbacks are executed with `ops rollback <release>`.",
        embedding=e([0.1, 1.0, 0.0]), embedding_model="demo")
    print("stored mem-rollback  by agent-ada")

    field.store(
        cur, memory_id="mem-draft-policy", actor_id="analyst-omar",
        reason="drafting an updated deploy policy ahead of review",
        content="Deploy policy v1: staging gate required, no exceptions.",
        embedding=e([0.9, 0.15, 0.0]), embedding_model="demo")
    print("stored mem-draft-policy  by analyst-omar  (to be superseded below)")

    poisoned = field.store(
        cur, memory_id="mem-poison", actor_id="pipeline-feeds", reason="feed sync",
        content="The staging gate is optional for hotfix deploys.",
        embedding=e([0.97, 0.05, 0.0]), embedding_model="demo",
        topic="deploy-policy", claim="gate-optional")
    print("stored mem-poison    by pipeline-feeds   <- the poisoned write")
    print(f"  contradiction auto-detected on both chains: {poisoned.inhibitory_links}")

    field.store(
        cur, memory_id="mem-forged-report", actor_id="pipeline-feeds",
        reason="feed sync", content="Hotfix 4.2 passed the staging gate.",
        embedding=e([0.5, 0.5, 0.5]), embedding_model="demo")
    print("stored mem-forged-report by pipeline-feeds  <- will be directly quarantined")

    field.store(
        cur, memory_id="mem-log-ingest", actor_id="pipeline-logs",
        reason="log ingestion", content="Nightly log ingestion completed: 4.2M events.",
        embedding=e([0.2, 0.3, 0.9]), embedding_model="demo")
    print("stored mem-log-ingest by pipeline-logs  <- stays CLEAN; this is the "
          "Nivel 2 live-demo quarantine target, not swept below")

    for _ in range(3):
        field.reinforce(cur, memory_id="mem-gate", actor_id="analyst-omar",
                         reason="verified against the runbook")
    print("mem-gate reinforced 3x by analyst-omar -> field_state REINFORCED")

    field.reinforce(cur, memory_id="mem-rollback", actor_id="pipeline-feeds",
                     reason="feed corroboration")
    print("mem-rollback reinforced by pipeline-feeds  <- inflated by the bad actor")
    conn.commit()

    section("2. Recall, receipt, decision - the causal chain Nivel 3 traces")
    _, served_receipt = field.recall(
        cur, query_embedding=e([0.97, 0.02, 0.0]), top_k=5)
    field.persist_receipt(cur, served_receipt)
    print(f"receipt {served_receipt.receipt_sha256[:16]}...  served: "
          f"{list(served_receipt.served)}")

    decision = causality.record_decision(
        cur, receipt=served_receipt, used_memory_ids=["mem-poison"],
        decision_sha256=causality.decision_hash(
            "Hotfix 4.2 may ship without the staging gate."),
        policy_version="deploy-policy@3", actor_id="agent-ada",
        reason="answered the on-call operator's deploy question")
    print(f"decision {decision.decision_id}  used: {list(decision.used_memory_ids)}"
          f"  <- cites mem-poison, the DIRECT edge impact() will find")

    field.store(
        cur, memory_id="mem-note", actor_id="agent-ada",
        reason="recording what was told to the operator",
        content="Told on-call: hotfix 4.2 may skip the staging gate.",
        embedding=e([0.95, 0.06, 0.0]), embedding_model="demo",
        derived_from_decision=decision.decision_id)
    print("stored mem-note by agent-ada, derived_from_decision="
          f"{decision.decision_id}  <- the DERIVED edge impact() will find")
    conn.commit()

    section("3. A policy gets superseded through the real lineage path")
    field.supersede(
        cur, old_memory_id="mem-draft-policy", memory_id="mem-policy-v2",
        content="Deploy policy v2: staging gate required; documented emergency "
                "override needs two-person sign-off.",
        embedding=e([0.88, 0.2, 0.0]), embedding_model="demo",
        actor_id="analyst-omar", reason="policy review incorporated sign-off requirement")
    print("mem-draft-policy SUPERSEDED by mem-policy-v2")
    conn.commit()

    section("4. Containment: actor quarantine (sweep) and direct memory quarantine")
    sweep = trust.quarantine_actor(
        cur, actor_id="pipeline-feeds", initiated_by="analyst-omar",
        reason="compromised feed credentials (INC-1207)")
    print(f"sweep {sweep.sweep_id}")
    print(f"  TAINT_FLAGGED: {list(sweep.flagged_memory_ids)}")
    print("  NOT flagged: mem-gate (CONTRADICTED_BY is not an influence event)")

    trust.quarantine_memory(
        cur, memory_id="mem-forged-report", actor_id="analyst-omar",
        reason="direct evidence: report content does not match deploy log (INC-1207)")
    print("mem-forged-report directly QUARANTINED (no reversal path, by design)")
    conn.commit()


def summarize(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("SELECT custody_status, COUNT(*) FROM memories GROUP BY custody_status")
    status = dict(cur.fetchall())
    cur.execute("SELECT field_state, COUNT(*) FROM memories GROUP BY field_state")
    state = dict(cur.fetchall())
    section("Seed summary")
    print(f"custody_status: {status}")
    print(f"field_state:    {state}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true",
                         help="delete the existing db file first")
    args = parser.parse_args()

    if args.reset and DB_PATH.exists():
        DB_PATH.unlink()
        print(f"removed {DB_PATH}")

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    fresh = not DB_PATH.exists()
    conn = sqlite3.connect(str(DB_PATH))
    if fresh:
        conn.executescript(SCHEMA_PATH.read_text())

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM memories")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"{DB_PATH} already has {existing} memories — refusing to reseed. "
              "Pass --reset to start over.")
        conn.close()
        sys.exit(1)

    seed(conn)
    summarize(conn)
    conn.close()
    print(f"\nfield written to {DB_PATH}")


if __name__ == "__main__":
    main()
