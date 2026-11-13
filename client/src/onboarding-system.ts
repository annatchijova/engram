/**
 * ENGRAM — Guided First Contact.
 *
 * Shows the welcome card first, then walks the operator through one
 * investigation as a sequence of questions, each answered by a real
 * operation. Reacts only to OnboardingEvents, which fire only from an
 * existing server-confirmed success path, so the guide can never run
 * ahead of what MNEME actually returned. No timers: nothing here advances
 * on its own.
 *
 * Surfaces are revealed as they become relevant (revealedAt in the stage
 * machine); "Explore freely" reveals everything at once and "Restart the
 * investigation" returns to the first question. Both are operator
 * choices, never automatic. Hiding uses the display:none/flex idiom
 * already proven on every panel.
 */
import { createSystem, Object3D, UIKitMLAsset } from '@iwsdk/core';
import { AudioCues } from './observatory/audio-cues.js';
import { requireElement } from './observatory/wiring.js';
import { OnboardingEvents } from './onboarding-events.js';
import type { OnboardingEvent } from './onboarding-events.js';
import { OnboardingStage } from './onboarding-stage-component.js';
import {
  advanceStage,
  beginTour,
  exploreFreely,
  OnboardingStageValue,
  restartTour,
  revealedAt,
  stageAtLeast,
} from './onboarding-stage-machine.js';
import { TOUR, TOUR_TOTAL } from './tour-script.js';
import { TourState } from './tour-state.js';

const TRACE_LEGEND_IDS = [
  'trace-legend-heading',
  'trace-legend-section',
  'trace-legend-derived',
  'trace-legend-derived-unattested',
  'trace-legend-possible',
];

// Milestones are a second view of the same progress, plus the one thing
// the tour never requires: a real commit. They only ever tick from events.
const MILESTONES: { elementId: string; label: string; test: (stage: string, contained: boolean) => boolean }[] = [
  { elementId: 'checklist-select', label: 'Found it', test: (s) => stageAtLeast(s, OnboardingStageValue.ORIGIN) },
  { elementId: 'checklist-trace', label: 'Traced it', test: (s) => stageAtLeast(s, OnboardingStageValue.CONSEQUENCES) },
  { elementId: 'checklist-containment', label: 'Contained it (real commit, optional)', test: (_s, c) => c },
  { elementId: 'checklist-verify', label: 'Verified it', test: (s) => stageAtLeast(s, OnboardingStageValue.COMPLETE) },
];

export class OnboardingSystem extends createSystem({}) {
  private stage: string = OnboardingStageValue.WELCOME;
  private contained = false;

  init(): void {
    const entity = this.world.createTransformEntity(new Object3D());
    entity.addComponent(OnboardingStage);

    const welcome = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
    const guide = this.world.getSceneObject<UIKitMLAsset>('next-step-panel');
    const beginBtn = requireElement(welcome, 'welcome-panel', 'welcome-begin');
    const exploreBtn = requireElement(welcome, 'welcome-panel', 'welcome-explore');
    const skipBtn = requireElement(guide, 'next-step-panel', 'next-step-skip');
    const restartBtn = requireElement(guide, 'next-step-panel', 'guide-restart');

    const applyStage = (stage: string) => {
      this.stage = stage;
      entity.setValue(OnboardingStage, 'stage', stage);
      TourState.set(stage);
      this.applyGuideCard(guide, stage);
      this.applyVisibility(welcome, guide, stage);
      this.applyMilestones(guide, stage);
    };

    applyStage(OnboardingStageValue.WELCOME);

    const onEvent = (event: OnboardingEvent) => {
      if (event === 'commit-done') {
        this.contained = true;
        this.applyMilestones(guide, this.stage);
      }
      const next = advanceStage(this.stage, event);
      if (next !== this.stage) {
        applyStage(next);
        AudioCues.play('open');
      }
    };
    this.cleanupFuncs.push(OnboardingEvents.subscribe(onEvent));

    const onBegin = () => applyStage(beginTour(this.stage));
    const onExplore = () => applyStage(exploreFreely());
    const onRestart = () => applyStage(restartTour());
    beginBtn?.addEventListener('click', onBegin);
    exploreBtn?.addEventListener('click', onExplore);
    skipBtn?.addEventListener('click', onExplore);
    restartBtn?.addEventListener('click', onRestart);
    this.cleanupFuncs.push(
      () => beginBtn?.removeEventListener('click', onBegin),
      () => exploreBtn?.removeEventListener('click', onExplore),
      () => skipBtn?.removeEventListener('click', onExplore),
      () => restartBtn?.removeEventListener('click', onRestart),
    );
  }

  private applyGuideCard(guide: UIKitMLAsset | undefined, stage: string): void {
    const step = TOUR[stage];
    if (!guide || !step) return;
    const done = stage === OnboardingStageValue.COMPLETE;
    guide.getElementById('guide-eyebrow')?.setProperties({
      text: done ? 'INVESTIGATION - COMPLETE' : `INVESTIGATION - STEP ${step.index} OF ${TOUR_TOTAL}`,
    });
    guide.getElementById('guide-question')?.setProperties({ text: step.question });
    guide.getElementById('next-step-text')?.setProperties({ text: step.body });
    guide.getElementById('guide-action')?.setProperties({ text: done ? '' : `Next: ${step.action}` });
    const filled = done ? TOUR_TOTAL : step.index - 1;
    guide.getElementById('guide-progress')?.setProperties({
      text: Array.from({ length: TOUR_TOTAL }, (_, i) => (i < filled ? '●' : '○')).join(' '),
    });
    guide.getElementById('next-step-skip')?.setProperties({ display: done ? 'none' : 'flex' });
  }

  private applyVisibility(welcome: UIKitMLAsset | undefined, guide: UIKitMLAsset | undefined, stage: string): void {
    const r = revealedAt(stage);
    const show = (asset: UIKitMLAsset | undefined, rootId: string, visible: boolean) =>
      asset?.getElementById(rootId)?.setProperties({ display: visible ? 'flex' : 'none' });
    show(welcome, 'welcome-root', r.welcome);
    show(guide, 'next-step-root', r.guide);
    const legend = this.world.getSceneObject<UIKitMLAsset>('legend-panel');
    show(legend, 'legend-root', r.legend);
    for (const id of TRACE_LEGEND_IDS) {
      legend?.getElementById(id)?.setProperties({ display: r.traceLegend ? 'flex' : 'none' });
    }
    show(this.world.getSceneObject<UIKitMLAsset>('login-panel'), 'login-root', r.login);
    show(this.world.getSceneObject<UIKitMLAsset>('containment-panel'), 'containment-root', r.containment);
    show(this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel'), 'counterfactual-root', r.counterfactual);
    show(this.world.getSceneObject<UIKitMLAsset>('portable-panel'), 'portable-root', r.portable);
  }

  private applyMilestones(guide: UIKitMLAsset | undefined, stage: string): void {
    const visible = stage !== OnboardingStageValue.WELCOME;
    for (const m of MILESTONES) {
      const done = m.test(stage, this.contained);
      guide?.getElementById(m.elementId)?.setProperties({
        text: done ? `[x] ${m.label}` : `[ ] ${m.label}`,
        color: done ? '#7fd4a8' : '#4a5a68',
        display: visible ? 'flex' : 'none',
      });
    }
  }
}
