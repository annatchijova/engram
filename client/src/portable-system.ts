/**
 * ENGRAM — Nivel 5, first slice: bundle export + INDEPENDENT offline
 * verification. The server runs mneme/verify_offline.py as a genuinely
 * separate subprocess against the exported bundle (see server/app.py's
 * export_bundle endpoint) — this panel only ever shows what that
 * subprocess actually printed, never a synthesized "looks fine."
 *
 * In the lab, a successful export materializes a sealed bundle artifact
 * on the evidence vault pedestal. Its color is the verifier's own verdict
 * (VERIFIED / REJECTED / anything else = unavailable), its label the real
 * bundle sha256 prefix and memory count.
 */
import {
  BoxGeometry,
  Color,
  createSystem,
  EdgesGeometry,
  Entity,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  Sprite,
  UIKitMLAsset,
} from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';
import { AudioCues } from './observatory/audio-cues.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { OnboardingEvents } from './onboarding-events.js';

const VERDICT_COLOR: Record<string, string> = {
  VERIFIED: OBS.vault,
  REJECTED: '#c13030',
};
const UNAVAILABLE_COLOR = '#e0a62b';
const BUNDLE_GEO = new BoxGeometry(0.17, 0.17, 0.17);
const BUNDLE_EDGES = new EdgesGeometry(BUNDLE_GEO);

export class PortableSystem extends createSystem({}) {
  private lastBundleJson: string | null = null;
  private artifactEntity: Entity | null = null;
  private artifact: Group | null = null;
  private label: Sprite | null = null;
  private material = new MeshPhysicalMaterial({
    color: new Color(OBS.vault), emissive: new Color(OBS.vault), emissiveIntensity: 0.5,
    transparent: true, opacity: 0.55, roughness: 0.15, clearcoat: 1,
  });
  private edgeMaterial = new LineBasicMaterial({ color: new Color('#ffffff'), transparent: true, opacity: 0.6 });
  private glowTarget = 0.35;

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
              `${bundle.memory_count} memories / bundle ` +
              `${bundle.bundle_sha256.slice(0, 16)}...\n` +
              `verifier (independent subprocess): ${bundle.verifier.status}` +
              `${bundle.verifier.exit_code === null ? '' : ` exit ${bundle.verifier.exit_code}`}\n` +
              bundle.verifier.output_lines.slice(0, 4).join('\n'),
          });
          this.showArtifact(bundle.bundle_sha256, bundle.memory_count, bundle.verifier.status, bundle.verifier.exit_code);
          AudioCues.play(bundle.verifier.status === 'VERIFIED' ? 'verify' : 'failure');
          OnboardingEvents.emit('bundle-verified');
        } catch (err) {
          AudioCues.play('failure');
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

  update(delta: number, time: number): void {
    const h = ObservatoryScene.get();
    if (h) {
      const k = 1 - Math.exp(-delta * 4);
      h.vaultRing.emissiveIntensity += (this.glowTarget - h.vaultRing.emissiveIntensity) * k;
      h.vaultLight.intensity += ((this.glowTarget > 0.5 ? 2.2 : 0.5) - h.vaultLight.intensity) * k;
    }
    if (this.artifact) {
      this.artifact.rotation.y += delta * 0.5;
      this.artifact.position.y = OBSERVATORY.vault.y + 1.1 + Math.sin(time * 1.2) * 0.015;
    }
  }

  private showArtifact(sha: string, count: number, status: string, exitCode: number | null): void {
    if (this.label) disposeLabel(this.label);
    this.artifactEntity?.dispose();
    const hex = VERDICT_COLOR[status] ?? UNAVAILABLE_COLOR;
    this.material.color.set(hex);
    this.material.emissive.set(hex);
    const group = new Group();
    group.add(new Mesh(BUNDLE_GEO, this.material));
    group.add(new LineSegments(BUNDLE_EDGES, this.edgeMaterial));
    const label = makeLabel(
      [
        { text: `bundle ${sha.slice(0, 16)}…`, color: '#f2f6fa', size: 40, weight: '700' },
        { text: `${count} memories · verifier ${status}${exitCode === null ? '' : ` (exit ${exitCode})`}`, color: hex, size: 34, weight: '600' },
        { text: 'checked by a separate program, not the one that made it', color: '#9fb3c8', size: 26 },
      ],
      { width: 0.66, background: '#0a1a14f7', border: `${hex}aa` },
    );
    label.position.y = 0.26;
    group.add(label);
    this.label = label;
    const v = OBSERVATORY.vault;
    group.position.set(v.x, v.y + 1.1, v.z);
    this.artifact = group;
    this.artifactEntity = this.world.createTransformEntity(group);
    this.glowTarget = status === 'VERIFIED' ? 1.4 : 0.9;
  }
}
