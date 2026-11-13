/**
 * ENGRAM XR — Guided First Contact: stage machine and tour script tests
 * (node --test, no deps).
 *
 * Invariants pinned: the welcome card is the initial state and only an
 * operator choice leaves it; progress depends on server-confirmed events
 * only (there are no timers to test because none exist, and unknown or
 * failure paths emit nothing); surfaces appear when they become relevant;
 * the whole tour completes without a commit; "Explore freely" reveals
 * everything; "Restart" is the only backwards move and is explicit.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceStage,
  beginTour,
  counterfactualRevealed,
  exploreFreely,
  OnboardingStageValue as S,
  restartTour,
  revealedAt,
  STAGE_ORDER,
  stageAtLeast,
} from '../src/onboarding-stage-machine.ts';
import { CUSTODY_GLOSS, TOUR, TOUR_TOTAL } from '../src/tour-script.ts';

const run = (start, events) => events.reduce((stage, e) => advanceStage(stage, e), start);
const FULL_TOUR = ['detail-shown', 'trace-run', 'exclusion-run', 'stage-done', 'bundle-verified'];

test('T1. the welcome card is first, and no event can leave it: only Begin or Explore', () => {
  assert.equal(STAGE_ORDER[0], S.WELCOME);
  assert.equal(revealedAt(S.WELCOME).welcome, true);
  assert.equal(revealedAt(S.WELCOME).guide, false);
  assert.equal(run(S.WELCOME, FULL_TOUR), S.WELCOME, 'events must not advance past the welcome card');
  assert.equal(beginTour(S.WELCOME), S.DISCOVER);
  assert.equal(exploreFreely(), S.COMPLETE);
});

test('T2. the full investigation completes on real events alone, with no commit', () => {
  assert.equal(run(S.DISCOVER, FULL_TOUR), S.COMPLETE);
  assert.ok(!FULL_TOUR.includes('commit-done'));
  // A commit never gates a stage.
  assert.equal(advanceStage(S.ORIGIN, 'commit-done'), S.ORIGIN);
});

test('T3. each question is answered by exactly its operation, in order', () => {
  let stage = S.DISCOVER;
  stage = advanceStage(stage, 'trace-run'); assert.equal(stage, S.CONSEQUENCES, 'a later event may skip ahead (it still proves its stage)');
  stage = S.DISCOVER;
  stage = advanceStage(stage, 'detail-shown'); assert.equal(stage, S.ORIGIN);
  stage = advanceStage(stage, 'trace-run'); assert.equal(stage, S.CONSEQUENCES);
  stage = advanceStage(stage, 'containment-cf-run'); assert.equal(stage, S.ALTERNATIVES);
  stage = advanceStage(stage, 'stage-done'); assert.equal(stage, S.INTERVENTION);
  stage = advanceStage(stage, 'bundle-verified'); assert.equal(stage, S.COMPLETE);
});

test('T4. events are monotonic and unknown events change nothing', () => {
  const stage = run(S.DISCOVER, ['detail-shown', 'trace-run', 'exclusion-run']);
  assert.equal(stage, S.ALTERNATIVES);
  assert.equal(advanceStage(stage, 'detail-shown'), S.ALTERNATIVES);
  assert.equal(advanceStage(stage, 'trace-run'), S.ALTERNATIVES);
  assert.equal(advanceStage(stage, 'not-an-event'), S.ALTERNATIVES);
});

test('T5. surfaces are revealed when they become relevant, never all at once', () => {
  const d = revealedAt(S.DISCOVER);
  assert.equal(d.legend, true);
  assert.equal(d.counterfactual, false);
  assert.equal(d.containment, false);
  assert.equal(d.login, false);
  assert.equal(d.portable, false);
  assert.equal(d.traceLegend, false);
  const c = revealedAt(S.CONSEQUENCES);
  assert.equal(c.traceLegend, true, 'edge classes are explained once edges exist');
  assert.equal(c.counterfactual, true, 'the chamber opens once the impact is known');
  assert.equal(c.containment, false, 'intervention waits until the comparison was seen');
  const a = revealedAt(S.ALTERNATIVES);
  assert.equal(a.containment, true);
  assert.equal(a.login, true, 'the session prompt appears with the first action that needs authority');
  assert.equal(a.portable, false);
  assert.equal(revealedAt(S.INTERVENTION).portable, true);
  assert.equal(counterfactualRevealed(S.ORIGIN), false);
});

test('T6. Explore freely reveals everything; Restart is explicit and returns to the first question', () => {
  const all = revealedAt(exploreFreely());
  for (const [k, v] of Object.entries(all)) {
    if (k === 'welcome') assert.equal(v, false); else assert.equal(v, true, k);
  }
  assert.equal(restartTour(), S.DISCOVER);
  // and the restarted tour still needs real events to move again
  assert.equal(advanceStage(restartTour(), 'bundle-verified'), S.COMPLETE);
  assert.equal(stageAtLeast(S.DISCOVER, S.ORIGIN), false);
});

test('T7. the script covers every stage after welcome, each with a question, an action and a target', () => {
  for (const stage of STAGE_ORDER.slice(1)) {
    const step = TOUR[stage];
    assert.ok(step, `no script for ${stage}`);
    assert.ok(step.question.endsWith('?') || stage === S.COMPLETE);
    assert.ok(step.body.length > 80, `${stage}: explanation too thin`);
    assert.ok(step.action.length > 5);
    assert.ok(step.index >= 1 && step.index <= TOUR_TOTAL);
  }
  assert.equal(TOUR[S.DISCOVER].target.memoryId, 'mem-poison');
  assert.equal(TOUR[S.COMPLETE].target.kind, 'none');
});

test('T8. plain-language glosses cover MNEME\'s four custody states and never claim falsity', () => {
  assert.deepEqual(Object.keys(CUSTODY_GLOSS).sort(), ['CLEAN', 'QUARANTINED', 'SUPERSEDED', 'TAINT_FLAGGED']);
  for (const text of [...Object.values(CUSTODY_GLOSS), ...Object.values(TOUR).map((t) => t.body)]) {
    assert.ok(!/\b(is false|untrue|fake|lie)\b/i.test(text), `overclaims falsity: ${text.slice(0, 60)}`);
  }
  // M4: nothing is deleted.
  assert.match(CUSTODY_GLOSS.SUPERSEDED, /not deleted|kept/);
  // POSSIBLE is contact, not a cause.
  assert.match(TOUR[S.CONSEQUENCES].body, /not a cause/);
  // The hypothetical world is never merged.
  assert.match(TOUR[S.ALTERNATIVES].body, /never merges/);
});
