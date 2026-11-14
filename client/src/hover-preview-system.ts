/**
 * ENGRAM — at-a-glance card content. Hovering a memory slab (hand-ray or
 * desktop mouse, same `Hovered` component either way) shows its real
 * memory_id, topic and content_preview — the exact fields MNEME already
 * returned for the arc, never a second fetch and never invented text.
 * Selecting (Pressed, see SelectionSystem) still opens the full record.
 */
import { createSystem, Hovered, UIKitMLAsset } from '@iwsdk/core';
import { MemoryNode } from './memory-node-component.js';
import { setPanelVisible } from './observatory/wiring.js';

export class HoverPreviewSystem extends createSystem({
  hovered: { required: [MemoryNode, Hovered] },
}) {
  private current: string | null = null;

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('preview-panel');
    // Closed until a hover: a hover card in the ray's path would block
    // the very cores it describes.
    setPanelVisible(panel, 'preview-root', false);

    this.queries.hovered.subscribe('qualify', (entity) => {
      const memoryId = entity.getValue(MemoryNode, 'memoryId') as string;
      this.current = memoryId;
      const topic = (entity.getValue(MemoryNode, 'topic') as string) || 'untitled';
      const preview = (entity.getValue(MemoryNode, 'contentPreview') as string) || '(no preview)';
      panel?.getElementById('preview-id')?.setProperties({ text: memoryId });
      panel?.getElementById('preview-topic')?.setProperties({ text: topic });
      panel?.getElementById('preview-excerpt')?.setProperties({ text: preview });
      setPanelVisible(panel, 'preview-root', true);
    });

    this.queries.hovered.subscribe('disqualify', (entity) => {
      const memoryId = entity.getValue(MemoryNode, 'memoryId') as string;
      // Only hide on the hover that is actually ending — a stray
      // disqualify for a slab that is not the currently shown one (e.g.
      // the pointer crossed two slabs in one frame) must not blank the
      // panel for the slab the pointer is now over.
      if (memoryId !== this.current) return;
      this.current = null;
      setPanelVisible(panel, 'preview-root', false);
    });
  }
}
