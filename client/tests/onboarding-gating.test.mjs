/**
 * ENGRAM XR — guided-tour gating regression tests (node --test, no deps).
 *
 * The reported defect: the guided XR tour only revealed the
 * Counterfactual Chamber after 'commit-done', i.e. after a real
 * quarantine mutation. Investigating and comparing must not require
 * modifying authoritative state. The fix: a staged containment preview
 * ('stage-done') advances the tour to PREVIEW_DONE and reveals the
 * chamber, while the 'Contained it' checklist milestone still requires
 * the real commit.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceStage,
  counterfactualRevealed,
  OnboardingStageValue as S,
  stageAtLeast,
} from '../src/onboarding-stage-machine.ts';

const tour = (events) => events.reduce((stage, e) => advanceStage(stage, e), S.WELCOME);

test('guided tour reaches the counterfactual chamber from a staged preview, with no commit', () => {
  const stage = tour(['detail-shown', 'trace-run', 'stage-done']);
  assert.equal(stage, S.PREVIEW_DONE);
  assert.equal(counterfactualRevealed(stage), true);
});

test('a staged preview does not claim containment: the checklist milestone still requires commit-done', () => {
  const previewed = tour(['detail-shown', 'trace-run', 'stage-done']);
  assert.equal(stageAtLeast(previewed, S.CONTAINMENT_DONE), false);
  const committed = advanceStage(previewed, 'commit-done');
  assert.equal(committed, S.CONTAINMENT_DONE);
  assert.equal(stageAtLeast(committed, S.CONTAINMENT_DONE), true);
});

test('before the preview, the chamber stays hidden', () => {
  assert.equal(counterfactualRevealed(tour(['detail-shown', 'trace-run'])), false);
  assert.equal(counterfactualRevealed(S.WELCOME), false);
});

test('stages are monotonic: a late commit never drags the tour backwards', () => {
  const stage = tour(['detail-shown', 'trace-run', 'stage-done', 'exclusion-run']);
  assert.equal(stage, S.COUNTERFACTUAL_UNLOCKED);
  assert.equal(advanceStage(stage, 'commit-done'), S.COUNTERFACTUAL_UNLOCKED);
  assert.equal(advanceStage(stage, 'trace-run'), S.COUNTERFACTUAL_UNLOCKED);
});

test('the counterfactual run itself still unlocks the portable step, and verification completes the tour', () => {
  const stage = tour(['detail-shown', 'trace-run', 'stage-done', 'containment-cf-run', 'bundle-verified']);
  assert.equal(stage, S.COMPLETE);
});
