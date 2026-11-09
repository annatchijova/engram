/**
 * ENGRAM — Nivel 6 Guided First Contact.
 *
 * Gates the existing five panels behind real, server-confirmed milestones
 * instead of showing all of them at once from frame one. Reacts only to
 * OnboardingEvents, which only fire from an existing success path in the
 * five Niveles' own systems (see onboarding-events.ts) — this system never
 * alters a decision path, never invents a causal relation, and never shows
 * a panel before the server actually confirmed the step it gates. Hiding
 * uses the exact display:none/flex idiom already proven on detail-root.
 *
 * Escape hatch: gating is monotonic by design (a stage is never un-reached),
 * but a jury member who skips a step must still be able to reach every
 * panel — "Show everything" on the next-step panel force-jumps to COMPLETE.
 * Without it, a missed click (e.g. selecting a memory that happens to fail
 * to load) could permanently hide containment/counterfactual/portable for
 * that session, which would make Nivel 2-5 untestable. The button is the
 * only way out, deliberately not automatic (a timeout would reveal panels
 * the operator never asked for, which is the same "gesture decides state"
 * problem the architecture doc forbids elsewhere, just applied to UI reveal
 * instead of a MNEME mutation).
 */
import { createSystem, Object3D, UIKitMLAsset } from '@iwsdk/core';
import { OnboardingEvents } from './onboarding-events.js';
import type { OnboardingEvent } from './onboarding-events.js';
import { OnboardingStage } from './onboarding-stage-component.js';
import {
  advanceStage,
  counterfactualRevealed,
  OnboardingStageValue,
  stageAtLeast,
} from './onboarding-stage-machine.js';

const NEXT_STEP_TEXT: Record<string, string> = {
  [OnboardingStageValue.WELCOME]: 'ACT I — Discovery. These slabs are real memories. A memory was trusted; should it have been? Point and select the suspicious one.',
  [OnboardingStageValue.SELECT_DONE]:
    "ACT II — Provenance. This is the record's real custody history. Try 'Trace impact'.",
  [OnboardingStageValue.TRACE_DONE]:
    'ACT III — Impact. You saw what this memory actually touches; possible links are not proof. Now stage a containment preview (nothing commits yet).',
  [OnboardingStageValue.PREVIEW_DONE]:
    'ACT IV — Counterfactual. The preview is staged, nothing was committed. Compare the recorded field against a sealed hypothetical that was never executed.',
  [OnboardingStageValue.CONTAINMENT_DONE]:
    'ACT IV — Counterfactual. Compare the recorded field against a sealed hypothetical that was never executed.',
  [OnboardingStageValue.COUNTERFACTUAL_UNLOCKED]:
    "Now export what you've seen as a portable, independently-verifiable record.",
  [OnboardingStageValue.PORTABLE_UNLOCKED]:
    "Now export what you've seen as a portable, independently-verifiable record.",
  [OnboardingStageValue.COMPLETE]:
    "You've completed the full loop. Everything here is still live - explore freely.",
};

const TRACE_LEGEND_IDS = [
  'trace-legend-heading',
  'trace-legend-section',
  'trace-legend-derived',
  'trace-legend-derived-unattested',
  'trace-legend-possible',
];

// Four rows of the SAME OnboardingStage data already driving the "NEXT"
// instruction and the panel gating above — no new state, just a second
// view of it, framed as the case's progress instead of a single next step.
const CHECKLIST: { elementId: string; label: string; threshold: string }[] = [
  { elementId: 'checklist-select', label: 'Found it', threshold: OnboardingStageValue.SELECT_DONE },
  { elementId: 'checklist-trace', label: 'Traced it', threshold: OnboardingStageValue.TRACE_DONE },
  { elementId: 'checklist-containment', label: 'Contained it', threshold: OnboardingStageValue.CONTAINMENT_DONE },
  { elementId: 'checklist-verify', label: 'Verified it', threshold: OnboardingStageValue.COMPLETE },
];

export class OnboardingSystem extends createSystem({}) {
  private stage: string = OnboardingStageValue.WELCOME;

  init(): void {
    const entity = this.world.createTransformEntity(new Object3D());
    entity.addComponent(OnboardingStage);

    const nextStepPanel = this.world.getSceneObject<UIKitMLAsset>('next-step-panel');
    const nextStepText = nextStepPanel?.getElementById('next-step-text');
    const skipBtn = nextStepPanel?.getElementById('next-step-skip');

    const applyStage = (stage: string) => {
      this.stage = stage;
      entity.setValue(OnboardingStage, 'stage', stage);
      nextStepText?.setProperties({ text: NEXT_STEP_TEXT[stage] ?? '' });
      this.applyVisibility(stage);
      this.applyChecklist(nextStepPanel, stage);
    };

    applyStage(OnboardingStageValue.WELCOME);

    const onEvent = (event: OnboardingEvent) => {
      const next = advanceStage(this.stage, event);
      if (next !== this.stage) applyStage(next);
    };
    this.cleanupFuncs.push(OnboardingEvents.subscribe(onEvent));

    const onSkip = () => applyStage(OnboardingStageValue.COMPLETE);
    skipBtn?.addEventListener('click', onSkip);
    this.cleanupFuncs.push(() => skipBtn?.removeEventListener('click', onSkip));
  }

  private applyVisibility(stage: string): void {
    const legend = this.world.getSceneObject<UIKitMLAsset>('legend-panel');
    const containment = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    const counterfactual = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    const portable = this.world.getSceneObject<UIKitMLAsset>('portable-panel');

    const traceRevealed = stageAtLeast(stage, OnboardingStageValue.TRACE_DONE);
    for (const id of TRACE_LEGEND_IDS) {
      legend?.getElementById(id)?.setProperties({ display: traceRevealed ? 'flex' : 'none' });
    }
    containment?.getElementById('containment-root')?.setProperties({
      display: traceRevealed ? 'flex' : 'none',
    });
    counterfactual?.getElementById('counterfactual-root')?.setProperties({
      display: counterfactualRevealed(stage) ? 'flex' : 'none',
    });
    portable?.getElementById('portable-root')?.setProperties({
      display: stageAtLeast(stage, OnboardingStageValue.COUNTERFACTUAL_UNLOCKED) ? 'flex' : 'none',
    });
  }

  private applyChecklist(panel: UIKitMLAsset | undefined, stage: string): void {
    for (const row of CHECKLIST) {
      const done = stageAtLeast(stage, row.threshold);
      panel?.getElementById(row.elementId)?.setProperties({
        text: done ? `[x] ${row.label}` : `[ ] ${row.label}`,
        color: done ? '#7fd4a8' : '#4a5a68',
      });
    }
  }
}
