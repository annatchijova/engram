/**
 * ENGRAM Memory Lab — code-generated text labels.
 *
 * A label is a canvas-rendered texture on a Sprite, so every in-world name,
 * status and hash prefix is readable without any external art. Text content
 * always comes from MNEME responses; this module only typesets it.
 */
import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from '@iwsdk/core';

export type LabelLine = { text: string; color?: string; size?: number; weight?: string };

export type LabelOptions = {
  /** World width in meters of the sprite; height follows the canvas aspect. */
  width?: number;
  background?: string;
  border?: string;
  align?: 'left' | 'center';
  padding?: number;
  /** Render the sprite on top of depth-tested geometry (hovering badges). */
  depthTest?: boolean;
};

const PX_PER_M = 1400;
const BASE_FONT = 'Inter, "Segoe UI", Helvetica, Arial, sans-serif';

export function makeLabel(lines: LabelLine[], opts: LabelOptions = {}): Sprite {
  const width = opts.width ?? 0.26;
  const padding = opts.padding ?? 14;
  const canvasW = Math.round(width * PX_PER_M);
  const measure = document.createElement('canvas').getContext('2d')!;
  let totalH = padding * 2;
  const metrics = lines.map((l) => {
    const size = l.size ?? 26;
    measure.font = `${l.weight ?? '500'} ${size}px ${BASE_FONT}`;
    totalH += size * 1.32;
    return { size };
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = Math.round(totalH);
  const ctx = canvas.getContext('2d')!;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    roundRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 18);
    ctx.fill();
  }
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 18);
    ctx.stroke();
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.align ?? 'center';
  const x = (opts.align ?? 'center') === 'center' ? canvas.width / 2 : padding;
  let y = padding;
  lines.forEach((l, i) => {
    const size = metrics[i].size;
    ctx.font = `${l.weight ?? '500'} ${size}px ${BASE_FONT}`;
    ctx.fillStyle = l.color ?? '#e8eef6';
    ctx.fillText(fitText(ctx, l.text, canvas.width - padding * 2), x, y);
    y += size * 1.32;
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: opts.depthTest ?? true,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  // Labels are never interaction targets. three's Sprite.raycast requires
  // raycaster.camera and otherwise throws mid-traversal, which aborted the
  // whole pointer intersection pass with partial results (every hover
  // resolved to the first core). A no-op raycast keeps labels purely visual.
  sprite.raycast = () => {};
  sprite.scale.set(width, width * (canvas.height / canvas.width), 1);
  return sprite;
}

export function disposeLabel(sprite: Sprite): void {
  const material = sprite.material as SpriteMaterial;
  material.map?.dispose();
  material.dispose();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
