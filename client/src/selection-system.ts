/**
 * ENGRAM — selecting a memory core opens the spatial inspector with its
 * real record and publishes that record for the provenance structure.
 * Read-only: nothing here ever writes back to the adapter. Hand-ray/pinch
 * in XR and mouse-click on desktop both land as `Pressed`
 * (canvasPointerEvents, set in iwsdk.config.json, is the desktop fallback —
 * emulated input, not a Quest hand-tracking claim).
 *
 * Three distinct, labeled states ride on the core itself while this runs:
 * LOADING (request in flight), FAILED (the fetch did not return), and
 * cleared (the record is on screen). Both use a neutral instrument grey
 * that appears in no custody map, so a failed read can never be mistaken
 * for a custody status.
 */
import { createSystem, Pressed, UIKitMLAsset } from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { MemoryNode } from './memory-node-component.js';
import { AudioCues } from './observatory/audio-cues.js';
import { OnboardingEvents } from './onboarding-events.js';
import { SelectedMemory } from './selected-memory.js';

export class SelectionSystem extends createSystem({
  selected: { required: [MemoryNode, Pressed] },
}) {
  private busy = false;

  init(): void {
    this.queries.selected.subscribe('qualify', (entity) => {
      const memoryId = entity.getValue(MemoryNode, 'memoryId') as string;
      void this.showDetail(memoryId);
    });

    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    const close = panel?.getElementById('detail-close');
    const hide = () => {
      panel?.getElementById('detail-root')?.setProperties({ display: 'none' });
      SelectedMemory.set(null);
    };
    close?.addEventListener('click', hide);
    this.cleanupFuncs.push(() => close?.removeEventListener('click', hide));
  }

  private async showDetail(memoryId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    SelectedMemory.set(memoryId);
    AudioCues.play('select');
    const field = this.world.getSystem(FieldSystem);
    field?.setCoreState(memoryId, 'loading');
    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    try {
      const [memory, custody] = await Promise.all([
        EngramApi.getMemory(memoryId),
        EngramApi.getCustody(memoryId),
      ]);
      // The selection may have moved on while the fetch was in flight.
      if (SelectedMemory.get() !== memoryId) {
        field?.setCoreState(memoryId, 'idle');
        return;
      }

      const chainText = custody.entries
        .map((e) => `#${e.seq} ${e.event_type} - ${e.actor_id}\n  "${e.reason}"\n  ${e.entry_hash.slice(0, 16)}...`)
        .join('\n\n');

      panel?.getElementById('detail-title')?.setProperties({
        text: `${memory.memory_id} - ${memory.custody_status}`,
      });
      panel?.getElementById('detail-content')?.setProperties({ text: memory.content });
      panel?.getElementById('detail-hash')?.setProperties({
        text: `sha256 ${memory.content_sha256}`,
      });
      panel?.getElementById('detail-confidence')?.setProperties({
        text: `confidence (exact) ${memory.confidence} / field_state ${memory.field_state} / by ${memory.created_by}` +
          (memory.superseded_by ? ` / superseded_by ${memory.superseded_by}` : ''),
      });
      panel?.getElementById('detail-chain')?.setProperties({
        text: `custody chain (${custody.chain_length} events):\n\n${chainText}`,
      });
      panel?.getElementById('detail-root')?.setProperties({ display: 'flex' });
      field?.setCoreState(memoryId, 'idle');
      SelectedMemory.setRecord(custody, memory);
      AudioCues.play('open');
      OnboardingEvents.emit('detail-shown');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ENGRAM] failed to load memory detail:', err);
      field?.setCoreState(memoryId, 'failed');
      AudioCues.play('failure');
      panel?.getElementById('detail-title')?.setProperties({
        text: `FAILED to load ${memoryId}`,
      });
      panel?.getElementById('detail-content')?.setProperties({
        text: String((err as Error).message ?? err),
      });
      panel?.getElementById('detail-root')?.setProperties({ display: 'flex' });
    } finally {
      this.busy = false;
    }
  }
}
