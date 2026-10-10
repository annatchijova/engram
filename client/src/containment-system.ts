/**
 * ENGRAM — Nivel 2 Audited Containment.
 *
 * Stage -> Commit, never collapsed into one gesture (see
 * ENGRAM-ARCHITECTURAL-INVESTIGATION.md §4): Stage only calls the
 * read-only preview endpoint; Commit is a separate, explicit click that
 * calls the one mutating endpoint in the whole system
 * (POST /api/v1/actors/{id}/quarantine). Cancel never touches the server.
 *
 * Scope cut, stated rather than hidden: this console targets a single
 * known actor (pipeline-logs) rather than a dynamic list — UIKitML's
 * dynamic child-list support wasn't confirmed in Nivel 1, and one real,
 * fully-wired target beats a speculative generic list for this slice.
 */
import { createSystem, UIKitMLAsset } from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { SessionStore } from './session.js';

const TARGET_ACTOR_ID = 'pipeline-logs';

export class ContainmentSystem extends createSystem({}) {
  private stagedCount = 0;
  // Nivel 5 — captured at Stage time, sent back at Commit, so the server
  // can reject a Commit staged against a field that has since moved
  // (stale-snapshot precondition) rather than blindly applying it.
  private stagedFieldVersion = 0;

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    if (!panel) return;

    const hint = panel.getElementById('containment-hint');
    const stageBtn = panel.getElementById('stage-btn');
    const commitBtn = panel.getElementById('commit-btn');
    const cancelBtn = panel.getElementById('cancel-btn');
    const previewSection = panel.getElementById('preview-section');
    const previewText = panel.getElementById('preview-text');
    const resultText = panel.getElementById('result-text');

    const updateHint = () => {
      const session = SessionStore.get();
      hint?.setProperties({
        text: session
          ? `logged in as ${session.displayName} (${session.effectiveCapabilities.join(', ')})`
          : 'log in (top-right) to stage a quarantine',
      });
    };
    updateHint();
    this.cleanupFuncs.push(SessionStore.subscribe(updateHint));

    const onStage = () => {
      void (async () => {
        const session = SessionStore.get();
        if (!session) {
          previewText?.setProperties({ text: 'log in first — see the panel top-right.' });
          previewSection?.setProperties({ display: 'flex' });
          return;
        }
        try {
          const preview = await EngramApi.previewQuarantine(TARGET_ACTOR_ID);
          this.stagedCount = preview.count;
          this.stagedFieldVersion = preview.field_version;
          if (preview.already_quarantined) {
            previewText?.setProperties({
              text: `${TARGET_ACTOR_ID} is already QUARANTINED — nothing to stage.`,
            });
          } else {
            previewText?.setProperties({
              text: `This will QUARANTINE ${TARGET_ACTOR_ID} and TAINT_FLAG ` +
                `${preview.count} ${preview.count === 1 ? 'memory' : 'memories'}: ` +
                `${preview.would_flag_memory_ids.join(', ')}. Flagged memories remain ` +
                `rehabilitatable in MNEME later, but this build cannot rehabilitate them.`,
            });
          }
          resultText?.setProperties({ text: '' });
          previewSection?.setProperties({ display: 'flex' });
        } catch (err) {
          previewText?.setProperties({ text: `FAILED to preview: ${(err as Error).message}` });
          previewSection?.setProperties({ display: 'flex' });
        }
      })();
    };

    const onCommit = () => {
      void (async () => {
        const session = SessionStore.get();
        if (!session || this.stagedCount === 0) return;
        try {
          const result = await EngramApi.commitQuarantine(
            TARGET_ACTOR_ID,
            session.sessionToken,
            'INC-hackathon containment demo',
            crypto.randomUUID(),
            this.stagedFieldVersion,
          );
          resultText?.setProperties({
            text: `committed: sweep ${result.sweep_id} flagged ` +
              `${result.flagged_count} memories.`,
          });
          const field = this.world.getSystem(FieldSystem);
          await field?.refresh();
        } catch (err) {
          resultText?.setProperties({ text: `FAILED to commit: ${(err as Error).message}` });
        }
      })();
    };

    const onCancel = () => {
      previewSection?.setProperties({ display: 'none' });
      resultText?.setProperties({ text: '' });
      this.stagedCount = 0;
    };

    stageBtn?.addEventListener('click', onStage);
    commitBtn?.addEventListener('click', onCommit);
    cancelBtn?.addEventListener('click', onCancel);
    this.cleanupFuncs.push(
      () => stageBtn?.removeEventListener('click', onStage),
      () => commitBtn?.removeEventListener('click', onCommit),
      () => cancelBtn?.removeEventListener('click', onCancel),
    );
  }
}
