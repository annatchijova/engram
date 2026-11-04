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
import { OnboardingStage, OnboardingStageValue } from './onboarding-stage-component.js';

const STAGE_ORDER = [
  OnboardingStageValue.WELCOME,
  OnboardingStageValue.SELECT_DONE,
  OnboardingStageValue.TRACE_DONE,
  OnboardingStageValue.CONTAINMENT_DONE,
  OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  OnboardingStageValue.PORTABLE_UNLOCKED,
  OnboardingStageValue.COMPLETE,
] as const;

const NEXT_STEP_TEXT: Record<string, string> = {
  [OnboardingStageValue.WELCOME]: 'These spheres are real memories. Point and select one.',
  [OnboardingStageValue.SELECT_DONE]:
    "This is one memory's real custody record. Try 'Trace impact'.",
  [OnboardingStageValue.TRACE_DONE]:
    'You just saw what this memory actually touches. Now try staging a real quarantine.',
  [OnboardingStageValue.CONTAINMENT_DONE]:
    'You just changed the real field. Compare it against a hypothetical one.',
  [OnboardingStageValue.COUNTERFACTUAL_UNLOCKED]:
    "Now export what you've seen as a portable, independently-verifiable record.",
  [OnboardingStageValue.PORTABLE_UNLOCKED]:
    "Now export what you've seen as a portable, independently-verifiable record.",
  [OnboardingStageValue.COMPLETE]:
    "You've completed the full loop. Everything here is still live - explore freely.",
};

// Event -> the stage it proves was reached. 'stage-done' (a preview, not a
// mutation) is recorded in the events log but does not advance onboarding —
// only a real commit (commit-done) counts as containment being proven.
const EVENT_STAGE: Partial<Record<string, string>> = {
  'detail-shown': OnboardingStageValue.SELECT_DONE,
  'trace-run': OnboardingStageValue.TRACE_DONE,
  'commit-done': OnboardingStageValue.CONTAINMENT_DONE,
  'exclusion-run': OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  'containment-cf-run': OnboardingStageValue.COUNTERFACTUAL_UNLOCKED,
  'bundle-verified': OnboardingStageValue.COMPLETE,
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

    const onEvent = (event: string) => {
      const target = EVENT_STAGE[event];
      if (!target) return;
      if (STAGE_ORDER.indexOf(target as never) > STAGE_ORDER.indexOf(this.stage as never)) {
        applyStage(target);
      }
    };
    this.cleanupFuncs.push(OnboardingEvents.subscribe(onEvent));

    const onSkip = () => applyStage(OnboardingStageValue.COMPLETE);
    skipBtn?.addEventListener('click', onSkip);
    this.cleanupFuncs.push(() => skipBtn?.removeEventListener('click', onSkip));
  }

  private applyVisibility(stage: string): void {
    const idx = STAGE_ORDER.indexOf(stage as never);
    const atLeast = (s: string) => idx >= STAGE_ORDER.indexOf(s as never);

    const legend = this.world.getSceneObject<UIKitMLAsset>('legend-panel');
    const containment = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    const counterfactual = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    const portable = this.world.getSceneObject<UIKitMLAsset>('portable-panel');

    const traceRevealed = atLeast(OnboardingStageValue.TRACE_DONE);
    for (const id of TRACE_LEGEND_IDS) {
      legend?.getElementById(id)?.setProperties({ display: traceRevealed ? 'flex' : 'none' });
    }
    containment?.getElementById('containment-root')?.setProperties({
      display: traceRevealed ? 'flex' : 'none',
    });
    counterfactual?.getElementById('counterfactual-root')?.setProperties({
      display: atLeast(OnboardingStageValue.CONTAINMENT_DONE) ? 'flex' : 'none',
    });
    portable?.getElementById('portable-root')?.setProperties({
      display: atLeast(OnboardingStageValue.COUNTERFACTUAL_UNLOCKED) ? 'flex' : 'none',
    });
  }

  private applyChecklist(panel: UIKitMLAsset | undefined, stage: string): void {
    const idx = STAGE_ORDER.indexOf(stage as never);
    for (const row of CHECKLIST) {
      const done = idx >= STAGE_ORDER.indexOf(row.threshold as never);
      panel?.getElementById(row.elementId)?.setProperties({
        text: done ? `[x] ${row.label}` : `[ ] ${row.label}`,
        color: done ? '#7fd4a8' : '#4a5a68',
      });
    }
  }
}
