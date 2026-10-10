/**
 * ENGRAM — selecting a memory node opens the detail panel with its real
 * custody chain. Read-only: nothing here ever writes back to the adapter.
 * Hand-ray/pinch in XR and mouse-click on desktop both land as `Pressed`
 * (canvasPointerEvents, set in iwsdk.config.json, is the desktop fallback —
 * it is emulated input, not a Quest hand-tracking claim).
 */
import { createSystem, Pressed, UIKitMLAsset } from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { MemoryNode } from './memory-node-component.js';

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
    const hide = () => panel?.getElementById('detail-root')?.setProperties({ display: 'none' });
    close?.addEventListener('click', hide);
    this.cleanupFuncs.push(() => close?.removeEventListener('click', hide));
  }

  private async showDetail(memoryId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    try {
      const [memory, custody] = await Promise.all([
        EngramApi.getMemory(memoryId),
        EngramApi.getCustody(memoryId),
      ]);

      const chainText = custody.entries
        .map((e) => `#${e.seq} ${e.event_type} — ${e.actor_id}\n  "${e.reason}"\n  ${e.entry_hash.slice(0, 16)}...`)
        .join('\n\n');

      panel?.getElementById('detail-title')?.setProperties({
        text: `${memory.memory_id} — ${memory.custody_status}`,
      });
      panel?.getElementById('detail-content')?.setProperties({ text: memory.content });
      panel?.getElementById('detail-hash')?.setProperties({
        text: `sha256 ${memory.content_sha256}`,
      });
      panel?.getElementById('detail-confidence')?.setProperties({
        text: `confidence (exact) ${memory.confidence} · field_state ${memory.field_state}`,
      });
      panel?.getElementById('detail-chain')?.setProperties({
        text: `custody chain (${custody.chain_length} events):\n\n${chainText}`,
      });
      panel?.getElementById('detail-root')?.setProperties({ display: 'flex' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ENGRAM] failed to load memory detail:', err);
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
