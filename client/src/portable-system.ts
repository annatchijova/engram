/**
 * ENGRAM — Nivel 5, first slice: bundle export + INDEPENDENT offline
 * verification. The server runs mneme/verify_offline.py as a genuinely
 * separate subprocess against the exported bundle (see server/app.py's
 * export_bundle endpoint) — this panel only ever shows what that
 * subprocess actually printed, never a synthesized "looks fine."
 */
import { createSystem, UIKitMLAsset } from '@iwsdk/core';
import { EngramApi } from './engram-api.js';

export class PortableSystem extends createSystem({}) {
  private lastBundleJson: string | null = null;

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('portable-panel');
    if (!panel) return;

    const exportBtn = panel.getElementById('pi-export');
    const downloadBtn = panel.getElementById('pi-download');
    const result = panel.getElementById('pi-result');

    const onExport = () => {
      void (async () => {
        result?.setProperties({ text: 'exporting and verifying...' });
        try {
          const bundle = await EngramApi.exportBundle();
          this.lastBundleJson = bundle.bundle_json;
          downloadBtn?.setProperties({ backgroundColor: '#2a6a4a', color: '#e8ffe8' });
          result?.setProperties({
            text:
              `${bundle.memory_count} memories  ·  bundle ` +
              `${bundle.bundle_sha256.slice(0, 16)}...\n` +
              `verifier (independent subprocess): ${bundle.verifier.status}` +
              `${bundle.verifier.exit_code === null ? '' : ` exit ${bundle.verifier.exit_code}`}\n` +
              bundle.verifier.output_lines.slice(0, 4).join('\n'),
          });
        } catch (err) {
          result?.setProperties({ text: `FAILED to export: ${(err as Error).message}` });
        }
      })();
    };

    const onDownload = () => {
      if (!this.lastBundleJson) {
        result?.setProperties({ text: 'export a bundle first.' });
        return;
      }
      // This is ENGRAM's own hosted page, not a sandboxed artifact
      // viewer, so a real browser file download is legitimate here.
      const blob = new Blob([this.lastBundleJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'engram-bundle.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    exportBtn?.addEventListener('click', onExport);
    downloadBtn?.addEventListener('click', onDownload);
    this.cleanupFuncs.push(
      () => exportBtn?.removeEventListener('click', onExport),
      () => downloadBtn?.removeEventListener('click', onDownload),
    );
  }
}
